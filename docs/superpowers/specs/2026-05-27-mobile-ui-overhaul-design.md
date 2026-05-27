# Sıradaki Mobile UI Overhaul — Design Spec

## Goal

Komponent-önce, ekran-sonra kapsamlı mobile UI yenileme. Mevcut renk paleti ve navigasyon yapısı korunuyor. Dark mode kaldırılıyor. Hedef: tutarlı spacing hiyerarşisi, güvenli safe area yönetimi, "sade güzellik" — Akbank kalitesinde restrained elegance.

## Tasarım Prensipleri

- **Kullanışlılık önce** — her değişiklik ergonomiyi korur ya da iyileştirir
- **Sade güzellik** — her element bir amaca hizmet eder, dekorasyon yok ama işlenmiş
- **Tutarlılık** — aynı pattern her ekranda aynı şekilde uygulanır
- **Light mode only** — dark mode prop/variant'ları tamamen kaldırılır

## Tasarım Dili Kuralları

### Spacing Kanonu
| Kullanım | Değer |
|----------|-------|
| Sayfa yatay padding | 20px (spacing[5]) |
| OverlineHeader üst padding | `useSafeAreaInsets().top + 12px` |
| OverlineHeader alt padding | 16px |
| Section'lar arası boşluk | 24px (spacing[6]) |
| Kart iç padding | 14px |
| Liste item'lar arası gap | 10px |
| Chip row yatay padding | 20px, dikey 4px |

### Kart Anatomisi (evrensel kural)
```
backgroundColor: colors.slate[0]
borderWidth: 1
borderColor: colors.slate[200]
borderRadius: radius.md (12px)
padding: 14
...shadows.xs
```
Yükseltilmiş kart (Sheet, Modal): `shadows.sm`

### Tipografi Hiyerarşisi
- **Eyebrow/Overline**: 11px Montserrat-SemiBold, letterSpacing 1.76, uppercase, slate[500]
- **Sayfa başlığı**: 32px Montserrat-Bold, letterSpacing -0.64, ink[900]
- **Meta**: 13px Montserrat-Regular, slate[500], marginTop 8
- **Section label**: 11px Montserrat-SemiBold, uppercase, slate[400]
- **Body**: 15px Montserrat-SemiBold, ink[900]
- **Caption**: 12px Montserrat-Regular, slate[500]

### Renk Kuralları
- Disabled text: slate[400] (şu an slate[500] ile karışıyor — netleştirilecek)
- Secondary text / meta: slate[500]
- Tertiary / placeholder: slate[300]
- Divider / hairline: slate[200]
- Sunken bg: slate[100]

---

## Faz 1: DS Komponent Güncellemeleri

### 1.1 OverlineHeader
**Değişiklikler:**
- `dark` prop ve tüm dark variant stilleri kaldırılır
- `paddingTop: 8` → `paddingTop: useSafeAreaInsets().top + 12` (safe area aware)
- `trailing` prop korunur
- `meta` alt boşluk: marginTop 6px → 8px (hafif daha nefes aldıracak)

**Sonuç:** Her ekranın header'ı safe area'yı otomatik handle eder, "Dükkan Özet" artık too-close-to-top olmaz.

### 1.2 SectionLabel
**Değişiklikler:**
- marginBottom: 10px korunur (zaten tutarlı; bazı ekranlar `style` prop ile override eder — bu davranış değişmez)
- color: `slate[500]` → `slate[400]` (bilinçli değişiklik — section etiketler daha de-emphasized, içerik öne çıkar)
- Diğer değerler değişmez: fontSize 11, SemiBold, uppercase, marginTop 24

### 1.3 KpiCard (owner/index'teki inline komponent)
**Değişiklikler:**
- `dark` prop kaldırılır
- Dark-only shadow (`0 8px 24px -8px rgba(11,18,32,0.55)`) kaldırılır
- Tek shadow kuralı: `shadows.xs` (default), `shadows.sm` (accent/featured kart)
- Accent kart background: `colors.ink[900]` light modda da korunur (daha premium görünüm için)

### 1.4 TextField
**Değişiklikler:**
- `focus` state: borderColor `colors.brand[600]`, borderWidth 1.5 (şu an tutarsız)
- Label: 12px Montserrat-SemiBold, slate[500] — standartlaştırılır
- Error state: borderColor `colors.coral[600]`, hata mesajı altında coral[600] 12px

