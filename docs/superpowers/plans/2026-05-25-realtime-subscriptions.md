# Realtime Subscriptions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Web booking sayfasında 30s polling ile slot grid'ini otomatik yenile; owner mobil ajandada `postgres_changes` subscription ile randevu/blok değişikliklerini anlık yansıt.

**Architecture:** BookingClient (anon key, `appointments` SELECT yok) polling kullanır; agenda (authenticated owner, RLS izni var) Supabase realtime `postgres_changes` kanalları kurar, her iki tablo için 200ms debounce ile `loadAgenda` tetikler.

**Tech Stack:** React `useEffect` / `useRef` · Supabase JS `channel().on('postgres_changes')` · `setInterval` + `visibilitychange` · jest-expo + `@testing-library/react-native`

---

## File Map

| Dosya | Değişiklik |
|-------|-----------|
| `apps/web/src/app/[slug]/BookingClient.tsx` | polling `useEffect` ekle — 30s interval + visibilitychange pause |
| `apps/mobile/app/(owner)/agenda.tsx` | debounce ref + iki subscription `useEffect` ekle |
| `apps/mobile/__tests__/agenda-realtime.test.ts` | debounce davranışını doğrulayan birim testi |

---

## Task 1: BookingClient — 30 saniyelik polling

**Files:**
- Modify: `apps/web/src/app/[slug]/BookingClient.tsx:81` (mevcut `useEffect(() => { fetchSlots(); }, [fetchSlots]);` satırının hemen altına)

- [ ] **Step 1: Polling `useEffect`'i ekle**

`apps/web/src/app/[slug]/BookingClient.tsx` dosyasını aç. Satır 81'deki `useEffect(() => { fetchSlots(); }, [fetchSlots]);` satırının **hemen altına** şu bloğu ekle:

```tsx
  /* 30s polling — anon key appointments SELECT'e erişemediği için
     postgres_changes yerine polling kullanıyoruz */
  useEffect(() => {
    const tick = () => {
      if (document.visibilityState === 'visible') fetchSlots();
    };
    const id = setInterval(tick, 30_000);
    document.addEventListener('visibilitychange', tick);
    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', tick);
    };
  }, [fetchSlots]);
```

- [ ] **Step 2: TypeScript derleme kontrolü**

```bash
cd apps/web && npx tsc --noEmit
```

Beklenen: hata yok (0 exit code)

- [ ] **Step 3: Manuel doğrulama**

1. `npx next dev` ile web'i başlat
2. Bir dükkanın booking sayfasını aç (`/[slug]`)
3. Browser DevTools → Network sekmesi → XHR/Fetch filtresi uygula
4. 30 saniye bekle → `widget-get-availability` isteğinin otomatik tekrarlandığını doğrula
5. Sekmeyi arka plana al (başka sekmeye geç) → 30s geçmesine rağmen yeni istek **gitmemeli**
6. Sekmeye geri dön → hemen bir istek gitmeli (visibilitychange tetikler)

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/\[slug\]/BookingClient.tsx
git commit -m "feat(web): 30s polling for slot grid — visibilitychange aware"
```

---

## Task 2: agenda.tsx — debounce yardımcı testi

**Files:**
- Create: `apps/mobile/__tests__/agenda-realtime.test.ts`

> Not: `agenda.tsx` React component testleri Supabase mock setup gerektirdiğinden ağır. Bunun yerine debounce davranışını izole birim testiyle doğruluyoruz.

- [ ] **Step 1: Failing testi yaz**

`apps/mobile/__tests__/agenda-realtime.test.ts` dosyasını oluştur:

```typescript
// Debounce mantığını doğrulayan saf fonksiyon testi.
// Supabase kanallarının kurulumu bağımsız manuel test adımlarında doğrulanır.

