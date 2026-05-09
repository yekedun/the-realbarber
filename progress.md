# Project Progress

## 1. Current Status
- Tüm kod yazıldı, kritik 3 mimari hata düzeltildi (edge fn import path, anon Realtime, widget bridge signature)
- **Multi-seat & Personel Çalışma Saatleri (v1.2)** başarıyla uygulandı: `staff_schedules` altyapısı, mola desteği ve dükkan sahibi yönetim arayüzü tamam.
- OPTIMIZATIONS.md denetiminden çıkan 12 bulgu uygulandı (F-01..F-12); D-01 (F-02 + F-03 kalıcı çözümü) tamamlandı
- Supabase projesi oluşturuldu; migration'lar uygulandı (`supabase db push` ✓)
- `pnpm turbo type-check` %100 başarılı; cast'ler (`as any`) temizlendi.

---

## 2. Completed

### Infrastructure
- `package.json` (root), `pnpm-workspace.yaml`, `turbo.json`, `tsconfig.base.json`
- `.env.example`, `.gitignore`, `AGENTS.md`, `OPTIMIZATIONS.md`, `supabase/config.toml`, `apps/mobile/eas.json`

### packages/shared
- `src/constants.ts`, `src/types.ts`
- `src/slot-utils.ts` — DST-safe `Intl.DateTimeFormat` + F-10 timestamp optimizasyonu

### packages/db
- `migrations/001_initial.sql` — tablolar + `appointment_slots` mirror + Realtime publication
- `migrations/002_rls_policies.sql` — RLS; `appointment_slots` public read, write yok
- `migrations/003_functions.sql` — `get_occupied_ranges()`, `handle_updated_at`, `sync_appointment_slots` trigger
- `migrations/004_optimizations.sql` — D-02 `get_occupied_ranges` index-friendly range filter + D-04 `pg_cron` ile `widget_tokens` günlük temizlik
- `migrations/20260508_multi_seat_and_admin.sql` — Çoklu personel desteği + admin rolleri
- `migrations/20260509_staff_schedules.sql` — Personel bazlı çalışma ve mola saatleri
- `src/database.types.ts` — CLI ile üretilmiş tam güvenli tipler (as any temizlendi)

### supabase/functions
- `_shared/cors.ts`, `_shared/supabase-admin.ts`, `_shared/database.types.ts`
- `import_map.json` — D-01: `@berber/shared/{slot-utils,types,constants}` → `packages/shared/src/*` (tek kaynak)
- `get-availability/index.ts` — F-11 RPC error handling
- `book-appointment/index.ts` — F-11 RPC error handling, server-side revalidation, 409 on race
- `block-walkin/index.ts` — widget_token (SHA256) auth + blocks INSERT
- `create-widget-token/index.ts` — JWT auth + UUID token

### apps/web
- `package.json`, `tsconfig.json`, `next.config.ts` (F-06 remotePatterns), `tailwind.config.ts`, `postcss.config.js`
- `src/lib/supabase-server.ts`, `supabase-browser.ts`
- `src/app/layout.tsx`, `globals.css`, `not-found.tsx`
- `src/app/[slug]/page.tsx` — F-01 unstable_cache + F-06 next/image + D-03 ISR (`revalidate=60`, `generateStaticParams`)
- `src/app/[slug]/BookingFlow.tsx` — F-08 useMemo client + F-09 useMemo dateOptions + F-12 daraltılmış deps
- `src/app/api/availability/route.ts` — F-07 Cache-Control + F-11 RPC error
- `src/components/ServiceSelector.tsx`, `SlotGrid.tsx`, `BookingModal.tsx`

### apps/mobile
- `package.json`, `app.json` (with widget plugin), `tsconfig.json`, `eas.json`
- `lib/supabase.ts`, `lib/widget-bridge.ts`
- `app/_layout.tsx`, `(auth)/login.tsx`, `(app)/_layout.tsx`
- `(app)/index.tsx` — F-04 limit/horizon + F-05 INSERT/UPDATE/DELETE handler + **Staff Picker**
- `(app)/block.tsx`, `settings.tsx`, `team.tsx`
- `components/StaffScheduleModal.tsx` — Personel saat yönetimi
- `components/AppointmentDetailSheet.tsx` — Detay ve aksiyonlar

### Widget
- iOS: `BarberWidget.swift`, `NativeWidgetModule.swift` + `.m` bridging
- Android: `BarberWidgetProvider.kt`, `BlockActionReceiver.kt`, `NativeWidgetModule.kt`
- `res/layout/barber_widget.xml`, `xml/barber_widget_info.xml`, `drawable/widget_background.xml`, `values/strings.xml`
- `AndroidManifest.snippet.xml`, `build.gradle.snippet`
- `NativeWidgetModule.ts` — RN bridge (graceful fallback)
- `plugin/index.js` — Expo config plugin (Android tam, iOS bridging tam)

