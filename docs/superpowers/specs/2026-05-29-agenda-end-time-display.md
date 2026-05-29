# Spec: Ajanda Kartlarında Bitiş Saati Gösterimi

**Tarih:** 2026-05-29  
**Kapsam:** `AppointmentCard`, `BlokCard`, `agenda.tsx`, `appointment-mappers.ts`

## Sorun

Ajanda kartları yalnızca başlangıç saatini gösteriyor (`09:00`). Altında süre (`30 DK`) var ama bitiş saati yok. Berber, randevunun ne zaman biteceğini görmek için zihinsel hesap yapmak zorunda.

## Karar

`30 DK` sub-label'ı kaldırılıyor. Yerine bitiş saati (`09:45`) gösteriliyor. Süre bilgisi artık gösterilmiyor — başlangıç + bitiş yeterli.

## Görsel Sonuç

**Önce:**
```
09:00        Ahmet Yılmaz
30 DK        Saç + Sakal
```

**Sonra:**
```
09:00        Ahmet Yılmaz
09:45        Saç + Sakal
```

Time kolonu genişliği (`56px`) değişmez. Sub-label stili (`fontSize: 10, Montserrat-SemiBold, slate-500, marginTop: 5`) korunur; `letterSpacing` ve `textTransform: 'uppercase'` kaldırılır.

## Değişen Dosyalar

### 1. `apps/mobile/lib/appointment-mappers.ts`
`appointmentRowToAgendaItem` return'üne `endTime: formatTime(end)` eklenir.

### 2. `apps/mobile/app/(owner)/agenda.tsx`
- `AppItem` interface'e `endTime: string` eklenir.
- `BlokItem` interface'e `endTime: string` eklenir.
- Blok map'inde `endTime: formatTime(end)` eklenir.
- `AppointmentCard` ve `BlokCard` render'ında `endTime={item.endTime}` prop'u geçirilir.

### 3. `apps/mobile/components/ds/AppointmentCard.tsx`
- Props'a `endTime: string` eklenir.
- `duration` prop'u interface'de kalır (call site uyumluluğu), ama artık render'da kullanılmaz.
- `dur` Text: `{duration} DK` → `{endTime}`
- `dur` style: `letterSpacing` ve `textTransform` kaldırılır.
- Active state (`durActive`) ve default state (`durDefault`) renk stilleri korunur.

### 4. `apps/mobile/components/ds/BlokCard.tsx`
- Props'a `endTime: string` eklenir.
- `duration` prop'u interface'de kalır, render'da kullanılmaz.
- Aynı style değişiklikleri.

## Kenar Durumlar

- **Gece yarısı geçişi:** `formatTime` Date objesini formatladığı için `23:30 + 45dk → 00:15` doğru çalışır.
- **Active state (mavi arka plan):** `durActive` stili (`rgba(255,255,255,0.6)`) korunur, bitiş saati beyaz tonda görünür.
- **Done state:** `opacity: 0.55` tüm karta uygulanır, bitiş saati dahil — sorun yok.
