# Security Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close 7 confirmed security gaps: Upstash silent degradation, `open-invite` token enumeration, `app-book-appointment` rate limit bypass when phone is absent, CORS `error()` always returning `*`, missing CSP headers, absent body size limits, and the same distinct token error codes in `accept-invite`.

**Architecture:** All edge function changes flow through a single `_shared/cors.ts` update that fixes the `error()` signature and adds a `bodyGuard()` utility. The RPC fix is an additive migration — no existing behaviour changes. The frontend fix is confined to `next.config.js`.

**Tech Stack:** Deno edge functions, TypeScript, PostgreSQL (Supabase RPC), Next.js 14 App Router

---

## Verified Findings Summary

| # | Issue | Severity | File(s) |
|---|-------|----------|---------|
| 1 | Upstash missing → silent `false`, no log | Medium | `widget-book-appointment/index.ts:11` |
| 2 | `open-invite`: no rate limit + distinct 404/409/410 error codes | Medium | `open-invite/index.ts` |
| 3 | `app-book-appointment`: phone optional → RPC phone rate limit skipped | Medium | `app-book-appointment/index.ts`, RPC |
| 4 | `cors.ts error()` has no `req` param → always returns `Access-Control-Allow-Origin: *` | Low | `_shared/cors.ts:50-56` |
| 5 | No CSP or security headers in Next.js | Low | `apps/web/next.config.js` |
| 6 | No request body size limit on any edge function | Low | All edge functions |
| 7 | `accept-invite`: same distinct 404/409/410 token state codes (requires auth, lower risk) | Low | `accept-invite/index.ts:48-50` |

**Already fixed (do not re-address):**
- `invite_tokens` `anyone_select_unused_tokens` RLS policy — dropped in `20260528120000`
- `create-manual-block` auth — correct `isOwner || isSelf` check confirmed
- `delete-account` — correct auth + ownership cascade confirmed
- `register-shop` — correct auth + one-shop-per-user guard confirmed

---

## File Map

| File | Action | Purpose |
|------|--------|---------|
| `supabase/functions/_shared/cors.ts` | Modify | Add `req?` param to `error()`; add `bodyGuard()` utility |
| `supabase/functions/open-invite/index.ts` | Modify | Add in-memory rate limit; unify token error codes |
| `supabase/functions/widget-book-appointment/index.ts` | Modify | Log warning when Upstash unconfigured; add `bodyGuard` |
| `supabase/functions/app-book-appointment/index.ts` | Modify | Add `bodyGuard` |
| `supabase/functions/create-manual-block/index.ts` | Modify | Add `bodyGuard` |
| `supabase/functions/staff-cancel-appointment/index.ts` | Modify | Add `bodyGuard` |
| `supabase/functions/app-cancel-appointment/index.ts` | Modify | Add `bodyGuard` |
| `supabase/functions/accept-invite/index.ts` | Modify | Unify token error codes; add `bodyGuard` |
| `supabase/migrations/20260528200000_user_booking_rate_limit.sql` | Create | Add `p_customer_user_id`-based rate limit to `create_appointment_atomic` |
| `apps/web/next.config.js` | Modify | Add CSP + security response headers |

---

## Task 1: Fix `_shared/cors.ts` — add `req` to `error()` and add `bodyGuard()`

**Problem:** `error()` at line 50 has no `req` parameter. Every error response from every edge function therefore calls `getAllowOrigin(undefined)` which returns `'*'`. Additionally, no edge function limits the request body size.

**Files:**
- Modify: `supabase/functions/_shared/cors.ts`

- [ ] **Step 1: Replace `cors.ts` with the updated version**