### 1.5 Button — Yeni `google` Variant
**Değişiklikler:**
- Yeni `variant='google'` eklenir: slate[0] bg, slate[200] border, ink[900] text
- Google logosu için `leftIcon` prop eklenir (opsiyonel ReactNode) — bu sprint'te text-only kabul edilebilir, icon sonraya bırakılabilir
- Bu variant login ve register'daki Google butonunu standartlaştırır

### 1.6 Sheet
**Değişiklikler:**
- borderTopLeftRadius ve borderTopRightRadius: `radius.lg` (18px) → `radius.xl` (24px)
- paddingTop: 20px (drag handle dahil)
- Drag handle: 40×4px (width 40, height 4), slate[200] bg, borderRadius 4, marginBottom 14px — değişmez; sadece radius.xl geçişi

---

## Faz 2: Auth Ekranları

### 2.1 Login (`(auth)/login.tsx`)
**Sorun:** Google butonu CTA'nın üstünde, Giriş Yap altında. Klavye açılınca Giriş Yap ekran dışına kayar, kullanıcı Google'a yanlışlıkla basar.

**Fix — CTA sırası değişir:**
```
[Error mesajı — varsa]
[Giriş Yap — variant="primary", size="lg", full]   ← klavyeyle birlikte kalır
[— veya — divider]
[Google ile Giriş Yap — variant="google", size="lg", full]  ← klavye açılınca dışarı çıkar (OK)
[Hesabın yok mu? Kayıt ol — footer]
```

**Ek değişiklikler:**
- `paddingTop: 20` → SafeAreaView ile sarılır (status bar overlap fix)
- `marginTop: 60` (topArea) → `marginTop: 40` (safe area üstü hallolunca bu kadar yeterli)
- Her iki buton da `loading` durumunda disable olur (şu an sadece email butonu)