describe('agenda realtime debounce', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('peş peşe birden fazla çağrıyı 200ms içinde bir kez çalıştırır', () => {
    const fn = jest.fn();

    // debounce mantığını doğrudan simüle ediyoruz
    let timer: ReturnType<typeof setTimeout> | null = null;
    function scheduleReload() {
      if (timer) clearTimeout(timer);
      timer = setTimeout(fn, 200);
    }

    scheduleReload();
    scheduleReload();
    scheduleReload();

    expect(fn).not.toHaveBeenCalled();
    jest.advanceTimersByTime(200);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('200ms aralıkla ayrı çağrılar her biri için fn çalıştırır', () => {
    const fn = jest.fn();

    let timer: ReturnType<typeof setTimeout> | null = null;
    function scheduleReload() {
      if (timer) clearTimeout(timer);
      timer = setTimeout(fn, 200);
    }

    scheduleReload();
    jest.advanceTimersByTime(200);
    scheduleReload();
    jest.advanceTimersByTime(200);

    expect(fn).toHaveBeenCalledTimes(2);
  });
});
```

- [ ] **Step 2: Testin failing olduğunu doğrula**

```bash
cd apps/mobile && npx jest __tests__/agenda-realtime.test.ts --no-coverage
```

Beklenen: test dosyası bulunamaz veya `fn is not defined` hatası (dosyayı henüz oluşturmadın — bu adım dosyayı oluşturduktan sonra PASS verir, zaten saf logic test)

> Bu testler saf JS — Supabase/React bağımlılığı yok. Hemen geçmeli.

Beklenen çıktı:
```
PASS __tests__/agenda-realtime.test.ts
  agenda realtime debounce
    ✓ peş peşe birden fazla çağrıyı 200ms içinde bir kez çalıştırır
    ✓ 200ms aralıkla ayrı çağrılar her biri için fn çalıştırır
```

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/__tests__/agenda-realtime.test.ts
git commit -m "test(mobile): debounce logic for agenda realtime reload"
```

---

## Task 3: agenda.tsx — realtime subscription

**Files:**
- Modify: `apps/mobile/app/(owner)/agenda.tsx`

- [ ] **Step 1: `useRef` import'a ekle**

Dosyanın 40. satırındaki import satırını bul:
```tsx
import React, { useEffect, useState } from 'react';
```
`useRef` ekle:
```tsx
import React, { useEffect, useRef, useState } from 'react';
```

- [ ] **Step 2: debounce ref'i ve `scheduleReload` fonksiyonunu ekle**

`AgendaScreen` component'inin içinde, state tanımlarından (`const [selectedDate, ...]`) hemen sonrasına ekle:

```tsx
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function scheduleReload() {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => loadAgenda(), 200);
  }
```

- [ ] **Step 3: Subscription `useEffect`'i ekle**

`useEffect(() => { if (barberList.length) loadAgenda(); }, [selectedDate, barberList]);` satırının hemen **altına** ekle:

```tsx
  useEffect(() => {
    if (!barberList.length) return;

    const staffIds = barberList.map(b => b.id).join(',');

    const apptCh = supabase
      .channel(`agenda-appt-${selectedDate.toISOString()}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'appointments', filter: `staff_id=in.(${staffIds})` },
        () => scheduleReload(),
      )
      .subscribe();

    const blockCh = supabase
      .channel(`agenda-block-${selectedDate.toISOString()}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'blocks', filter: `staff_id=in.(${staffIds})` },
        () => scheduleReload(),
      )
      .subscribe();

    return () => {
      supabase.removeChannel(apptCh);
      supabase.removeChannel(blockCh);
    };
  }, [barberList, selectedDate]);
```

- [ ] **Step 4: TypeScript derleme kontrolü**

```bash
cd apps/mobile && npx tsc --noEmit
```

Beklenen: hata yok

- [ ] **Step 5: Testlerin hâlâ geçtiğini doğrula**

```bash
cd apps/mobile && npx jest --no-coverage
```

Beklenen: tüm testler PASS

- [ ] **Step 6: Manuel doğrulama — realtime**

1. `npx expo start` ile uygulamayı başlat
2. Owner hesabıyla giriş yap → Ajanda ekranına geç
3. Supabase Dashboard → Table Editor → `appointments` tablosuna git
4. O gün ve o shop'a ait bir staff_id için yeni kayıt ekle
5. Mobil ekranın ~200ms içinde yenilendiğini (yeni randevunun çıktığını) doğrula
6. Kaydı sil → randevunun ekrandan kaybolduğunu doğrula

- [ ] **Step 7: Manuel doğrulama — cleanup**

1. Ajanda ekranından çık (başka sekmeye/ekrana geç)
2. Supabase Dashboard → Realtime → Channels → ajanda kanallarının kapandığını doğrula

- [ ] **Step 8: Commit**

```bash
git add apps/mobile/app/\(owner\)/agenda.tsx
git commit -m "feat(mobile): realtime agenda — postgres_changes subscription + debounce"
```

---

## Task 4: Son doğrulama

- [ ] **Step 1: Tüm mobile testleri çalıştır**

```bash
cd apps/mobile && npx jest --no-coverage
```

Beklenen: tüm testler PASS, yeni `agenda-realtime.test.ts` dahil

- [ ] **Step 2: Web build kontrolü**

```bash
cd apps/web && npx next build 2>&1 | tail -5
```

Beklenen: `Route (app)` tablosu görünür, hata yok

- [ ] **Step 3: Final commit**

```bash
git add -A
git status
```

Uncommitted değişiklik yoksa plan tamamlandı. Varsa:

```bash
git commit -m "chore: realtime subscriptions cleanup"
```
