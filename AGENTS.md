# AGENTS.md

## Must-follow constraints

- **pnpm only** — `npm` veya `yarn` kullanma. Workspace `pnpm-workspace.yaml` ile yönetiliyor.
- **`@berber/shared` tek kaynak.** Edge fonksiyonları `supabase/functions/import_map.json` üzerinden `@berber/shared/slot-utils`, `@berber/shared/types`, `@berber/shared/constants` aliaslarıyla `packages/shared/src/*` dosyalarını doğrudan import eder. Tek kopyayı `packages/shared/src/`'de güncelle.
- **`database.types.ts` iki kopya** — Supabase generator ürettiği için manuel sync gerekli: `cp packages/db/src/database.types.ts supabase/functions/_shared/database.types.ts`
- **Shared paket dosyalarında relative import'lar `.ts` uzantılı olmak zorundadır** (Deno gereği).
- **`btree_gist` extension** migration'lardan önce aktif olmalı; `20240101000001_initial.sql` bunu içeriyor, kaldırma.
- **`widget_tokens.token_hash`** alanına raw token YAZILMAZ — her zaman SHA256 hash (`sha256()` fonksiyonu `supabase/functions/_shared/supabase-admin.ts`'de).
- **`appointments` tablosuna** doğrudan INSERT olmaz — her zaman `app-book-appointment` veya `widget-book-appointment` edge function (service role) üzerinden.
- **`appointment_slots` mirror tablo** — `appointments`'a INSERT/UPDATE/DELETE olduğunda trigger ile senkronize edilir. Anon Realtime subscription'ları için zorunlu. `appointment_slots`'a manuel INSERT YAPMA — sadece `sync_appointment_slots` trigger'ı yazar.
- **`invite_tokens.token` alanına raw UUID yazılır** (widget token'larının aksine hash'lenmez). Davet linki bu raw UUID'yi içerir.
- **`shops.status`** yeni kayıtlarda `pending` gelir; `active` olmadan `invite-barber` edge fn davet oluşturmayı reddeder.
- Yeni migration eklerken `gist exclude` constraint'lerinin bozulmadığını `supabase db push` ile doğrula.

## Validation before finishing

```bash
supabase db reset                                               # Migration'ları sıfırdan uygula
supabase functions serve block-walkin --env-file .env.local     # Edge fn lokal test
pnpm db:check                                                   # database.types senkron kontrolü
```

## App structure

```
apps/
  mobile/          # Expo / React Native — berber staff uygulaması
  web/             # Next.js App Router — müşteri booking sayfası + admin panel
packages/
  shared/src/      # Slot hesaplama algoritması + tipler (tek kaynak)
  db/src/          # Auto-generated Supabase tipleri (kaynak kopya)
supabase/
  functions/       # Deno edge functions (15 adet)
  migrations/      # ~60 migration — tüm şema burada
```

## Edge functions

| Fonksiyon | Kimlik doğrulama | Amaç |
|---|---|---|
| `app-book-appointment` | `authenticated` | Müşteri randevu oluşturur (gist conflict → 23P01) |
| `app-cancel-appointment` | `authenticated` | Müşteri randevu iptal eder |
| `staff-cancel-appointment` | `authenticated` | Personel randevu iptal eder |
| `widget-book-appointment` | `verify_jwt=false` (widget token) | Widget üzerinden randevu |
| `widget-get-availability` | `verify_jwt=false` | Widget müsaitlik sorgular |
| `block-walkin` | `verify_jwt=false` (widget token) | Walk-in bloğu oluşturur |
| `create-widget-token` | `authenticated` | Dükkan için widget token üretir |
| `create-manual-block` | `authenticated` | Manuel takvim bloğu |
| `register-shop` | `authenticated` | Yeni dükkan başvurusu (status=pending) |
| `invite-barber` | `authenticated` | Davet linki üretir (shop.status=active zorunlu) |
| `open-invite` | `verify_jwt=false` | Token geçerliliğini ön-doğrular (auth olmadan) |
| `accept-invite` | `authenticated` | Token tüketir + staff kaydı oluşturur |
| `delete-account` | `authenticated` | Kullanıcı hesabı siler |
| `send-push` | `authenticated` | Expo push bildirim gönderir |
| `daily-summary-push` | pg_cron tetikler | Günlük özet push bildirimi |

## shops.status yaşam döngüsü

```
register-shop (edge fn) → status='pending'
       ↓
Admin paneli /admin → approveShop() action → status='active'
                    → rejectShop()  action → status='rejected'
```

- Yeni dükkanlar **her zaman** `pending` başlar — `register-shop` bunu enforce eder.
- `active` olmayan dükkanın sahibi `invite-barber` çağıramaz.
- Admin panel `/admin` route'u Next.js Server Actions kullanır, `ADMIN_SECRET_KEY` env var ile korunur (`timingSafeEqual` karşılaştırma).
- Onay sonrasında dükkan sahibine Expo push bildirimi gönderilir (`staff.push_token` varsa).

## Davet akışı

```
Dükkan sahibi → POST /invite-barber
  → invite_tokens tablosuna UUID token INSERT
  → PUBLIC_INVITE_BASE_URL/{token} linki döner

Davetli mobil → /invite/[token] web sayfası
  → POST /open-invite ile token ön-doğrulama (auth olmadan)
  → Uygulamayı açmak için deep link

Davetli mobil → POST /accept-invite (authenticated)
  → Token tüketilir (used_at SET, idempotent)
  → staff kaydı oluşturulur (slug otomatik üretilir, conflict safe)
```

- `invite_tokens.expires_at` = oluşturma + 48 saat.
- `open-invite` sadece geçerli/kullanılmamış/süresi dolmamış token'ları `valid: true` döner; auth gerektirmez.
- `accept-invite` race condition safe: `UPDATE ... IS NULL used_at` + 23505 fallback.

## Repo-specific conventions

- Slot granülaritesi `packages/shared/src/constants.ts`'deki `SLOT_GRANULARITY_MIN` sabitiyle değiştirilir, `slot-utils.ts`'e hardcode edilmez.
- `working_hours` JSONB formatı: `{"mon": {"open": "09:00", "close": "19:00", "enabled": true}, ...}`. Ayrı tablo yok.
- Edge functions Deno runtime'da çalışır — Node.js import'ları değil `https://esm.sh/` ve `https://deno.land/std/` kullan.
- Supabase tipleri her şema değişikliğinden sonra **iki yere** üretilir:
  ```bash
  supabase gen types typescript --local > packages/db/src/database.types.ts
  cp packages/db/src/database.types.ts supabase/functions/_shared/database.types.ts
  ```

## Important locations

| Dosya | Açıklama |
|---|---|
| `packages/shared/src/slot-utils.ts` | **Tek kaynak** availability algoritması — tüm edge fn'ler kullanır |
| `packages/shared/src/types.ts` | `WorkingHours`, `Slot`, `OccupiedRange` tipleri |
| `packages/shared/src/constants.ts` | `SLOT_GRANULARITY_MIN`, `MIN_BOOKING_NOTICE_MINUTES` vb. |
| `supabase/functions/import_map.json` | `@berber/shared/*` → `packages/shared/src/*` Deno alias'ı |
| `supabase/functions/_shared/supabase-admin.ts` | Service role client + SHA256 hash helper |
| `supabase/functions/_shared/cors.ts` | `corsOptions()`, `json()`, `error()` response helpers |
| `supabase/functions/block-walkin/index.ts` | Widget auth + block INSERT |
| `supabase/functions/widget-get-availability/index.ts` | `computeAvailableSlots` çağrısı |
| `supabase/functions/invite-barber/index.ts` | Davet token üretimi |
| `supabase/functions/open-invite/index.ts` | Token ön-doğrulama (auth gerektirmez) |
| `supabase/functions/accept-invite/index.ts` | Token tüketme + staff oluşturma |
| `supabase/functions/register-shop/index.ts` | Dükkan başvurusu (pending → admin onayı) |
| `apps/web/src/app/admin/actions.ts` | Shop onay/red Server Actions (ADMIN_SECRET_KEY korumalı) |
| `apps/web/src/app/invite/[token]/page.tsx` | Web davet sayfası → deep link |
| `packages/db/src/database.types.ts` | Auto-generated Supabase tipleri (kaynak) |
| `supabase/functions/_shared/database.types.ts` | Yukarının kopyası — edge fn'lerin kullandığı |
| `supabase/migrations/` | ~60 migration — tüm şema burada |

## Required env vars

| Değişken | Kimin için |
|---|---|
| `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` | Tüm edge fn'ler |
| `PUBLIC_INVITE_BASE_URL` | `invite-barber` — davet link base URL |
| `ADMIN_SECRET_KEY` | Admin panel Server Actions |
| `ADMIN_EMAIL`, `RESEND_API_KEY`, `SYSTEM_FROM_EMAIL` | `register-shop` — email bildirimi |
| `ADMIN_EXPO_PUSH_TOKEN` | `register-shop` — admin push bildirimi |

## Change safety rules

- `slot-utils.ts` değişikliği → `packages/shared/src/slot-utils.ts` güncelle, tüm edge fn'ler etkilenir.
- `appointment_slots` tablo yapısı değişirse: hem trigger fonksiyonunu hem `database.types.ts` (iki kopya) güncelle.
- `barbers.working_hours` JSONB şemasını değiştirirsen `WorkingHours` tipini `packages/shared/src/types.ts`'de güncelle.
- `staff_schedules` değişikliği → `widget-get-availability` ve `get_occupied_ranges` RPC bu tablodan beslenir.
- `invite_tokens` şeması değişirse: `open-invite`, `accept-invite`, `invite-barber` üçü de etkilenir.
- Edge function JWT verify ayarları `supabase/config.toml`'da: `block-walkin`, `widget-book-appointment`, `widget-get-availability`, `open-invite` → `verify_jwt = false`.

## Known gotchas

- `gist exclude` constraint sadece `status = 'confirmed'` için aktif — `cancelled` randevunun saatine yeni randevu alınabilir (intentional).
- `computeAvailableSlots()` geçmişte kalan slotları `BOOKING_GRACE_PERIOD_MIN` (5 dk) grace period ile filtreler.
- `app-book-appointment` edge fn, PostgreSQL `23P01` error code'u ile gist constraint ihlalini yakalar — bu kodu değiştirme.
- Supabase Realtime subscription'larında VIEW kullanılamaz — `appointment_slots` ayrı tablo + trigger pattern'i bu yüzden var.
- `Intl.DateTimeFormat` `localTimeToUTC()` içinde DST geçişlerini doğru handle eder; manuel offset hesaplamasıyla değiştirme.
- `invite-barber`, `shops.status` kolonu DB'de yoksa (eski ortam) 42703 hatasını yakalar ve graceful fallback uygular — bu fallback kodu kaldırma.
- `accept-invite` idempotent'tir: kullanıcı zaten o dükkan'ın staff'ıysa token tüketilir ve mevcut kayıt döner, yeni kayıt oluşturulmaz.

https://github.com/yekedun/siradaki github linki bu 