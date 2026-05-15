# Realtime Invalidation Hook — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Duplicate Supabase realtime subscription logic'i `useRealtimeInvalidation` hook'unda topla; Owner KPI ekranına realtime invalidation ekle.

**Architecture:** `packages/shared/src/use-realtime-invalidation.ts` içinde tek hook. `tableFilters` array'i birden fazla tablo × filter kombinasyonunu tek channel üzerinde yönetir. `invalidate` callback ref'e alınır — identity değişimi resubscribe tetiklemez. `JSON.stringify(tableFilters)` dep stabilitesi sağlar.

**Tech Stack:** React (useEffect, useRef, useMemo), @supabase/supabase-js, TypeScript, React Native (mobile), Next.js (web)

---

## File Map

| Eylem | Dosya | Sorumluluk |
|---|---|---|
| Oluştur | `packages/shared/src/use-realtime-invalidation.ts` | Hook implementasyonu |
| Değiştir | `packages/shared/package.json` | Export + peerDependencies |
| Değiştir | `apps/mobile/app/(app)/index.tsx` | Mevcut subscription → hook |
| Değiştir | `apps/mobile/app/(owner)/agenda.tsx` | Mevcut subscription → hook |
| Değiştir | `apps/web/src/app/[slug]/BookingFlow.tsx` | Mevcut subscription → hook |
| Değiştir | `apps/mobile/app/(owner)/index.tsx` | Yeni KPI realtime invalidation |

---

## Task 1: Hook Dosyasını Oluştur

**Files:**
- Create: `packages/shared/src/use-realtime-invalidation.ts`

- [ ] **Step 1.1: Dosyayı oluştur**

```ts
// packages/shared/src/use-realtime-invalidation.ts
import { useEffect, useRef } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";

export type TableName =
  | "appointments"
  | "appointment_slots"
  | "blocks"
  | "block_slots";

export type TableFilter = {
  table: TableName;
  filters: string[];
};

export type RealtimeInvalidationSpec = {
  client: SupabaseClient;
  channelName: string;
  tableFilters: TableFilter[];
  invalidate: () => void;
  enabled?: boolean;
  debounceMs?: number;
};

export function useRealtimeInvalidation({
  client,
  channelName,
  tableFilters,
  invalidate,
  enabled = true,
  debounceMs = 0,
}: RealtimeInvalidationSpec): void {
  const invalidateRef = useRef(invalidate);
  invalidateRef.current = invalidate;

  const tableFiltersKey = JSON.stringify(tableFilters);

  useEffect(() => {
    if (!enabled) return;

    let debounceTimer: ReturnType<typeof setTimeout> | null = null;

    const handleChange = () => {
      if (debounceMs > 0) {
        if (debounceTimer) clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
          invalidateRef.current();
        }, debounceMs);
      } else {
        invalidateRef.current();
      }
    };

    const parsed = JSON.parse(tableFiltersKey) as TableFilter[];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let channel = client.channel(channelName) as any;

    for (const { table, filters } of parsed) {
      if (filters.length === 0) {
        channel = channel.on(
          "postgres_changes",
          { event: "*", schema: "public", table },
          handleChange
        );
      } else {
        for (const filter of filters) {
          channel = channel.on(
            "postgres_changes",
            { event: "*", schema: "public", table, filter },
            handleChange
          );
        }
      }
    }

    channel.subscribe();

    return () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      void client.removeChannel(channel);
    };
  // tableFiltersKey, enabled, debounceMs içerik-bazlı dep karşılaştırması sağlar
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client, channelName, tableFiltersKey, enabled, debounceMs]);
}
```

- [ ] **Step 1.2: TypeScript kontrolü**

```bash
cd "packages/shared" && npx tsc --noEmit
```

Beklenen: hata yok (ya da sadece mevcut projeden gelen hatalar — bu dosyaya ait hata olmamalı).

---

## Task 2: Shared Package Export'u Güncelle

**Files:**
- Modify: `packages/shared/package.json`

- [ ] **Step 2.1: package.json güncelle**

Mevcut `exports` ve `devDependencies` bloklarını şununla değiştir:

```json
{
  "name": "@berber/shared",
  "version": "0.0.1",
  "private": true,
  "exports": {
    "./slot-utils": "./src/slot-utils.ts",
    "./constants": "./src/constants.ts",
    "./types": "./src/types.ts",
    "./use-realtime-invalidation": "./src/use-realtime-invalidation.ts"
  },
  "peerDependencies": {
    "@supabase/supabase-js": ">=2.0.0",
    "react": ">=18.0.0"
  },
  "scripts": {
    "type-check": "tsc --noEmit"
  },
  "devDependencies": {
    "typescript": "^5.4.0"
  }
}
```

- [ ] **Step 2.2: Import'un çalıştığını doğrula**

`apps/mobile/app/(app)/index.tsx` dosyasına geçici olarak şu satırı ekle, kaydet, TypeScript hata verip vermediğini kontrol et, sonra kaldır:

```ts
import { useRealtimeInvalidation } from "@berber/shared/use-realtime-invalidation";
```

Beklenen: import resolve edilir, hata yok.

- [ ] **Step 2.3: Commit**

```bash
git add packages/shared/src/use-realtime-invalidation.ts packages/shared/package.json
git commit -m "feat(shared): add useRealtimeInvalidation hook"
```

---

## Task 3: apps/mobile/app/(app)/index.tsx Migration

**Files:**
- Modify: `apps/mobile/app/(app)/index.tsx`

Mevcut subscription (lines ~158–178):
```ts
useEffect(() => {
  if (!staffId) return;
  const channel = supabase
    .channel(`appointments:${staffId}`)
    .on("postgres_changes", { event: "*", schema: "public", table: "appointments", filter: `staff_id=eq.${staffId}` }, () => { void fetchDay(staffId, selectedDay); })
    .on("postgres_changes", { event: "*", schema: "public", table: "blocks", filter: `staff_id=eq.${staffId}` }, () => { void fetchDay(staffId, selectedDay); })
    .subscribe();
  return () => { supabase.removeChannel(channel); };
}, [staffId, selectedDay, fetchDay]);
```

- [ ] **Step 3.1: Import ekle**

Dosyanın import bölümüne ekle:
```ts
import { useRealtimeInvalidation } from "@berber/shared/use-realtime-invalidation";
```

- [ ] **Step 3.2: Eski subscription useEffect'ini kaldır**

Lines 158–178 arasındaki `useEffect` bloğunu (subscription kuran) tamamen sil.

- [ ] **Step 3.3: useMemo + hook ekle**

`onRefresh` callback'inden hemen önce ekle:

```ts
const realtimeTableFilters = useMemo(() => [
  { table: "appointments" as const, filters: staffId ? [`staff_id=eq.${staffId}`] : [] },
  { table: "blocks" as const,       filters: staffId ? [`staff_id=eq.${staffId}`] : [] },
], [staffId]);

useRealtimeInvalidation({
  client: supabase,
  channelName: `appointments:${staffId ?? "none"}`,
  tableFilters: realtimeTableFilters,
  invalidate: () => { if (staffId) void fetchDay(staffId, selectedDay); },
  enabled: !!staffId,
});
```

- [ ] **Step 3.4: TypeScript kontrolü**

```bash
cd "apps/mobile" && npx tsc --noEmit 2>&1 | head -30
```

Beklenen: bu dosyaya ait yeni TypeScript hatası yok.

- [ ] **Step 3.5: Manuel doğrulama**

Uygulamayı başlat. Staff timeline ekranında bir randevu oluştur veya iptal et (başka bir session veya Supabase Studio üzerinden). Timeline'ın pull-to-refresh olmadan güncellendiğini doğrula.

- [ ] **Step 3.6: Commit**

```bash
git add apps/mobile/app/(app)/index.tsx
git commit -m "refactor(mobile): migrate staff timeline realtime to useRealtimeInvalidation"
```

---

## Task 4: apps/mobile/app/(owner)/agenda.tsx Migration

**Files:**
- Modify: `apps/mobile/app/(owner)/agenda.tsx`

Mevcut subscription (lines ~206–237): debounce + for döngüsü ile appointment_slots ve block_slots dinleniyor.

- [ ] **Step 4.1: Import ekle**

```ts
import { useRealtimeInvalidation } from "@berber/shared/use-realtime-invalidation";
```

