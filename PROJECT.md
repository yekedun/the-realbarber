# Berber Randevu — Proje Özeti

Berber dükkanları için online randevu sistemi. **Müşteri tarafı web** (slug ile profile gir, randevu al), **berber tarafı mobil** (günlük ajanda + slot bloklama + Android home-screen widget). Backend Supabase.

---

## Mimari

```
apps/web         Next.js 14 App Router · /[slug] (ISR 60s) · /api/availability
apps/mobile      Expo SDK 51 · expo-router · 4 ekran + Android widget (Kotlin)
packages/db      Supabase tip tanımları (CLI'den üretiliyor)
packages/shared  slot-utils (computeAvailableSlots), types, constants
supabase/        4 edge function + migrations + seed
                   - book-appointment (GIST 409 anti-double-book + staff-specific logic)
                   - block-walkin     (staff-based validation)
                   - create-widget-token
                   - get-availability (staff schedules + shop hours fallback)
```

Monorepo: pnpm workspaces, hoisted node-linker (`.npmrc`).

**Önemli teknik kararlar:**
- `appointments`↔`appointment_slots` ve `blocks`↔`block_slots` mirror tabloları — GIST exclusion constraint sadece slots üzerinde, INSERT/DELETE trigger ile cascade.
- 4 tablo da `supabase_realtime` publication'ında — mobil ve web'in canlı senkronu.
- Web ISR + on-demand SSR; cookie'siz raw client `unstable_cache` içinde (Next.js kısıtı).
- Mobil OTA: `eas update --branch preview` ile JS-only değişiklikler 30sn'de cihazlara iner. Native bağımlılık değişirse yeni build şart (`runtimeVersion: appVersion`).

---

## Tasarım dili

Repo kökündeki **`DESIGN.md`** + **`Designs/`** klasörü tek doğru kaynak. Toprak tonları reddedildi (2026-05-07). Soğuk palet:

```
bg #F8FAFC | surface #FFF | ink #111827 | muted #6B7280
hair #E5E7EB | past #D1D5DB
red #DC2626   (NOW indicator + today rozeti + danger)
blue #2563EB  (servis satırı + secondary)
navy #1E3A8A  (PRIMARY CTA / FAB)
```

**Sayfa envanteri** (DESIGN.md §8):
- **M1 Login** · **M2 Tab Bar** · **M3 Randevular** (timeline + barber pole + NOW pulse, ana ekran) · **M4 Slot Blokla** · **M5 Ayarlar**
- **W1 Root Layout** · **W2 Berber Profili** · **W3 Booking Flow** (W2 içinde) · **W4 Not Found**

`Designs/M*.html` ve `Designs/W*.html` dosyaları **birebir referans**. `Designs/m3.jsx` (= `Designs/app.jsx`) M3'ün çalışan React preview'u. `Designs/tokens.css` token kaynağı.

---

## Bu sprint'te yapılan (2026-05-07)

1. **Tasarım dili tek dosyada toplandı** — `DESIGN.md` + `Designs/` mockup seti hazırlandı (kullanıcı Open Design ile üretti).
2. **Token taşıması:**
   - `apps/mobile/lib/theme.ts` soğuk palete + `R` (radius) + `Shadow` recipe + `POLE_COLORS`.
   - `apps/web/tailwind.config.ts` aynı tokenler + radius + shadow + `pulse`/`barber-scroll` keyframes.
   - `apps/web/src/app/globals.css` :root tokenler + `.barber-pole`, `.pulse-dot`, `.eyebrow` utility'leri.
3. **Mobil ekranlar yeniden:**
   - `app/(auth)/login.tsx` — eyebrow + brand mark + kompakt form.
   - `app/(app)/_layout.tsx` — Feather ikonlar (calendar/slash/settings), navy aktif, header gizli.
   - `app/(app)/index.tsx` — m3.jsx birebir port: 7-day pill strip, past/future track, **horizontal segmented barber pole** (RN'de 135° gradient yok, kırmızı/beyaz/mavi/beyaz 6px stripe alternasyonu fallback'i), NOW row Animated pulse, DoneCard / UpcomingCard / BlockCard, FAB.
   - `app/(app)/block.tsx` — Şu An rozeti (animated pulse), 3-sütun süre grid, sebep radyo, önizleme.
   - `app/(app)/settings.tsx` — account card, widget token list, navy generate CTA, kırmızı çıkış.
   - `components/AppointmentDetailSheet.tsx` (yeni) — bottom sheet (Ara/Mesaj/Düzenle + İptal Et / Tamamlandı). M3 detay sheet'inin RN karşılığı.
   - `components/AddAppointmentModal.tsx` — local hardcoded paleti theme'e bağlandı.
