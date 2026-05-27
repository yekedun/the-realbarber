# Web Booking UI Overhaul — Design Spec
Date: 2026-05-27  
Branch: `ui/booking-overhaul`  
Rollback: `git checkout b787899`

## Goal
"Akbank değil Enpara" hissini tersine çevir — sade minimal yapı korunur, görsel rafinelik kazanılır. Aynı zamanda tüm inline style'lar Tailwind class'larına taşınır.

## Kapsam
- `apps/web/src/app/[slug]/BookingClient.tsx`
- `apps/web/src/app/[slug]/u/[barberSlug]/page.tsx`
- `apps/web/src/components/ServiceSelector.tsx`
- `apps/web/src/components/SlotGrid.tsx`
- `apps/web/src/components/BookingModal.tsx`

---

## 1. Tasarım Kararları

### 1.1 Section Label'lar
Korunur ama "bağırmak" yerine "rehberlik" eder.  
`text-2xs font-semibold tracking-widest text-slate-400 uppercase mb-2.5`  
(mevcut: fg-4 + letter-spacing 0.22em inline — aynı anlam, daha soluk ve oturmuş)

### 1.2 Header
```
bg-slate-0 shadow-xs  (border-bottom kaldırılıyor, shadow-xs alıyor)
py-7 px-5
max-w-[480px] mx-auto

overline:   text-2xs font-semibold tracking-widest text-slate-400 uppercase
shop name:  text-3xl font-bold tracking-tight text-ink-900 mt-2
address:    text-sm text-slate-500 mt-1.5
barber badge: bg-brand-100 border border-brand-200 text-brand-700
              text-xs font-semibold rounded-pill px-3 py-1 inline-flex items-center gap-1.5 mt-3
```

### 1.3 ServiceSelector
Mevcut: seçili kart = full `brand-600` fill (bağırıyor).  
Yeni: seçili kart = border + tint + sağda checkmark — daha Akbank.

```
Unselected: bg-slate-0 border border-slate-200 shadow-xs rounded-md px-4 py-4
            hover: border-slate-300 shadow-sm (transition)

Selected:   border-2 border-brand-600 bg-brand-100 rounded-md px-4 py-4
            service name: text-brand-700 font-semibold
            duration badge: bg-brand-600/10 text-brand-700 border-brand-200
            price: text-brand-700 font-bold tabular-nums
            sağda: checkmark icon (✓) text-brand-600
```

### 1.4 Staff Chips
```
Unselected: bg-slate-0 border border-slate-200 text-slate-700 font-semibold
            rounded-pill px-4 py-2 text-sm shadow-xs hover:border-slate-300

Selected:   bg-ink-900 border-ink-900 text-white
```

### 1.5 Date Picker
Değiştirilmiyor — kullanıcı onaylı.

### 1.6 SlotGrid
Skeleton ve grid yapısı korunur. Stil güncellemesi:
```
Available:  bg-slate-0 border border-slate-200 shadow-xs rounded-md
            text-sm font-semibold text-ink-900
            hover: border-slate-300 shadow-sm

Selected:   bg-brand-600 border-brand-600 text-white shadow-sm

Unavailable: bg-slate-100 border-transparent text-slate-400 rounded-md
             cursor-not-allowed

Hot:        bg-umber-100 border-umber-600 text-umber-700
```

Skeleton: `bg-slate-100 animate-pulse rounded-md h-[50px]`

### 1.7 Sticky CTA Bar
Glassmorphism — mevcut sert `bg-elevated + border-top` → blur'lı cam yüzey.
```
fixed bottom-0 left-0 right-0
backdrop-blur-md bg-white/80 border-t border-slate-200/60
px-5 py-3 pb-5

Button: bg-brand-600 text-white font-bold text-[15px] rounded-md
        w-full h-14 tracking-tight
        hover: bg-brand-700 transition-colors
```
`slideUp` animasyonu korunur.

### 1.8 BookingModal
Modal kart: `rounded-xl shadow-lg border border-slate-200 bg-slate-0 max-w-[456px] w-full`  
Overlay: `fixed inset-0 bg-ink-900/40 backdrop-blur-sm flex items-center justify-center p-6 z-[1000]`

**Form state:**
```
padding: p-7 pb-6
overline: text-2xs font-semibold tracking-widest text-slate-400 uppercase
title: text-2xl font-bold tracking-tight text-ink-900 mt-2.5
summary: text-sm text-slate-500 mt-1.5 leading-relaxed

Input label: text-2xs font-semibold tracking-widest text-slate-400 uppercase mb-1.5
Input:  bg-slate-50 border border-slate-200 rounded-sm px-3.5 py-3
        text-[15px] text-ink-900 font-sans
        focus: border-brand-600 ring-2 ring-brand-100 outline-none
        transition: border-color 140ms

Vazgeç btn: border border-slate-200 bg-transparent text-slate-600
            rounded-md h-12 font-semibold text-sm flex-1
Onayla btn: bg-brand-600 text-white rounded-md h-12 font-semibold text-sm flex-[1.5]
            disabled: bg-slate-200 text-slate-400 cursor-not-allowed
```

**Success state:**
```
Checkmark circle: bg-mint-600 text-white w-7 h-7 rounded-full
Summary box: bg-slate-50 rounded-md px-3.5 py-3 text-sm text-slate-600 leading-relaxed mt-4
WhatsApp btn: bg-[#25D366] text-white rounded-md font-semibold text-sm w-full py-3 mt-2
```

**Error state:**
```
Error circle: bg-coral-600 text-white w-7 h-7 rounded-full
```

---

## 2. Tailwind Migrasyonu

Tüm inline `style={{...}}` blokları kaldırılır, yerine Tailwind class string'leri gelir.  
CSS değişkenleri (`var(--brand-600)` vb.) → custom Tailwind class'ları (`bg-brand-600` vb.)  
`cn()` utility kullanılmayacak — class string concat yeterli (koşullu class'lar için template literal).

Animasyon class'ları `globals.css`'teki keyframe'lere bağlı kalır (`animate-pulse`, `fadeIn`, `slideUp` vb.).

---

## 3. Değişmeyen Şeyler
- Tüm state mantığı (fetchSlots, abort controller, double-submit guard)
- Date picker bileşeni ve yatay scroll davranışı
- SlotGrid column hesabı (useColumns hook)
- BookingModal state machine (form → loading → success/error)
- Edge function çağrıları ve payload shape'leri
- globals.css token tanımları

---

## 4. Dosya Başına İş

| Dosya | İş |
|-------|----|
| `BookingClient.tsx` | Header, Section, StaffChip, sticky CTA → Tailwind |
| `ServiceSelector.tsx` | Kart stili: seçili state refactor + Tailwind |
| `SlotGrid.tsx` | Slot button stili + skeleton → Tailwind |
| `BookingModal.tsx` | Tüm sub-component'lar → Tailwind |

---

## 5. Kapsam Dışı
- Mobil uygulama (ayrı oturum)
- Tailwind config değişiklikleri (mevcut custom token'lar yeterli)
- Edge function değişiklikleri
- Admin panel UI