```typescript
const ALLOWED_ORIGINS = [
  'https://siradaki.app',
  'https://www.siradaki.app',
  'http://localhost:3000',
  'http://localhost:8081',
];

function getAllowOrigin(req?: Request): string {
  if (!req) return '*';
  const origin = req.headers.get('Origin') ?? '';
  return ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
}

export function cors(response: Response, req?: Request): Response {
  const headers = new Headers(response.headers);
  headers.set('Access-Control-Allow-Origin', getAllowOrigin(req));
  headers.set(
    'Access-Control-Allow-Headers',
    'authorization, x-client-info, apikey, content-type',
  );
  headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  return new Response(response.body, {
    status: response.status,
    headers,
  });
}

export function corsOptions(req?: Request): Response {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': getAllowOrigin(req),
      'Access-Control-Allow-Headers':
        'authorization, x-client-info, apikey, content-type',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    },
  });
}

export function json(data: unknown, status = 200, req?: Request): Response {
  return cors(
    new Response(JSON.stringify(data), {
      status,
      headers: { 'Content-Type': 'application/json' },
    }),
    req,
  );
}

// req is now the 4th param — existing callers (error(msg), error(msg, status),
// error(msg, status, extras)) are backward compatible; pass req for correct CORS origin.
export function error(
  message: string,
  status = 400,
  extras?: Record<string, unknown>,
  req?: Request,
): Response {
  return json({ error: message, ...(extras ?? {}) }, status, req);
}

const MAX_BODY_BYTES = 16_000; // 16 KB — sufficient for all booking payloads

// Call at the top of every POST handler. Returns a 413 Response if the
// request body exceeds the limit, null otherwise.
export function bodyGuard(req: Request): Response | null {
  const contentLength = parseInt(req.headers.get('content-length') ?? '0', 10);
  if (contentLength > MAX_BODY_BYTES) {
    return error('Request body too large', 413, {}, req);
  }
  return null;
}
```

- [ ] **Step 2: Verify the signature change is backward compatible**

The `error()` change adds an optional 4th param. All existing calls use 1–3 positional args, so no callers break. Verify:

```powershell
cd "C:\Users\Emre\Berber randevu"
# Should return no results — no caller passes 4 args to error() yet
Select-String -Path "supabase\functions\**\*.ts" -Pattern "error\(.*,.*,.*,.*\)" -Recurse
```

Expected: no matches.

- [ ] **Step 3: Commit**

```bash
git add supabase/functions/_shared/cors.ts
git commit -m "fix(security): add req param to error() for CORS origin enforcement; add bodyGuard utility"
```

---

## Task 2: `widget-book-appointment` — warn when Upstash is unconfigured + add bodyGuard

**Problem:** Lines 9–11 of `widget-book-appointment/index.ts`:
```typescript
if (!url || !token) return false;
```
Returns `false` silently — IP rate limiting is completely disabled without any log entry.

**Files:**
- Modify: `supabase/functions/widget-book-appointment/index.ts`

- [ ] **Step 1: Add warning log and import `bodyGuard`**

Change the import line (line 3):
```typescript
import { corsOptions, error, json, bodyGuard } from "../_shared/cors.ts";
```

Replace lines 9–11 (`if (!url || !token) return false;`) with:
```typescript
  if (!url || !token) {
    console.warn("[widget-book] Upstash not configured — IP rate limiting is disabled");
    return false;
  }
```

- [ ] **Step 2: Add `bodyGuard` call in the serve handler**

After the method check (line 69, `if (req.method !== "POST") return error(...)`), add:
```typescript
  const guard = bodyGuard(req);
  if (guard) return guard;
```

- [ ] **Step 3: Commit**

```bash
git add supabase/functions/widget-book-appointment/index.ts
git commit -m "fix(security): warn when Upstash unconfigured; add body size guard to widget-book"
```

---

## Task 3: `open-invite` — rate limiting + unified error codes

**Problem:** No rate limiting. Attacker can loop POST requests and learn token state from distinct HTTP status codes (404 = not found, 409 = already used, 410 = expired). `anyone_select_unused_tokens` RLS policy was already dropped in migration `20260528120000`, so the DB layer is safe — the edge function layer is not.

**Files:**
- Modify: `supabase/functions/open-invite/index.ts`

- [ ] **Step 1: Replace `open-invite/index.ts` entirely**

