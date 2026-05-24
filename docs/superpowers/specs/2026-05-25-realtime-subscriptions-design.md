# Realtime Subscriptions — BookingClient + Agenda

**Date:** 2026-05-25  
**Scope:** `apps/web/src/app/[slug]/BookingClient.tsx` · `apps/mobile/app/(owner)/agenda.tsx`

## Problem

Supabase backend realtime events yayıyor ancak frontend hiçbir postgres_changes kanalına subscribe değil. Sonuç:
- Müşteri web sayfasında başka biri slot rezerve etse bile grid "müsait" göstermeye devam ediyor
- Owner mobil ajanda ekranı yeni randevu/blok için manuel refresh gerektiriyor

## Genel Prensip

```
subscribe(table, filter) → on change → call existing fetch fn
```

Yeni veri modeli yok, edge function değişmiyor. Subscription yalnızca "veri değişti" sinyali verir; veriyi mevcut REST/RPC fonksiyonları çeker.

---

## 1. BookingClient.tsx (Web)

### Subscribe edilen tablo
`appointments` — filtre: `shop_id=eq.<shopId>`

### Tetiklenen olaylar
`INSERT`, `UPDATE` → `fetchSlots()` yeniden çağrılır

### Kanal yaşam döngüsü
- Component mount'ta `shopId` hazır olunca kanal kurulur
- Component unmount'ta `supabase.removeChannel(channel)` çağrılır
- `selDate` / `selService` / `selStaff` değişince kanal yeniden kurulmaz — filtre shop-level, slot hesabı `fetchSlots` içinde

### Debounce
Aynı saniyede birden fazla event gelirse `fetchSlots` spam'ini önlemek için 200ms `useRef` timeout.

### RLS notu
`appointments` tablosunda anon `SELECT` policy mevcut (`widget-get-availability` aynı erişimi kullanıyor). Ek policy gerekmez.

---

## 2. agenda.tsx (Mobile)

### Subscribe edilen tablolar
- `appointments` — filtre: `staff_id=in.(id1,id2,...)`
- `blocks` — filtre: `staff_id=in.(id1,id2,...)`

### Tetiklenen olaylar
`INSERT`, `UPDATE`, `DELETE` → `loadAgenda()` yeniden çağrılır

### Kanal yaşam döngüsü
- `barberList` yüklendikten sonra kurulur
- `selectedDate` değişince her iki kanal kaldırılıp yeniden kurulur (tarih filtreyi dolaylı etkiler — filtre staff-level ama loadAgenda date-aware)
- `useEffect` cleanup'ında `removeChannel` her iki kanal için

### Debounce
200ms `useRef` timeout — aynı saniyede birden fazla INSERT/UPDATE gelince `loadAgenda` tek kez çalışır.

---

## 3. Hata & Edge Case'ler

| Durum | Davranış |
|-------|---------|
| WS bağlantı kesilmesi | supabase-js otomatik reconnect eder, uygulama kodu gerekmez |
| İlk yük | Subscribe'dan önce `fetchSlots`/`loadAgenda` zaten çalışıyor — güvenli |
| RLS reddi | Realtime aynı RLS'i kullanır; anon/owner policy mevcutsa realtime de çalışır |
| barberList boş | `barberList.length === 0` kontrolü — subscribe kurulmaz |

---

## 4. Dosya Değişiklikleri

| Dosya | Değişiklik |
|-------|-----------|
| `apps/web/src/app/[slug]/BookingClient.tsx` | `useEffect` + `supabase` import + channel kurulum/cleanup + debounce ref |
| `apps/mobile/app/(owner)/agenda.tsx` | İki `useEffect` (appointments + blocks kanalları) + debounce ref |

Toplam tahmini ek satır: ~50 (web ~20, mobil ~30)

---

## 5. Test Stratejisi

1. **Web:** İki sekme aç → birinde randevu al → diğerinde slot grid'inin güncellenmesini izle
2. **Mobil:** Başka bir cihazdan/web'den randevu ekle → agenda'nın yenilenmesini izle
3. **Cleanup:** Sayfadan ayrıl / ekrandan çık → Supabase dashboard'da açık realtime bağlantı kalmamalı
4. **Debounce:** Hızlı art arda 3 randevu ekle → `loadAgenda` 1-2 kez çağrılmalı, 3 kez değil