---

## 3. In Progress

_(Aktif geliştirme yok)_

---

## 4. Pending / TODO

### Supabase Deploy (kullanıcı tarafı)
- [ ] Supabase hesabı + proje oluştur
- [ ] `.env.local` (root + apps/web + apps/mobile) credentials gir
- [ ] `supabase db push` — 4 migration uygula (001..004)
- [ ] Supabase Dashboard → Database → Extensions: `pg_cron` etkin değilse 004 öncesi etkinleştir
- [ ] `supabase gen types typescript --local > packages/db/src/database.types.ts && cp ... _shared/`
- [ ] `supabase functions deploy`

### Mobil Native Build
- [ ] `cd apps/mobile && pnpm expo prebuild` — Android otomatik
- [ ] iOS Xcode'da WidgetKit target manuel ekle (BarberWidget extension, App Group entitlement)
- [ ] `eas build --profile development --platform all`

### Açık Optimizasyon Bulguları
- [x] **F-02 + F-03 (D-01):** ✅ Tamamlandı — Deno `import_map.json` ile `@berber/shared/*` tek kaynak (npm: yerine relative path; publish gerektirmiyor)
- [x] **D-02:** ✅ Tamamlandı — `004_optimizations.sql`: `get_occupied_ranges` `::date` cast yerine range filter; mevcut `(barber_id, starts_at)` index'i kullanılır. Deploy sonrası `EXPLAIN ANALYZE` ile doğrula.
- [x] **D-03:** ✅ Tamamlandı — `apps/web/src/app/[slug]/page.tsx`'e `export const revalidate = 60`, `dynamicParams = true` ve `generateStaticParams` eklendi (build-time prerender + ISR)
- [x] **D-04:** ✅ Tamamlandı — `004_optimizations.sql`: `pg_cron` extension + günlük 03:00 UTC `widget_tokens` temizlik job'u (idempotent unschedule)

### Test (kullanıcı tarafı)
- [ ] Müşteri tarayıcısı + berber telefonu eşzamanlı: widget tıkla → web'de slot < 500ms gri
- [ ] İki tarayıcı aynı slotu aynı anda book et → birine 409
- [ ] DST geçişi haftası slot algoritma testi

---

## 5. Issues / Blockers

- **`database.types.ts` hand-written, iki kopya** — `supabase gen types` ile üretip iki yere kopyala (AGENTS.md).
- **iOS WidgetKit extension target manuel** — Expo plugin xcodeproj manipülasyonunu desteklemiyor; Xcode'da elle adım var.
- **Supabase proje credentials yok** — `.env.local` doldurulması gerekli.

---

## 6. Decisions Made

| Karar | Gerekçe |
|---|---|
| `working_hours` → JSONB | Şema migration olmadan günlük çalışma saati değişikliği |
| Widget → SHA256-hashed token, JWT değil | Widget extension ayrı process; token refresh yapamaz |
| `gist exclude` constraint | DB seviyesinde double-booking son savunma |
| `appointment_slots` mirror tablo (VIEW yerine) | Realtime postgres_changes RLS'i altındaki tablodan değerlendirir |
| `@berber/shared` Deno import_map ile tek kaynak (D-01) | npm publish gerektirmeyen yaklaşım; relative path import_map ile resolve edilir, `.ts` uzantısı zorunlu |
| `Intl.DateTimeFormat`-tabanlı timezone helper | DST geçişlerinde doğru çalışır |
| `book-appointment` → 409 on `23P01` | Race condition'ı validation error'dan ayırt eder |
| Widget bridge: `setWidgetToken(token, url)` 2 paramlı | iOS extension EXPO env var'larına erişemez |
| `unstable_cache` + 60s TTL | F-01: profile sorgusu tekrar tekrar DB'ye gitmesin |
| API'da `Cache-Control: s-maxage=30, swr=60` | F-07: Realtime zaten anlık; API initial state için yeterli cache |
| Loop içinde tüm timestamp aritmetiği | F-10: tipik 20×10 = 400 → 10 `new Date` allocation |

---

## 7. Next Step

Supabase projesi oluştur → `.env.local` doldur → `supabase db push && supabase functions deploy` → `pnpm dev` ile web'i test et.

---

## 8. Notes

- Berber kaydı v1'de Supabase Dashboard'dan `auth.users` + `barbers` satırı manuel.
- Expo Go ile widget çalışmaz; `expo run:ios/android` veya EAS dev build gerekir. `NativeWidgetModule.ts` graceful fallback'lı.
- `book-appointment` `verify_jwt = false` çalışır; edge fn ek doğrulama yapar (slot revalidation, gist constraint).
- OPTIMIZATIONS.md'deki F-02, F-03 manuel sync riski — kısa vadede `AGENTS.md` belgelendirmesi yeterli, kalıcı çözüm D-01 (`npm:` specifier) test gerektirir.