```typescript
import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createAdminClient } from "../_shared/supabase-admin.ts";
import { corsOptions, error, json, bodyGuard } from "../_shared/cors.ts";

// Per-isolate in-memory rate limit: max 10 requests / IP / 60 seconds.
// Deno edge function instances are short-lived; this is enough to prevent
// rapid token enumeration within a single instance window.
const RL_MAP = new Map<string, { count: number; resetAt: number }>();
const RL_MAX = 10;
const RL_WINDOW_MS = 60_000;

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = RL_MAP.get(ip);
  if (!entry || now > entry.resetAt) {
    RL_MAP.set(ip, { count: 1, resetAt: now + RL_WINDOW_MS });
    return false;
  }
  entry.count += 1;
  return entry.count > RL_MAX;
}

function getClientIp(req: Request): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    "unknown"
  );
}

serve(async (req) => {
  if (req.method === "OPTIONS") return corsOptions(req);
  if (req.method !== "POST") return error("Method not allowed", 405, {}, req);

  const guard = bodyGuard(req);
  if (guard) return guard;

  const ip = getClientIp(req);
  if (isRateLimited(ip)) {
    return error("Too many requests. Please wait.", 429, {}, req);
  }

  let body: { token?: string };
  try {
    body = await req.json();
  } catch {
    return error("Invalid JSON", 400, {}, req);
  }

  const token = body.token?.trim();
  if (!token) return error("token is required", 400, {}, req);

  const supabase = createAdminClient();
  const { data: inviteRow, error: inviteErr } = await supabase
    .from("invite_tokens")
    .select("used_at, expires_at")
    .eq("token", token)
    .maybeSingle();

  if (inviteErr) {
    console.error("open-invite token lookup failed:", inviteErr);
    return error("Could not verify invite", 500, {}, req);
  }

  // All invalid token states return the same 404 to prevent lifecycle enumeration.
  // (not found, already used, expired → identical response)
  if (
    !inviteRow ||
    inviteRow.used_at ||
    new Date(inviteRow.expires_at) < new Date()
  ) {
    return error("Invalid or expired invite link", 404, {}, req);
  }

  return json({ valid: true }, 200, req);
});
```

- [ ] **Step 2: Commit**

```bash
git add supabase/functions/open-invite/index.ts
git commit -m "fix(security): add rate limiting and unified error codes to open-invite"
```

---

## Task 4: `accept-invite` — unify token error codes + add bodyGuard

**Problem:** Lines 48–50 of `accept-invite/index.ts` return distinct 404, 409, and 410 for different token states — same lifecycle enumeration risk as `open-invite`, though lower severity because the caller must be authenticated.

**Files:**
- Modify: `supabase/functions/accept-invite/index.ts`

- [ ] **Step 1: Update the import line**

Change line 4:
```typescript
import { corsOptions, error, json, bodyGuard } from "../_shared/cors.ts";
```

- [ ] **Step 2: Add `bodyGuard` after the method check (line 15)**

```typescript
  if (req.method !== "POST") return error("Method not allowed", 405);

  const guard = bodyGuard(req);
  if (guard) return guard;
```

- [ ] **Step 3: Replace the three distinct token-state errors (lines 48–50) with a unified message**

Old:
```typescript
  if (!inviteRow) return error("Geçersiz token", 404);
  if (inviteRow.used_at) return error("Token zaten kullanılmış", 409);
  if (new Date(inviteRow.expires_at) < new Date()) return error("Token süresi dolmuş", 410);
```

New:
```typescript
  if (
    !inviteRow ||
    inviteRow.used_at ||
    new Date(inviteRow.expires_at) < new Date()
  ) {
    return error("Invalid or expired invite link", 404);
  }
```

- [ ] **Step 4: Commit**

```bash
git add supabase/functions/accept-invite/index.ts
git commit -m "fix(security): unify accept-invite token error codes; add body size guard"
```

---

## Task 5: Add `bodyGuard` to remaining edge functions

**Files:**
- Modify: `supabase/functions/app-book-appointment/index.ts`
- Modify: `supabase/functions/create-manual-block/index.ts`
- Modify: `supabase/functions/staff-cancel-appointment/index.ts`
- Modify: `supabase/functions/app-cancel-appointment/index.ts`

The same two-line change applies to each file.

- [ ] **Step 1: `app-book-appointment/index.ts`**

Update import (line 4):
```typescript
import { corsOptions, error, json, bodyGuard } from "../_shared/cors.ts";
```

After `if (req.method !== "POST") return error("Method not allowed", 405);` (line 112), add:
```typescript
  const guard = bodyGuard(req);
  if (guard) return guard;
```

- [ ] **Step 2: `create-manual-block/index.ts`**

Update import (line 4):
```typescript
import { corsOptions, error, json, bodyGuard } from "../_shared/cors.ts";
```