- [ ] **Step 4.2: Eski subscription useEffect'ini kaldır**

Lines 206–237 arasındaki `useEffect` bloğunu (channel kurma, debounce timer, for döngüsü dahil) tamamen sil.

- [ ] **Step 4.3: useMemo + hook ekle**

`onRefresh` fonksiyonundan hemen önce ekle:

```ts
const agendaTableFilters = useMemo(() => [
  { table: "appointment_slots" as const, filters: staff.map(m => `staff_id=eq.${m.id}`) },
  { table: "block_slots" as const,       filters: staff.map(m => `staff_id=eq.${m.id}`) },
], [staff]);

useRealtimeInvalidation({
  client: supabase,
  channelName: `owner-agenda:${shopId}:${selectedDayKey}`,
  tableFilters: agendaTableFilters,
  invalidate: load,
  enabled: !!shopId && staff.length > 0,
  debounceMs: 300,
});
```

- [ ] **Step 4.4: TypeScript kontrolü**

```bash
cd "apps/mobile" && npx tsc --noEmit 2>&1 | head -30
```

Beklenen: yeni hata yok.

- [ ] **Step 4.5: Manuel doğrulama**

Owner agenda ekranında bir randevu drag-drop ile başka ustaya taşı. Her iki sütunun güncellendiğini doğrula. Farklı bir günde randevu oluştur — mevcut gün değişmemeli.

- [ ] **Step 4.6: Commit**

```bash
git add apps/mobile/app/(owner)/agenda.tsx
git commit -m "refactor(mobile): migrate owner agenda realtime to useRealtimeInvalidation"
```

---

## Task 5: apps/web/src/app/[slug]/BookingFlow.tsx Migration

**Files:**
- Modify: `apps/web/src/app/[slug]/BookingFlow.tsx`

Mevcut subscription (lines ~131–158): `targetStaffIds` döngüsü, appointment_slots + block_slots.

- [ ] **Step 5.1: Import ekle**

Mevcut import'ların altına ekle:
```ts
import { useRealtimeInvalidation } from "@berber/shared/use-realtime-invalidation";
```

- [ ] **Step 5.2: Eski subscription useEffect'ini kaldır**

Lines 131–158 arasındaki `useEffect` bloğunu (channel kurma, for döngüsü dahil) tamamen sil.

- [ ] **Step 5.3: targetStaffIds useMemo + hook ekle**

`fetchSlots` useCallback'inin hemen altına ekle:

```ts
const targetStaffIds = useMemo(() =>
  selectedStaffId === "any"
    ? staff.map(b => b.id)
    : selectedStaffId
    ? [selectedStaffId]
    : [],
  [selectedStaffId, staff]
);

const bookingTableFilters = useMemo(() => [
  { table: "appointment_slots" as const, filters: targetStaffIds.map(id => `staff_id=eq.${id}`) },
  { table: "block_slots" as const,       filters: targetStaffIds.map(id => `staff_id=eq.${id}`) },
], [targetStaffIds]);

useRealtimeInvalidation({
  client: supabase,
  channelName: `slots:${shop.id}:${selectedStaffId ?? "none"}`,
  tableFilters: bookingTableFilters,
  invalidate: fetchSlots,
  enabled: !!selectedService && selectedStaffId !== null,
});
```

- [ ] **Step 5.4: TypeScript kontrolü**

```bash
cd "apps/web" && npx tsc --noEmit 2>&1 | head -30
```

Beklenen: yeni hata yok.

- [ ] **Step 5.5: Manuel doğrulama**

Booking sayfasını iki farklı tarayıcı sekmesinde aç, aynı usta + tarih + hizmet seçili olsun. Birinde bir slot seç ve randevu oluştur. Diğer sekmede slot'un "dolu" olarak güncellendiğini pull-to-refresh olmadan doğrula.

- [ ] **Step 5.6: Commit**

```bash
git add apps/web/src/app/[slug]/BookingFlow.tsx
git commit -m "refactor(web): migrate booking flow realtime to useRealtimeInvalidation"
```

---

## Task 6: Owner KPI Realtime Invalidation (Yeni)

**Files:**
- Modify: `apps/mobile/app/(owner)/index.tsx`