### 2.2 Register (`(auth)/register.tsx`)
**Değişiklikler:**
- Login ile aynı SafeAreaView tedavisi
- marginTop: 8 → 40 (safe area sonrası)
- CTA: "Hesap Oluştur" tek buton, altında sadece footer link — Google yok (register farklı akış)
- Fine print (legal) text: slate[400] korunur (slate[300] beyaz üzerinde WCAG AA'yı kaybeder)

### 2.3 Pending (`(auth)/pending.tsx`)
- SafeAreaView tedavisi
- Spacing polish

### 2.4 Google Onboarding (`(auth)/google-onboarding.tsx`)
- SafeAreaView tedavisi
- TextField spacing canonicalized

---

## Faz 3: Owner Ekranları

### 3.1 Owner/Index — Özet (`(owner)/index.tsx`)
**Sorunlar:** "Dükkan Özet" çok üstte, dark mode kodu karmaşıklaştırıyor, section spacing tutarsız.

**Değişiklikler:**
- `OverlineHeader` dark prop kaldırılır (1.1 sayesinde safe area otomatik)
- KPI kartlardan dark mode kodu sökülür (inline dark: conditional'lar kaldırılır)
- `ScrollView` `paddingTop: 0` (OverlineHeader kendi padding'ini manage eder)
- Section'lar arası gap: 24px sabitlenir
- "Öngörüler" kartı: kart anatomisi standardize edilir (14px padding, shadows.xs)
- "Usta Bazında" kartları: gap 8, padding 12 — değişmez

### 3.2 Agenda (`(owner)/agenda.tsx`)
**Değişiklikler:**
- OverlineHeader dark prop kaldırılır
- ScrollView `paddingBottom: 100` (FAB üstü) — korunur
- Kolon header (usta adı + meta): 15px Bold name, 11px meta — değişmez, sadece spacing
- Column gap: 12 → tutarlı
- FAB: `bottom: 90, right: 20, shadows.md` — standardize edilir
- Empty drop zone: mevcut `brand[600]` stili korunur

### 3.3 Earnings (`(owner)/earnings.tsx`)
**Sorun:** Ekrandaki `Chip` local komponent, DS Chip'i kullanmıyor.

**Değişiklikler:**
- Local `Chip` ve `ChipProps` kaldırılır
- DS `Chip` import edilir: `import { Chip, ChipRow } from '../../components/ds/Chip'`
- Period seçici `ChipRow` ile sarılır
- Hero KPI kart: kart anatomisi standardize (ink[900] bg accent kart için korunur)
- "Personel Dağılımı" section: SectionLabel + kart anatomisi standardize
- ScrollView paddingBottom: 40 (tab bar clearance)
- OverlineHeader dark prop kaldırılır

### 3.4 Team (`(owner)/team.tsx`)
**Değişiklikler:**
- OverlineHeader dark prop kaldırılır
- Staff row kart anatomisi standardize (14px padding, shadows.xs, radius.md)
- `StaffEditSheet`: Sheet komponent güncellemesi (1.6) uygulanır — radius.xl
- İnvite link kutusu: monospace font, slate[100] bg, radius.sm, padding 12px
- "Personel ekle" trailing button: Button variant="secondary" size="sm"

### 3.5 Settings (`(owner)/settings.tsx`)
**Değişiklikler:**
- OverlineHeader dark prop kaldırılır
- Section kartları kart anatomisi standardize (14px padding)
- Toggle row: paddingVertical 14px, borderBottom slate[100] divider
- Son row'da borderBottom kaldırılır
- ProfileEditorSheet: Sheet radius.xl, TextField consistency
- HoursEditorSheet: Sheet radius.xl, day tab grid radius.sm
- "Çıkış yap" button: `variant="danger"` — değişmez, full width, marginTop 8

### 3.6 Services (`(owner)/services.tsx`)
**Değişiklikler:**
- OverlineHeader dark prop kaldırılır
- Service row: kart anatomisi standardize, opacity 0.55 inactive korunur
- Status dot: 8×8px — değişmez
- FAB: shadows.md, brand[600] — değişmez
- ServiceSheet: Sheet radius.xl, DurPicker radius.sm

---

## Faz 4: App (Barber) Ekranları

### 4.1 App/Index — Randevular (`(app)/index.tsx`)
**Değişiklikler:**
- SafeAreaView → kendi DayPicker + ScrollView kombinasyonu, OverlineHeader safe area aldı
- Section label spacing standardize (marginTop 12, marginBottom 4)
- AppointmentCard gap: 8 → 10 (canonicalize)
- BlokCard aynı gap
- FAB: `bottom: 90, right: 20, shadows.md`
- Empty state: brand[600] icon, başlık/body/cta — değişmez

### 4.2 App/Settings (`(app)/settings.tsx`)
- Login/register ile aynı SafeAreaView tedavisi
- TextField + Button spacing canonicalize

### 4.3 Block (`(app)/block.tsx`)
- OverlineHeader dark prop kaldırılır (mevcut: `eyebrow="Blok Ekle" title="Takvimi Kapat"`)
- Form spacing canonicalize (duration grid padding 20px, SectionLabel marginTop tutarlı)

---

## Faz 5: AddAppointmentModal
**Değişiklikler:**
- Sheet komponent güncellemesi (1.6) uygulanır
- Chip seçimler: DS Chip kullanımı standardize
- Section spacing canonicalize

---

## Kapsam Dışı (Bu Sprint)

- Dark mode (ayrı sprint)
- Web booking sayfası
- Navigation yapısı değişikliği
- Yeni özellik ekleme
- Animasyon / transition değişiklikleri

---

## Dosya Listesi

**Modify:**
- `apps/mobile/components/ds/OverlineHeader.tsx`
- `apps/mobile/components/ds/SectionLabel.tsx`
- `apps/mobile/components/ds/TextField.tsx`
- `apps/mobile/components/ds/Button.tsx`
- `apps/mobile/components/ds/Sheet.tsx`
- `apps/mobile/app/(auth)/login.tsx`
- `apps/mobile/app/(auth)/register.tsx`
- `apps/mobile/app/(auth)/pending.tsx`
- `apps/mobile/app/(auth)/google-onboarding.tsx`
- `apps/mobile/app/(owner)/index.tsx`
- `apps/mobile/app/(owner)/agenda.tsx`
- `apps/mobile/app/(owner)/earnings.tsx`
- `apps/mobile/app/(owner)/team.tsx`
- `apps/mobile/app/(owner)/settings.tsx`
- `apps/mobile/app/(owner)/services.tsx`
- `apps/mobile/app/(app)/index.tsx`
- `apps/mobile/app/(app)/settings.tsx`
- `apps/mobile/app/(app)/block.tsx`
- `apps/mobile/components/AddAppointmentModal.tsx`