After `if (req.method !== "POST") return error("Method not allowed", 405);` (line 14), add:
```typescript
  const guard = bodyGuard(req);
  if (guard) return guard;
```

- [ ] **Step 3: `staff-cancel-appointment/index.ts`**

Update import (line 3):
```typescript
import { corsOptions, error, json, bodyGuard } from "../_shared/cors.ts";
```

After `if (req.method !== "POST") return error("Method not allowed", 405);` (line 7), add:
```typescript
  const guard = bodyGuard(req);
  if (guard) return guard;
```

- [ ] **Step 4: `app-cancel-appointment/index.ts`**

Update import (line 4):
```typescript
import { corsOptions, error, json, bodyGuard } from "../_shared/cors.ts";
```

After `if (req.method !== "POST") return error("Method not allowed", 405);` (line 97), add:
```typescript
  const guard = bodyGuard(req);
  if (guard) return guard;
```

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/app-book-appointment/index.ts \
        supabase/functions/create-manual-block/index.ts \
        supabase/functions/staff-cancel-appointment/index.ts \
        supabase/functions/app-cancel-appointment/index.ts
git commit -m "fix(security): add request body size guard to remaining POST edge functions"
```

---

## Task 6: Migration — add `customer_user_id`-based rate limit to `create_appointment_atomic`

**Problem:** `app-book-appointment` passes `p_customer_user_id: user.id` but `customer_phone` is optional. The RPC's phone-based rate limit (lines 58–67 of `20260519120000`) only fires when `p_customer_phone IS NOT NULL AND trim(p_customer_phone) <> ''`. Authenticated staff can flood booking creation with no phone provided.

**Files:**
- Create: `supabase/migrations/20260528200000_user_booking_rate_limit.sql`

- [ ] **Step 1: Create the migration file**

This is a `CREATE OR REPLACE FUNCTION` with the full body of `create_appointment_atomic` from `20260519120000_advisory_lock_bigint_key.sql`, with one new block added after the phone rate limit check. The only addition is the 11-line `IF p_customer_user_id IS NOT NULL THEN` block and the supporting index.

```sql
-- Add customer_user_id-based rate limit to create_appointment_atomic.
-- Previously, authenticated callers who omitted customer_phone bypassed the
-- phone-based rate limit entirely (the existing check guards only non-null phones).