Bu dosyada hiç realtime subscription yok. `load()` callback zaten mevcut ve `appointments` tablosunu ±30 gün aralığında çekiyor.

- [ ] **Step 6.1: Import ekle**

```ts
import { useRealtimeInvalidation } from "@berber/shared/use-realtime-invalidation";
```

Ayrıca `supabase` import'u yoksa ekle (dosya `useUserRole` üzerinden shopId alıyor ama supabase'i doğrudan import etmiyor olabilir):

```ts
import { supabase } from "../../lib/supabase";
```

Dosyanın üstündeki import'ları kontrol et — `supabase` zaten import edilmişse tekrar ekleme.

- [ ] **Step 6.2: useMemo + hook ekle**

`handleSelectStaff` callback'inden hemen önce, `staff` state'i dolduktan sonra çalışacak şekilde ekle:

```ts
const kpiTableFilters = useMemo(() => [
  { table: "appointments" as const, filters: staff.map(s => `staff_id=eq.${s.id}`) },
], [staff]);

useRealtimeInvalidation({
  client: supabase,
  channelName: `owner-kpi:${shopId}`,
  tableFilters: kpiTableFilters,
  invalidate: load,
  enabled: !!shopId && staff.length > 0,
});
```

- [ ] **Step 6.3: TypeScript kontrolü**

```bash
cd "apps/mobile" && npx tsc --noEmit 2>&1 | head -30
```

Beklenen: yeni hata yok.

- [ ] **Step 6.4: Manuel doğrulama**

Owner dashboard ekranında bekle. Başka bir session (ya da Supabase Studio) üzerinden aynı dükkanın bir randevusunu "completed" olarak işaretle. Dashboard'daki "Tamamlanan" ve "Tahmini ₺" KPI kartlarının pull-to-refresh olmadan güncellendiğini doğrula.

Yeni randevu ekle → "Bugün Toplam" kartının arttığını doğrula.

- [ ] **Step 6.5: Duplicate subscription kontrolü**

Owner tab'ı açıkken hem Dashboard hem Agenda ekranına git. Supabase Studio'dan (veya başka bir session'dan) bir randevu değişikliği yap. Her iki ekranın güncellendiğini ve Supabase console'da aynı channel'a ait duplicate subscription uyarısı olmadığını doğrula.

(Dashboard: `owner-kpi:{shopId}` → appointments tablosu)
(Agenda: `owner-agenda:{shopId}:{dayKey}` → appointment_slots, block_slots tabloları)
İki farklı channel, iki farklı tablo grubu — çakışma yok.

- [ ] **Step 6.6: Commit**

```bash
git add apps/mobile/app/(owner)/index.tsx
git commit -m "feat(mobile): add realtime invalidation to owner KPI dashboard"
```

---

## Task 7: Son Kontroller

- [ ] **Step 7.1: Tüm subscription'larda kanal ismi çakışması kontrolü**

Aynı anda açık olabilecek channel isimlerini listele ve benzersiz olduklarını doğrula:

| Screen | Channel Name |
|---|---|
| Staff Timeline | `appointments:{staffId}` |
| Owner Agenda | `owner-agenda:{shopId}:{dayKey}` |
| Booking Flow | `slots:{shopId}:{selectedStaffId}` |
| Owner KPI | `owner-kpi:{shopId}` |

Hiçbiri çakışmıyor — Task 7 tamamlandı.

- [ ] **Step 7.2: React StrictMode cleanup kontrolü**

`apps/mobile/app/_layout.tsx` veya `apps/web/src/app/layout.tsx`'te `<React.StrictMode>` varsa (ya da Next.js dev modunda otomatik aktif), uygulamayı başlatın ve console'da hook'a ait "channel already subscribed" uyarısı dışında hata olmadığını doğrula. Bu uyarı kabul edilebilir.

- [ ] **Step 7.3: pnpm type-check**

```bash
pnpm --filter @berber/shared type-check
pnpm --filter @berber/mobile tsc --noEmit
pnpm --filter @berber/web tsc --noEmit
```

Beklenen: yeni hata yok.

- [ ] **Step 7.4: Final commit (varsa kalan değişiklik)**

```bash
git add .
git commit -m "chore: realtime invalidation hook migration complete"
```