4. **Web ekranlar yeniden:**
   - `app/[slug]/page.tsx` — 380px sticky ProfileCard + 1fr booking grid (mobil tek kolon).
   - `app/[slug]/BookingFlow.tsx` — numaralı bölüm kartları, 14-gün horizontal pill strip, "X'da Devam Et" CTA.
   - `components/{ServiceSelector,SlotGrid,BookingModal}.tsx` — yeni tokenler.
   - `app/not-found.tsx` — animated barber pole stripe + 404 hero.
5. **Native widget XML'inde kalan rust `#EA580C` → navy `#1E3A8A`** yapıldı (`modules/widget/android/res/layout/barber_widget.xml`).
6. **Bug fix: `BarberPole` segment height bug** — sadece track yüksekliğinin yarısı doluyordu, `POLE_STRIPE_H = 6` ile düzeltildi.

---

**Sprint 2: Multi-Seat & Granular Availability (2026-05-08)**

1. **Multi-Seat Altyapısı:** `staff` tablosuna `is_active` ve dükkan sahibi rolleri eklendi.
2. **Staff Schedules:** Her personel için 7 gün bazında `is_working`, `work_start/end` ve mola (`break_start/end`) desteği.
3. **Availability Engine:** `get-availability` artık personelin mola saatlerini ve izinli günlerini `get_occupied_ranges` üzerinden otomatik "dolu" sayıyor.
4. **Owner Dashboard:** Mobil uygulamaya Personel Seçici (Staff Picker) ve Team Management ekranı eklendi.
5. **Type Safety:** `database.types.ts` CLI ile senkronize edildi, tüm projedeki `as any` cast'leri temizlendi.

**Web tarafı ✓ test edildi**, kullanıcı yeni paleti web'de görüyor.
**Mobil tarafı ✗ henüz görünmüyor** — sebep aşağıda.

---

## Şu anki blocker

Yüklü Android APK **preview profile** build (Build #5, 2026-05-07). Preview build embedded JS bundle kullanır, **Metro'yu yok sayar**. Yeni tasarım için iki yol:

1. **OTA push** — `npx eas-cli update --branch preview --message "..."` (~30sn). App açılışta çeker. Native değişiklik yoksa en hızlı yol. Denedik ama kullanıcı raporuna göre değişiklik yansımadı; OTA komutunun başarılı olup olmadığını henüz birlikte doğrulamadık.
2. **Local development build** — `npx expo run:android`. Pixel_7 emülatöründe local APK derler, dev-client olarak Metro'ya bağlanır. İlk build 10dk, sonrası live reload.

(2)'yi denerken karşılaşılan sorunlar:
- Java 8 (32-bit) yüklüydü → Gradle 8.8 daemon başlamadı (heap ayrılamadı). **Çözüm:** `winget install Microsoft.OpenJDK.17` ile JDK 17 kuruldu.
- `ANDROID_HOME` set değil → Gradle SDK bulamıyor. Pixel_7 AVD çalıştığı için Android Studio kurulu. SDK yolu büyük ihtimalle `%LOCALAPPDATA%\Android\Sdk`. Kullanıcı bu env'i set edip yeniden denemedi henüz.

---

## Sıradaki adımlar

### Hemen
1. **Mobil değişiklikleri cihazda görmek.** `ANDROID_HOME` set + `npx expo run:android`. Veya kestirme: `npx eas-cli update --branch preview` çıktısını doğrula, app force-stop sonra reopen.
2. **Görsel kontrol:** M1→M5 ekranları, web'de W2 + booking + W4 — mockup'la birebir karşılaştır. Sapma varsa fix.
3. **TypeScript / lint:** `pnpm -w type-check` + `pnpm --filter @berber/web lint` — yeni Tailwind class'ları (`bg-bg`, `text-ink`, `rounded-card`, `shadow-cta` vs) Tailwind config'e ekledim ama kullanım yerlerinde IDE/tsserver tarafında uyarı çıkma ihtimali var.

### Yakın vadede (Faz A kapanışı)
4. **A5 device test:** Login (`emreyek29@gmail.com`), günlük ajanda, walk-in block, web↔mobile realtime sync, widget token oluşturma, home-screen widget walk-in.
5. **Splash/icon PNG'ler.** `apps/mobile/assets/{icon,splash,adaptive-icon}.png` muhtemelen eski (toprak ton) tasarım — yeniden çizilmeli.
6. **Push notifications** (v1.1'e ertelendi ama booking flow'da öneri eklenebilir — barber sadece app açıkken Realtime ile yeni randevuyu görüyor).

### Faz B — iOS (Mac gerekli)
- `expo prebuild --platform ios` → Xcode'da WidgetKit extension target manuel ekleme → EAS iOS build → cihaz testi. Swift source `apps/mobile/modules/widget/ios/BarberWidget.swift` hazır.

### Faz C — Production
- Vercel deploy (web), custom domain, EAS production build, store submission.

---

## Bilinmesi gereken kısıtlar

- **RN'de barber pole 135° diagonal değil** — `expo-linear-gradient` veya `react-native-svg` olmadan diagonal repeating pattern yok. Şu an 4px wide track içinde alternating renk stripleri (red/white/blue/white). m3.jsx web preview'unun visual'ını birebir karşılamıyor; "yeterince barber pole" hissi vermek için gerekirse `react-native-svg` ile pattern eklenebilir.
- **`expo-linear-gradient` yüklü değil** — avatar gradient mockup'ta var, şu an solid `blueSoft` kullanıyoruz.
- **EAS env vars:** preview/production build'ler `.env.local` görmez; `eas env:create` ile EAS env'e Supabase URL+anon key girilmesi şart yoksa app launch'ta crash eder (Build #1'de yaşandı).
- **pnpm hoisted linker zorunlu** (`.npmrc:node-linker=hoisted`) — RN settings.gradle plugin resolver'ı pnpm symlink'lerini yutamıyor.

