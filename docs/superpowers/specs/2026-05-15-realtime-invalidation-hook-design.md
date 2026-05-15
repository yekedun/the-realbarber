# Realtime Invalidation Hook — Design Doc

**Date:** 2026-05-15  
**Status:** Approved

---

## Problem

Supabase Realtime subscription logic üç farklı yerde tekrar ediyor:

| Dosya | Channel | Tablolar | Filter tipi |
|---|---|---|---|
| `apps/mobile/app/(app)/index.tsx` | `appointments:{staffId}` | appointments, blocks | tek staff |
| `apps/mobile/app/(owner)/agenda.tsx` | `owner-agenda:{shopId}:{dayKey}` | appointment_slots, block_slots | N staff döngüsü |
| `apps/web/src/app/[slug]/BookingFlow.tsx` | `slots:{shopId}:{staffId}` | appointment_slots, block_slots | N staff döngüsü |

Ek olarak Owner KPI ekranı (`apps/mobile/app/(owner)/index.tsx`) hiç realtime dinlemiyor — yalnızca pull-to-refresh ile güncelleniyor.

---

## Hedef

`packages/shared/src/use-realtime-invalidation.ts` içinde tek bir hook ile:
1. Üç mevcut subscription'ı merkeze taşımak
2. Owner KPI'ya sıfırdan realtime invalidation eklemek

---

## Tasarım Kararları

### API

```ts
export type TableName =
  | "appointments"
  | "appointment_slots"
  | "blocks"
  | "block_slots";

export type TableFilter = {
  table: TableName;
  filters: string[]; // boş = filtersiz (RLS'e güven)
};

export type RealtimeInvalidationSpec = {
  client: SupabaseClient;
  channelName: string;
  tableFilters: TableFilter[]; // useMemo ile stabilize edilmeli
  invalidate: () => void;      // hook ref'e alır — identity değişimi resubscribe tetiklemez
  enabled?: boolean;           // default: true
  debounceMs?: number;         // default: 0
};

export function useRealtimeInvalidation(spec: RealtimeInvalidationSpec): void
```

### Stale Closure Önleme

`invalidate` her render'da ref'e alınır:
```ts
const invalidateRef = useRef(invalidate);
invalidateRef.current = invalidate;
```
Effect içinde `invalidateRef.current()` çağrılır. Bu sayede `invalidate` deps'e eklenmez → callback identity değişimi resubscribe tetiklemez.

### tableFilters Stabilitesi

`tableFilters` array referansı değil, `JSON.stringify(tableFilters)` dep olarak kullanılır. Böylece içerik değişmediği sürece resubscribe olmaz. Consumer yine de `useMemo` kullanmalıdır (gereksiz JSON.stringify maliyetini önlemek için).

### Debounce

Hook isteğe bağlı `debounceMs` kabul eder. `agenda.tsx` için 300 ms geçilir. Debounce timer cleanup'ta temizlenir.

### React StrictMode

Effect iki kez çalışır (mount → cleanup → remount). `removeChannel` cleanup'ta çağrıldığı için ikinci mount temiz channel ile başlar. Supabase "already subscribed" uyarısı verebilir ama fonksiyonel sorun yoktur.

### Supabase Client

Mobile singleton `supabase` import'u ve web'in `useMemo` ile oluşturduğu client aynı `SupabaseClient` tipini paylaşır. Hook `client` parametresi alır — singleton veya per-component client fark etmez.

---

## Migration Haritası

### 1. `apps/mobile/app/(app)/index.tsx`

```ts
const tableFilters = useMemo(() => [
  { table: "appointments" as const, filters: [`staff_id=eq.${staffId}`] },
  { table: "blocks" as const,       filters: [`staff_id=eq.${staffId}`] },
], [staffId]);

useRealtimeInvalidation({
  client: supabase,
  channelName: `appointments:${staffId}`,
  tableFilters,
  invalidate: () => { if (staffId) void fetchDay(staffId, selectedDay); },
  enabled: !!staffId,
});
```

Kaldırılacak: `useEffect` subscription bloğu (lines 158–178).

### 2. `apps/mobile/app/(owner)/agenda.tsx`

```ts
const tableFilters = useMemo(() => [
  { table: "appointment_slots" as const, filters: staff.map(m => `staff_id=eq.${m.id}`) },
  { table: "block_slots" as const,       filters: staff.map(m => `staff_id=eq.${m.id}`) },
], [staff]);

useRealtimeInvalidation({
  client: supabase,
  channelName: `owner-agenda:${shopId}:${selectedDayKey}`,
  tableFilters,
  invalidate: load,
  enabled: !!shopId && staff.length > 0,
  debounceMs: 300,
});
```

Kaldırılacak: `useEffect` subscription bloğu (lines 206–237, debounce + loop dahil).  
Not: date-bound optimizasyonu kaldırılır — `load()` her zaman doğru tarih aralığını sorgular.

### 3. `apps/web/src/app/[slug]/BookingFlow.tsx`

```ts
const targetStaffIds = useMemo(() =>
  selectedStaffId === "any" ? staff.map(b => b.id) : (selectedStaffId ? [selectedStaffId] : []),
  [selectedStaffId, staff]
);

const tableFilters = useMemo(() => [
  { table: "appointment_slots" as const, filters: targetStaffIds.map(id => `staff_id=eq.${id}`) },
  { table: "block_slots" as const,       filters: targetStaffIds.map(id => `staff_id=eq.${id}`) },
], [targetStaffIds]);

useRealtimeInvalidation({
  client: supabase,
  channelName: `slots:${shop.id}:${selectedStaffId ?? "none"}`,
  tableFilters,
  invalidate: fetchSlots,
  enabled: !!selectedService && selectedStaffId !== null,
});
```

Kaldırılacak: `useEffect` subscription bloğu (lines 131–158).

### 4. `apps/mobile/app/(owner)/index.tsx` — Owner KPI (yeni)

```ts
const tableFilters = useMemo(() => [
  { table: "appointments" as const, filters: staff.map(s => `staff_id=eq.${s.id}`) },
], [staff]);

useRealtimeInvalidation({
  client: supabase,
  channelName: `owner-kpi:${shopId}`,
  tableFilters,
  invalidate: load,
  enabled: !!shopId && staff.length > 0,
});
```

KPI'ı etkileyen olaylar: `appointments` INSERT (yeni randevu) / UPDATE (status: completed/cancelled) / DELETE. `load()` tetiklenince `computeStats()` güncel veriyle yeniden çalışır.

---

## Duplicate Subscription Analizi

| Screen | Tablo |
|---|---|
| Agenda | appointment_slots, block_slots |
| KPI | appointments |

Farklı tablolar → farklı channeller → duplicate yok.

---

## Riskler

| Risk | Önlem |
|---|---|
| `tableFilters` memoize edilmezse sonsuz resubscribe | JSON.stringify dep karşılaştırması; doc'ta zorunluluk belirtilir |
| StrictMode çift mount | Cleanup doğru → ikinci mount temiz başlar |
| Agenda date-bound optimizasyonu kalkınca fazla refetch | `load()` doğru aralığı sorgular, sonuç aynı |
| KPI 60-günlük sorgu sık tetiklenirse | Yoğun dükkanda dakikada birkaç istek — kabul edilebilir |