CREATE INDEX IF NOT EXISTS appointments_customer_user_id_created_at_idx
  ON public.appointments (customer_user_id, created_at)
  WHERE customer_user_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.create_appointment_atomic(
  p_shop_slug text DEFAULT NULL,
  p_shop_id uuid DEFAULT NULL,
  p_service_id uuid DEFAULT NULL,
  p_staff_id uuid DEFAULT NULL,
  p_starts_at timestamptz DEFAULT NULL,
  p_customer_name text DEFAULT NULL,
  p_customer_phone text DEFAULT NULL,
  p_customer_notes text DEFAULT NULL,
  p_customer_user_id uuid DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_shop public.shops%ROWTYPE;
  v_service public.services%ROWTYPE;
  v_staff_id uuid;
  v_ends_at timestamptz;
  v_appointment_id uuid;
  v_staff_name text;
  v_role text := current_setting('role', true);
  v_uid uuid := auth.uid();
  v_is_privileged boolean;
BEGIN
  IF p_service_id IS NULL OR p_starts_at IS NULL OR trim(COALESCE(p_customer_name, '')) = '' THEN
    RAISE EXCEPTION 'Eksik randevu bilgisi' USING ERRCODE = '22023';
  END IF;
  IF char_length(trim(p_customer_name)) < 2 THEN
    RAISE EXCEPTION 'Isim en az 2 karakter olmali' USING ERRCODE = '22023';
  END IF;

  IF p_starts_at < now() - interval '5 minutes' THEN
    RAISE EXCEPTION 'Geçmiş bir saate randevu oluşturulamaz' USING ERRCODE = '22023';
  END IF;

  -- Existing phone-based rate limit (widget bookings)
  IF p_customer_phone IS NOT NULL AND trim(p_customer_phone) <> '' THEN
    IF (
      SELECT COUNT(*)
      FROM public.appointments
      WHERE customer_phone = trim(p_customer_phone)
        AND created_at > now() - interval '10 minutes'
    ) >= 5 THEN
      RAISE EXCEPTION 'Çok fazla randevu isteği. Lütfen birkaç dakika bekleyin.' USING ERRCODE = 'P0004';
    END IF;
  END IF;

  -- New: user_id-based rate limit (app bookings where phone may be absent)
  IF p_customer_user_id IS NOT NULL THEN
    IF (
      SELECT COUNT(*)
      FROM public.appointments
      WHERE customer_user_id = p_customer_user_id
        AND created_at > now() - interval '10 minutes'
    ) >= 5 THEN
      RAISE EXCEPTION 'Çok fazla randevu isteği. Lütfen birkaç dakika bekleyin.' USING ERRCODE = 'P0004';
    END IF;
  END IF;

  SELECT * INTO v_shop
  FROM public.shops
  WHERE (p_shop_id IS NOT NULL AND id = p_shop_id)
     OR (p_shop_id IS NULL AND slug = p_shop_slug)
  LIMIT 1;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Dukkan bulunamadi' USING ERRCODE = 'P0002';
  END IF;

  SELECT * INTO v_service
  FROM public.services
  WHERE id = p_service_id
    AND shop_id = v_shop.id
    AND is_active = true;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Hizmet bulunamadi' USING ERRCODE = 'P0002';
  END IF;

  IF p_staff_id IS NOT NULL THEN
    SELECT s.id INTO v_staff_id
    FROM public.staff s
    WHERE s.id = p_staff_id
      AND s.shop_id = v_shop.id
      AND s.is_active = true;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Personel bulunamadi' USING ERRCODE = 'P0002';
    END IF;
  END IF;

  v_is_privileged := v_role IN ('postgres', 'service_role');
  IF NOT v_is_privileged THEN
    IF v_uid IS NULL THEN
      RAISE EXCEPTION 'not allowed to create appointment' USING ERRCODE = '42501';
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM public.shops sh
      WHERE sh.id = v_shop.id
        AND (
          sh.owner_user_id = v_uid
          OR sh.owner_id = v_uid
          OR EXISTS (
            SELECT 1
            FROM public.staff admin_staff
            WHERE admin_staff.shop_id = sh.id
              AND admin_staff.user_id = v_uid
              AND admin_staff.role = 'admin'
              AND admin_staff.is_active = true
          )
          OR (
            v_staff_id IS NOT NULL
            AND EXISTS (
              SELECT 1
              FROM public.staff self_staff
              WHERE self_staff.id = v_staff_id
                AND self_staff.user_id = v_uid
                AND self_staff.is_active = true
            )
          )
        )
    ) THEN
      RAISE EXCEPTION 'not allowed to create appointment' USING ERRCODE = '42501';
    END IF;
  END IF;

  v_ends_at := p_starts_at + make_interval(mins => v_service.duration_min);

  IF v_staff_id IS NULL THEN
    v_staff_id := public.assign_any_staff(v_shop.id, p_starts_at, v_ends_at);
    IF v_staff_id IS NULL THEN
      RAISE EXCEPTION 'Secilen saatte musait personel yok' USING ERRCODE = 'P0001';
    END IF;
    PERFORM pg_advisory_xact_lock(('x' || md5(v_staff_id::text))::bit(64)::bigint);
    IF NOT public.staff_is_inside_work_window(v_staff_id, p_starts_at, v_ends_at)
       OR public.schedule_has_conflict(v_staff_id, p_starts_at, v_ends_at) THEN
      RAISE EXCEPTION 'Secilen saatte musait personel yok' USING ERRCODE = 'P0001';
    END IF;
  ELSE
    PERFORM pg_advisory_xact_lock(('x' || md5(v_staff_id::text))::bit(64)::bigint);

    IF NOT public.staff_is_inside_work_window(v_staff_id, p_starts_at, v_ends_at) THEN
      RAISE EXCEPTION 'Secilen saat personelin calisma saati veya mola araligi disinda' USING ERRCODE = 'P0001';
    END IF;

    IF public.schedule_has_conflict(v_staff_id, p_starts_at, v_ends_at) THEN
      RAISE EXCEPTION 'Secilen saat dolu; cakisan randevu veya manuel blok var' USING ERRCODE = 'P0001';
    END IF;
  END IF;

  PERFORM set_config('app.scheduling_rpc', 'on', true);

  INSERT INTO public.appointments (
    staff_id, service_id, customer_name, customer_phone, customer_notes,
    customer_user_id, starts_at, ends_at, status, booked_price_cents
  )
  VALUES (
    v_staff_id, v_service.id, trim(p_customer_name), nullif(trim(COALESCE(p_customer_phone, '')), ''),
    nullif(trim(COALESCE(p_customer_notes, '')), ''), p_customer_user_id,
    p_starts_at, v_ends_at, 'confirmed', v_service.price_cents
  )
  RETURNING id INTO v_appointment_id;

  PERFORM set_config('app.scheduling_rpc', 'off', true);

  SELECT name INTO v_staff_name FROM public.staff WHERE id = v_staff_id;

  RETURN json_build_object(
    'appointment_id', v_appointment_id,
    'starts_at', p_starts_at,
    'ends_at', v_ends_at,
    'staff_id', v_staff_id,
    'staff_name', COALESCE(v_staff_name, ''),
    'barber_display_name', COALESCE(v_staff_name, ''),
    'service_name', v_service.name
  );
