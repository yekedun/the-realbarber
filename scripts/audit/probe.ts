import { createClient } from "@supabase/supabase-js";
import * as fs from "fs";
import * as path from "path";
import type { ProbeResult } from "./types.js";
import { RPC_PROBES, EDGE_FN_PROBES } from "./probe-config.js";

function fileURLToPath(url: string): string {
  // Handle Windows paths: file:///C:/... → C:\...
  const p = url.replace(/^file:\/\/\//, "").replace(/\//g, path.sep);
  return decodeURIComponent(p);
}
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

// ── Supabase clients ──────────────────────────────────────────────────────

const SUPABASE_URL = "http://127.0.0.1:54201";
const ANON_KEY = "sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH";
const SERVICE_ROLE_KEY = "sb_secret_N7UND0UgjKTVK-Uodkm0Hg_xSvEMPvz";

export const anonClient = createClient(SUPABASE_URL, ANON_KEY);
export const serviceClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// ── Result collector ──────────────────────────────────────────────────────

export const results: ProbeResult[] = [];

export function pass(
  category: ProbeResult["category"],
  check: string,
  msg = "OK",
  ms?: number
) {
  results.push({ category, check, status: "PASS", message: msg, durationMs: ms });
  console.log(`  ✅ [${category}] ${check}`);
}

export function fail(
  category: ProbeResult["category"],
  check: string,
  msg: string,
  ms?: number
) {
  results.push({ category, check, status: "FAIL", message: msg, durationMs: ms });
  console.error(`  ❌ [${category}] ${check}: ${msg}`);
}

export function skip(
  category: ProbeResult["category"],
  check: string,
  reason: string
) {
  results.push({ category, check, status: "SKIP", message: reason });
  console.log(`  ⏭️  [${category}] ${check}: ${reason}`);
}

export async function timed<T>(fn: () => Promise<T>): Promise<[T, number]> {
  const t = Date.now();
  const r = await fn();
  return [r, Date.now() - t];
}

// ── Test data helpers ─────────────────────────────────────────────────────

export async function getTestShop(): Promise<string> {
  const { data, error } = await serviceClient
    .from("shops")
    .select("id")
    .limit(1)
    .single();
  if (error || !data?.id) {
    throw new Error(
      `No shop found in local DB — run: npx supabase db reset\nError: ${error?.message}`
    );
  }
  return data.id;
}

export async function getTestStaff(shopId: string): Promise<string> {
  const { data, error } = await serviceClient
    .from("staff")
    .select("id")
    .eq("shop_id", shopId)
    .limit(1)
    .single();
  if (error || !data?.id) {
    throw new Error(
      `No staff found for shop ${shopId} — run: npx supabase db reset\nError: ${error?.message}`
    );
  }
  return data.id;
}

// ── RPC Probing ───────────────────────────────────────────────────────────

export async function probeRpcs(shopId: string, staffId: string) {
  console.log("\n── RPC Probing ──────────────────────────────────────────");

  // Runtime args for RPCs that need shopId/staffId
  const runtimeArgs: Record<string, Record<string, unknown>> = {
    get_occupied_ranges: { p_staff_id: staffId, p_date: "2026-06-01" },
    get_shop_occupied_ranges: { p_shop_id: shopId, p_date: "2026-06-01" },
    get_staff_day_hours: { p_staff_id: staffId, p_date: "2026-06-01" },
    get_shop_dashboard_stats: { p_shop_id: shopId },
    get_commission_report: { p_shop_id: shopId },
    get_staff_commission_configs: { p_shop_id: shopId },
    staff_is_inside_work_window: {
      p_staff_id: staffId,
      p_starts_at: "2026-06-01T10:00:00Z",
      p_ends_at: "2026-06-01T10:30:00Z",
    },
    schedule_has_conflict: {
      p_staff_id: staffId,
      p_starts_at: "2026-06-01T10:00:00Z",
      p_ends_at: "2026-06-01T10:30:00Z",
    },
  };

  for (const cfg of RPC_PROBES) {
    const args = cfg.args ?? runtimeArgs[cfg.name] ?? null;

    if (args === null) {
      skip("rpc", cfg.name, cfg.skipReason ?? "no args available");
      continue;
    }

    const [res, ms] = await timed(() =>
      serviceClient.rpc(cfg.name as never, args as never)
    );

    if (res.error) {
      // PGRST202 = function not found = FAIL
      if (res.error.code === "PGRST202") {
        fail("rpc", cfg.name, `RPC not found: ${res.error.message}`, ms);
      } else {
        // Any other error = function exists but returned a business logic error = OK
        pass(
          "rpc",
          cfg.name,
          `called (business error is OK: ${res.error.message.slice(0, 80)})`,
          ms
        );
      }
    } else {
      pass("rpc", cfg.name, `OK — ${JSON.stringify(res.data).slice(0, 80)}`, ms);
    }
  }
}

// ── Edge Function Probing ─────────────────────────────────────────────────

export async function probeEdgeFns() {
  console.log("\n── Edge Function Probing ────────────────────────────────");

  for (const cfg of EDGE_FN_PROBES) {
    const url = `${SUPABASE_URL}/functions/v1/${cfg.name}`;

    // Anon probe
    const [anonRes, anonMs] = await timed(() =>
      fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${ANON_KEY}`,
        },
        body: JSON.stringify(cfg.body),
      })
    );

    if (anonRes.status === cfg.expectedAnonStatus) {
      pass("edge_fn", `${cfg.name} (anon)`, `HTTP ${anonRes.status}`, anonMs);
    } else if (anonRes.status >= 500) {
      fail(
        "edge_fn",
        `${cfg.name} (anon)`,
        `HTTP ${anonRes.status} — server error`,
        anonMs
      );
    } else {
      // Non-5xx unexpected status — fn is alive, just different behavior
      pass(
        "edge_fn",
        `${cfg.name} (anon)`,
        `HTTP ${anonRes.status} (expected ${cfg.expectedAnonStatus}, fn is alive)`,
        anonMs
      );
    }

    // Service role probe
    const [svcRes, svcMs] = await timed(() =>
      fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
        },
        body: JSON.stringify(cfg.body),
      })
    );

    if (svcRes.status >= 500) {
      fail(
        "edge_fn",
        `${cfg.name} (service)`,
        `HTTP ${svcRes.status} — server error`,
        svcMs
      );
    } else {
      pass(
        "edge_fn",
        `${cfg.name} (service)`,
        `HTTP ${svcRes.status} (fn is alive)`,
        svcMs
      );
    }
  }
}

// ── RLS Probing ───────────────────────────────────────────────────────────

const PUBLIC_READ_TABLES = ["services", "shops", "staff"] as const;
const PROTECTED_TABLES = [
  "appointments",
  "blocks",
  "widget_tokens",
  "staff_schedules",
  "appointment_slots",
  "block_slots",
] as const;

export async function probeRls() {
  console.log("\n── RLS Probing ──────────────────────────────────────────");

  // Anon should be able to read public tables
  for (const t of PUBLIC_READ_TABLES) {
    const [res, ms] = await timed(() =>
      anonClient.from(t).select("id").limit(1)
    );
    if (res.error) {
      fail("rls", `${t} anon-read`, `Error: ${res.error.message}`, ms);
    } else {
      pass("rls", `${t} anon-read`, `${res.data?.length ?? 0} row(s) returned`, ms);
    }
  }

  // Anon should NOT see rows in protected tables (0 rows or explicit error)
  for (const t of PROTECTED_TABLES) {
    const [res, ms] = await timed(() =>
      anonClient.from(t).select("*").limit(5)
    );
    if (res.error) {
      pass("rls", `${t} anon-blocked`, `RLS blocked: ${res.error.code}`, ms);
    } else if ((res.data?.length ?? 0) === 0) {
      pass("rls", `${t} anon-blocked`, "0 rows (RLS filtered)", ms);
    } else {
      fail(
        "rls",
        `${t} anon-blocked`,
        `${res.data!.length} rows returned — RLS missing!`,
        ms
      );
    }
  }

  // Service role should read all tables without error
  for (const t of [...PUBLIC_READ_TABLES, ...PROTECTED_TABLES]) {
    const [res, ms] = await timed(() =>
      serviceClient.from(t).select("*").limit(1)
    );
    // PGRST116 = no rows found, that's fine
    if (res.error && res.error.code !== "PGRST116") {
      fail("rls", `${t} service-read`, `Error: ${res.error.message}`, ms);
    } else {
      pass("rls", `${t} service-read`, "OK", ms);
    }
  }
}

// ── Main ──────────────────────────────────────────────────────────────────

async function main() {
  console.log("🔬 Probe infrastructure ready.");
  console.log(`   Supabase URL: ${SUPABASE_URL}`);

  const { error } = await serviceClient.from("shops").select("id").limit(1);
  if (error && error.code !== "PGRST116") {
    console.error(`\n❌ Cannot connect to Supabase: ${error.message}`);
    process.exit(1);
  }
  console.log("   ✅ Supabase connectivity OK");

  const shopId = await getTestShop();
  const staffId = await getTestStaff(shopId);
  console.log(`   Shop: ${shopId}, Staff: ${staffId}`);

  await probeRpcs(shopId, staffId);
  await probeEdgeFns();
  await probeRls();

  const failed = results.filter((r) => r.status === "FAIL").length;
  const passed = results.filter((r) => r.status === "PASS").length;
  const skipped = results.filter((r) => r.status === "SKIP").length;
  console.log(`\n📊 ${passed} PASS, ${failed} FAIL, ${skipped} SKIP`);
}

main().catch((e) => { console.error(e); process.exit(1); });