---

## Önemli dosyalar

| Konu | Yol |
|---|---|
| Tasarım dili | `DESIGN.md`, `Designs/tokens.css`, `Designs/M*.html`, `Designs/W*.html`, `Designs/m3.jsx` |
| Mobil tema | `apps/mobile/lib/theme.ts` |
| Mobil ekranlar | `apps/mobile/app/(auth)/login.tsx`, `apps/mobile/app/(app)/{_layout,index,block,settings}.tsx` |
| Mobil bottom sheets | `apps/mobile/components/AppointmentDetailSheet.tsx`, `AddAppointmentModal.tsx` |
| Mobil widget native | `apps/mobile/modules/widget/{plugin/index.js,android/*,ios/*}` |
| Web tema | `apps/web/tailwind.config.ts`, `apps/web/src/app/globals.css` |
| Web ekranlar | `apps/web/src/app/{layout,not-found}.tsx`, `apps/web/src/app/[slug]/{page,BookingFlow}.tsx` |
| Web bileşenler | `apps/web/src/components/{ServiceSelector,SlotGrid,BookingModal}.tsx` |
| Edge functions | `supabase/functions/{book-appointment,block-walkin,create-widget-token,get-availability}/index.ts` |
| Slot logic | `packages/shared/src/slot-utils.ts` |
| EAS profilleri | `apps/mobile/eas.json` (`development` = dev-client, `preview` = embedded+OTA, `production` = embedded+OTA) |
| Optimizasyon notları | `OPTIMIZATIONS.md` (Audit #2 uygulanmış) |

---

## Komut hızlı referansı

```powershell
# Web dev
pnpm --filter @berber/web dev

# Mobil dev (Metro + dev-client APK kuruluysa)
pnpm --filter @berber/mobile start --dev-client --clear

# Mobil local build (emülatöre kurulum, dev-client'lı)
cd apps/mobile && npx expo run:android

# Mobil OTA push (preview kanalı)
cd apps/mobile && npx eas-cli update --branch preview --message "..."

# Mobil yeni preview APK
cd apps/mobile && npx eas-cli build --platform android --profile preview

# Tip kontrolü
pnpm -w type-check

# Supabase types yenile
pnpm db:sync     # packages/db/src/database.types.ts
```

---

## Supabase proje bilgisi

- Project ref: `yvxjandwfkaiwhbeslen`
- Edge functions: 4 ACTIVE
- Seed berber'lar: `emre` (id 039875c7…) ve `emrem` (id b8a3ae05…)
- Login test: `emreyek29@gmail.com`
- EAS account: `yekedun`, project ID `25ac450c-8b07-4703-805f-3d4fea1b8db7`
- OTA URL: `https://u.expo.dev/25ac450c-8b07-4703-805f-3d4fea1b8db7`