EXCEPTION
  WHEN exclusion_violation THEN
    RAISE EXCEPTION 'Secilen saat dolu; cakisan randevu veya manuel blok var' USING ERRCODE = 'P0001';
END;
$$;
```

- [ ] **Step 2: Run migration locally**

```powershell
cd "C:\Users\Emre\Berber randevu"
npx supabase db reset 2>&1 | Select-String -Pattern "ERROR|error|Finished" | Select-Object -First 20
```

Expected output contains: `Finished supabase db reset.` with no ERROR lines.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260528200000_user_booking_rate_limit.sql
git commit -m "fix(security): add customer_user_id rate limit to create_appointment_atomic"
```

---

## Task 7: Next.js security headers + CSP

**Problem:** `apps/web/next.config.js` has only `transpilePackages`. No `X-Frame-Options`, no `X-Content-Type-Options`, no CSP.

**Files:**
- Modify: `apps/web/next.config.js`

- [ ] **Step 1: Replace `next.config.js`**

```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@berber/shared'],
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
          {
            key: 'Content-Security-Policy',
            // unsafe-inline required for Tailwind/React inline style objects
            // connect-src includes Supabase Realtime websocket (wss://)
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-eval'",
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: blob: https:",
              "font-src 'self' data:",
              "connect-src 'self' https://*.supabase.co wss://*.supabase.co",
              "frame-ancestors 'none'",
            ].join('; '),
          },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
```

- [ ] **Step 2: Verify build passes**

```powershell
cd "C:\Users\Emre\Berber randevu\apps\web"
npx next build 2>&1 | Select-Object -Last 20
```

Expected: build completes without errors. If a CSP directive blocks a legitimate resource (e.g., Google Fonts, an external image), add its hostname to the appropriate directive before committing.

- [ ] **Step 3: Commit**

```bash
git add apps/web/next.config.js
git commit -m "fix(security): add CSP and HTTP security headers to Next.js config"
```

---

## Final Verification Checklist

Run these after all tasks are complete:

- [ ] `npx supabase db reset` passes with no ERRORs
- [ ] `npx next build` (inside `apps/web`) completes successfully
- [ ] POST 11 requests to `open-invite` from the same IP → 12th returns 429
- [ ] POST to `widget-book-appointment` with Upstash env vars unset → `console.warn` appears in function logs
- [ ] POST to `app-book-appointment` with no `customer_phone` 6 times in < 10 min → 6th returns 429
- [ ] POST with `content-length: 20000` to any edge function → returns 413
- [ ] Browser DevTools on the Next.js app shows `content-security-policy` response header

---

## Out of Scope (with rationale)

| Finding | Decision |
|---------|----------|
| CORS origins hardcoded in `cors.ts` | Domain is stable; env var adds complexity without security benefit |
| `delete-account` error messages expose internal strings | Error goes to server logs, not client — acceptable |
| React component XSS audit | React JSX escaping is sufficient; no `dangerouslySetInnerHTML` found |
| Pre-flight auth check in `app-book-appointment` | DB-layer authorization is correct; duplicate edge check adds complexity without value |
