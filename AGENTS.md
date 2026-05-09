# AGENTS.md

## Must-follow constraints

- **pnpm only** — `npm` veya `yarn` kullanma. Workspace `pnpm-workspace.yaml` ile yönetiliyor.
- **`@berber/shared` tek kaynak.** Edge fonksiyonları `supabase/functions/import_map.json` üzerinden `@berber/shared/slot-utils`, `@berber/shared/types`, `@berber/shared/constants` aliaslarıyla `packages/shared/src/*` dosyalarını doğrudan import eder. `_shared/slot-utils.ts` ve `_shared/types.ts` ARTIK YOK — tek kopyayı `packages/shared/src/`'de güncelle. `database.types.ts` hâlâ iki kopya (Supabase generator ürettiği için manuel sync — `cp packages/db/src/database.types.ts supabase/functions/_shared/database.types.ts`).
- **Shared paket dosyalarında relative import'lar `.ts` uzantılı olmak zorundadır** (Deno gereği). `tsconfig.base.json`'da `allowImportingTsExtensions: true` ayarlı; Next.js + Expo + tsc bu uzantıyı sorunsuz işler.
- **`btree_gist` extension** migration'lardan önce aktif olmalı; `001_initial.sql` bunu içeriyor, kaldırma.
- **`widget_tokens.token_hash`** alanına raw token YAZILMAZ — her zaman SHA256 hash (`sha256()` fonksiyonu `supabase/functions/_shared/supabase-admin.ts`'de).
- **`appointments` tablosuna** müşteri tarafından doğrudan INSERT olmaz — her zaman `book-appointment` edge function (service role) üzerinden.
- **`appointment_slots` mirror tablo** — `appointments`'a INSERT/UPDATE/DELETE olduğunda trigger ile senkronize edilir. Anon Realtime subscription'ları için zorunlu (VIEW kullanılamadı çünkü RLS view yerine altındaki tablodan değerlendirilir). `appointment_slots`'a manuel INSERT YAPMA — sadece `sync_appointment_slots` trigger'ı yazar.
- Yeni migration eklerken `gist exclude` constraint'lerinin bozulmadığını `supabase db push` ile doğrula.
- `apps/mobile/lib/widget-bridge.ts` içindeki `NativeWidgetModule.setWidgetToken(token, supabaseUrl)` her iki platformda da 2 parametre alır — biri eksik bırakılırsa Android tarafında URL kaybolur.

## Validation before finishing

```bash
pnpm turbo type-check                                           # TS hataları
supabase db reset                                               # Migration'ları sıfırdan uygula
supabase functions serve block-walkin --env-file .env.local     # Edge fn lokal test
cd apps/mobile && expo start                                    # Mobil derleme
```

## Repo-specific conventions

- Slot granülaritesi `packages/shared/src/constants.ts`'deki `SLOT_GRANULARITY_MIN` sabitiyle değiştirilir, `slot-utils.ts`'e hardcode edilmez.
- `working_hours` JSONB formatı: `{"mon": {"open": "09:00", "close": "19:00", "enabled": true}, ...}`. Ayrı tablo yok.
- Edge functions Deno runtime'da çalışır — Node.js import'ları değil `https://esm.sh/` ve `https://deno.land/std/` kullan.
- Supabase tipleri her şema değişikliğinden sonra **iki yere** üretilir:
  ```bash
  supabase gen types typescript --local > packages/db/src/database.types.ts
  cp packages/db/src/database.types.ts supabase/functions/_shared/database.types.ts
  ```
- Mobil deeplink scheme: `berberapp://` — `app.json`'da tanımlı.
- iOS App Group identifier: `group.com.berberapp` — `app.json`, Swift kodu, Expo plugin'de aynı string olmalı.
- Edge function JWT verify ayarları `supabase/config.toml`'da: `block-walkin` ve `book-appointment` `verify_jwt = false` (custom auth/anon).

## Important locations

| Dosya | Açıklama |
|---|---|
| `packages/shared/src/slot-utils.ts` | **Tek kaynak** availability algoritması (web + mobile + edge) |
| `supabase/functions/import_map.json` | `@berber/shared/*` → `packages/shared/src/*` Deno alias'ı |
| `supabase/functions/block-walkin/index.ts` | Widget auth + block INSERT (core differentiator) |
| `packages/db/migrations/001_initial.sql` | Tablolar + `appointment_slots` mirror + Realtime publication |
| `packages/db/migrations/003_functions.sql` | `sync_appointment_slots` trigger |
| `packages/db/migrations/20260509_staff_schedules.sql` | Personel çalışma saatleri + mola altyapısı |
| `apps/mobile/modules/widget/ios/BarberWidget.swift` | iOS WidgetKit — AppIntent + iOS 16 deeplink fallback |
| `apps/mobile/modules/widget/android/BlockActionReceiver.kt` | Android widget → edge fn çağrısı |
| `apps/mobile/modules/widget/plugin/index.js` | `expo prebuild` sırasında native dosyaları yerleştiren plugin |
| `apps/mobile/lib/widget-bridge.ts` | Token üretme + native modüle köprü |
| `apps/mobile/components/StaffScheduleModal.tsx` | Personel çalışma saatleri yönetim arayüzü |

## Change safety rules

- `slot-utils.ts` değişikliği → tek dosya (`packages/shared/src/slot-utils.ts`) hem web/mobile hem edge fonksiyonlarını besler. `book-appointment/index.ts` server-side revalidation'ı aynı kodu çalıştırır.
- iOS 16 deeplink fallback (`berberapp://block?duration=...`) ve iOS 17+ AppIntent her ikisi de korunmalı.
- `appointment_slots` tablo yapısı (kolonlar) değişirse: hem trigger fonksiyonunu hem `BookingFlow.tsx` realtime handler'ını hem `database.types.ts` (iki kopya) hem de `_shared/database.types.ts`'i güncelle.
- `blocks` tablosuna DELETE policy eklenirse `BookingFlow.tsx`'teki `event: '*'` subscription'ını test et — handler tüm event tiplerini bekliyor.
- `barbers.working_hours` JSONB şemasını değiştirirsen `WorkingHours` tipini `packages/shared/src/types.ts`'de güncelle. Not: `staff_schedules` tablosu bu saati ezer (override).
- `staff_schedules` değişikliği → `get-availability` edge function ve `get_occupied_ranges` RPC bu tablodan beslenir.
- `iOS NativeWidgetModule.swift` imzasını değiştirirsen `.m` bridging dosyasını da, ayrıca Android Kotlin tarafını da hizala.

## Known gotchas

- `gist exclude` constraint sadece `status = 'confirmed'` için aktif — `cancelled` randevunun saatine yeni randevu alınabilir (intentional). `sync_appointment_slots` trigger'ı da non-confirmed satırları mirror'dan kaldırır.
- iOS widget token, App Group (`group.com.berberapp`) UserDefaults'ta; Android'de `berber_widget_prefs` SharedPreferences'ta. `widget-bridge.ts` her iki platformda da `setWidgetToken(token, url)` çağırır — native modüller URL'yi kendi storage'larına yazar.
- `computeAvailableSlots()` geçmişte kalan slotları `BOOKING_GRACE_PERIOD_MIN` (5 dk) grace period ile filtreler.
- `book-appointment` edge fn, PostgreSQL `23P01` error code'u ile gist constraint ihlalini yakalar — bu kodu değiştirme.
- Supabase Realtime subscription'larında VIEW kullanılamaz çünkü RLS altındaki tablodan değerlendirilir → `appointment_slots` ayrı tablo + trigger pattern'i bu yüzden var.
- `Intl.DateTimeFormat` `localTimeToUTC()` içinde DST geçişlerini doğru handle eder; bu helper'ı manuel offset hesaplamasıyla değiştirme.
- iOS WidgetKit extension EXPO_PUBLIC env var'larına erişemez → `NativeWidgetModule.swift` Supabase URL'yi `setWidgetToken` çağrısında parametre olarak alır, App Group UserDefaults'a yazar.
- iOS WidgetKit extension target'ını eklemek tam otomatize değil — `expo prebuild` sonrası Xcode'da manuel target eklemesi gerekir (plugin sadece Android'i ve iOS bridging modülünü yapar).
