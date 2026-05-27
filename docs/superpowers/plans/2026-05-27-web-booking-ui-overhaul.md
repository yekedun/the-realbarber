# Web Booking UI Overhaul Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate all inline styles to Tailwind classes and apply a polished "sade güzellik" visual treatment across the full web booking page and modal.

**Architecture:** 4 component files are rewritten in place — no new files, no new dependencies. State logic, API calls, and data flow are untouched. Only presentation code changes. The date picker section in BookingClient stays visually identical (user-confirmed) but is kept as inline styles since its dynamic selected-state logic doesn't map cleanly to static Tailwind.

**Tech Stack:** Next.js 14, Tailwind CSS v3 with custom token extensions (`apps/web/tailwind.config.ts`), TypeScript

---

## File Map

| File | What changes |
|------|-------------|
| `apps/web/src/components/ServiceSelector.tsx` | Selected state: `brand-600` full fill → `brand-100` tint + checkmark; Tailwind migration |
| `apps/web/src/components/SlotGrid.tsx` | Slot button refinement + skeleton; Tailwind migration |
| `apps/web/src/app/[slug]/BookingClient.tsx` | Header, Section label, StaffChip, sticky CTA glassmorphism; Tailwind migration |
| `apps/web/src/components/BookingModal.tsx` | All 4 states; input validation on blur; spacious layout; Tailwind migration |

---

### Task 1: ServiceSelector — refined selected state + Tailwind migration

**Files:**
- Modify: `apps/web/src/components/ServiceSelector.tsx`

Key design decision: selected card switches from aggressive full `brand-600` fill to `border-2 border-brand-600 bg-brand-100` tint + checkmark SVG on the right. Unselected gets `shadow-xs` lift. Scale feedback on press via `motion-safe:active:scale-[0.99]`.

- [ ] **Step 1: Replace ServiceSelector.tsx**

```tsx
'use client';

export interface Service {
  id: string;
  name: string;
  duration_min: number;
  price: number;
}

interface ServiceSelectorProps {
  services: Service[];
  selected: string | null;
  onSelect: (id: string) => void;
}

export function ServiceSelector({ services, selected, onSelect }: ServiceSelectorProps) {
  if (services.length === 0) {
    return <p className="text-sm text-slate-400 py-4">Henüz hizmet tanımlanmamış.</p>;
  }

  return (
    <div className="flex flex-col gap-2">
      {services.map(s => {
        const isSel = selected === s.id;
        return (
          <div
            key={s.id}
            onClick={() => onSelect(s.id)}
            className={[
              'px-4 py-4 rounded-md cursor-pointer',
              'transition-all duration-200 motion-safe:active:scale-[0.99]',
              isSel
                ? 'border-2 border-brand-600 bg-brand-100'
                : 'border border-slate-200 bg-slate-0 shadow-xs hover:border-slate-300 hover:shadow-sm',
            ].join(' ')}
          >
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className={`text-base font-semibold ${isSel ? 'text-brand-700' : 'text-ink-900'}`}>
                  {s.name}
                </div>
                <div className={[
                  'inline-flex items-center mt-1.5 rounded-pill px-2 py-0.5 border',
                  'text-xs font-semibold',
                  isSel
                    ? 'text-brand-700 bg-brand-600/10 border-brand-100'
                    : 'text-slate-400 bg-slate-100 border-slate-200',
                ].join(' ')}>
                  {s.duration_min} dk
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <span className={`text-[22px] font-bold tabular-nums ${isSel ? 'text-brand-700' : 'text-ink-900'}`}>
                  {s.price}₺
                </span>
                {isSel && (
                  <div className="w-5 h-5 rounded-full bg-brand-600 flex items-center justify-center flex-shrink-0">
                    <svg width="11" height="8" viewBox="0 0 11 8" fill="none">
                      <path d="M1 4L4 7L10 1" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 2: TypeScript check**

```bash
cd apps/web && npx tsc --noEmit 2>&1 | grep -v "\.expo/types"
```

Expected: No output (no errors). The `grep -v` filters pre-existing Expo router noise.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/ServiceSelector.tsx
git commit -m "feat(web): ServiceSelector — Tailwind migration + refined selected state"
```

---

### Task 2: SlotGrid — slot button styles + skeleton → Tailwind

**Files:**
- Modify: `apps/web/src/components/SlotGrid.tsx`

The `useColumns()` hook stays as-is — JS-computed column count can't be expressed as static Tailwind. Grid layout stays as `style={{ gridTemplateColumns }}`. Everything else moves to Tailwind. Selected slot gets `scale-[1.02]` to confirm the tap. Scale transitions are wrapped in `motion-safe:` for reduced-motion support.

- [ ] **Step 1: Replace SlotGrid.tsx**

```tsx
'use client';

import { useEffect, useState } from 'react';

function useColumns(): number {
  const [cols, setCols] = useState(5);
  useEffect(() => {
    function update() {
      setCols(window.innerWidth < 400 ? 4 : 5);
    }
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);
  return cols;
}

export interface Slot {
  time: string;
  available: boolean;
  hot?: boolean;
}

interface SlotGridProps {
  slots: Slot[];
  selected: string | null;
  onSelect: (time: string) => void;
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  isClosed?: boolean;
  isAllFull?: boolean;
}

export function SlotGrid({
  slots, selected, onSelect,
  loading, error, onRetry,
  isClosed, isAllFull,
}: SlotGridProps) {
  const cols = useColumns();
  const gridStyle = { display: 'grid', gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: 8 } as const;

  if (loading) {
    return (
      <div style={gridStyle}>
        {Array.from({ length: 10 }).map((_, i) => (
          <div key={i} className="h-[50px] rounded-md bg-slate-100 animate-pulse" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-6">
        <p className="text-sm font-semibold text-ink-900">Müsaitlik bilgisi alınamadı.</p>
        <p className="text-xs text-slate-400 mt-1">Bağlantıyı kontrol edip tekrar deneyin.</p>
        {onRetry && (
          <button
            onClick={onRetry}
            className="mt-3 text-sm font-semibold text-brand-600 bg-transparent border-0 cursor-pointer underline underline-offset-2 font-sans"
          >
            Tekrar Dene
          </button>
        )}
      </div>
    );
  }

  if (isClosed) {
    return <p className="text-sm text-slate-400 py-4">Bu gün için çalışma saati tanımlanmamış.</p>;
  }

  if (isAllFull || (slots.length > 0 && slots.every(s => !s.available))) {
    return <p className="text-sm text-slate-400 py-4">Bu günde müsait saat kalmadı. Başka bir gün seçin.</p>;
  }

  return (
    <div style={gridStyle}>
      {slots.map(s => {
        const isSel = selected === s.time;
        return (
          <button
            key={s.time}
            disabled={!s.available}
            onClick={() => s.available && onSelect(s.time)}
            className={[
              'h-[50px] rounded-md flex flex-col items-center justify-center gap-0.5',
              'font-sans text-sm tabular-nums transition-all duration-150',
              isSel
                ? 'bg-brand-600 border border-brand-600 text-white font-semibold shadow-sm motion-safe:scale-[1.02]'
                : s.available
                  ? s.hot
                    ? 'bg-umber-100 border border-umber-600 text-umber-700 font-semibold hover:shadow-sm cursor-pointer motion-safe:active:scale-[0.97]'
                    : 'bg-slate-0 border border-slate-200 text-ink-900 font-semibold shadow-xs hover:border-slate-300 hover:shadow-sm cursor-pointer motion-safe:active:scale-[0.97]'
                  : 'bg-slate-100 border-transparent text-slate-400 cursor-not-allowed',
            ].join(' ')}
          >
            <span>{s.time}</span>
            {s.hot && !isSel && s.available && (
              <span className="text-[9px] font-semibold text-umber-600 tracking-wide leading-none">az yer</span>
            )}
          </button>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 2: TypeScript check**

```bash
cd apps/web && npx tsc --noEmit 2>&1 | grep -v "\.expo/types"
```

Expected: No output.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/SlotGrid.tsx
git commit -m "feat(web): SlotGrid — Tailwind migration + refined slot button styles"
```

---

### Task 3: BookingClient — header, section labels, staff chips, sticky CTA → Tailwind

**Files:**
- Modify: `apps/web/src/app/[slug]/BookingClient.tsx`

Key changes:
- Header: `bg-slate-0 shadow-xs`, generous `py-7`, overline pulled back (`text-slate-400`), shop name dominant (`text-3xl`)
- Section label: `text-2xs tracking-widest text-slate-400 uppercase` — less dominant than original
- StaffChip: pill refinement, selected = `bg-ink-900`
- Date picker: **exactly as-is** — inline styles preserved, no visual change
- Sticky CTA: `backdrop-blur-md bg-white/80 border-t border-slate-200/60` glassmorphism; `slideUp` keyframe stays as `style=` attr since it's a globals.css keyframe

- [ ] **Step 1: Replace BookingClient.tsx**

```tsx
'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { ServiceSelector, type Service } from '../../components/ServiceSelector';
import { SlotGrid } from '../../components/SlotGrid';
import { BookingModal } from '../../components/BookingModal';
import { nextBookingSuccessState } from './booking-flow-state';

interface StaffMember { id: string; name: string; phone: string | null; }
interface Shop { id: string; name: string; address: string | null; slug: string; }
interface Props { shop: Shop; services: Service[]; staff: StaffMember[]; preselectedStaffId?: string | null; }
interface RawSlot { starts_at: string; available: boolean; }

const TR_DAYS = ['Paz','Pzt','Sal','Çar','Per','Cum','Cmt'];
const TR_MON  = ['Oca','Şub','Mar','Nis','May','Haz','Tem','Ağu','Eyl','Eki','Kas','Ara'];

function toDateStr(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}
function toTimeLabel(iso: string) {
  return new Date(iso).toLocaleTimeString('tr-TR', {
    hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Istanbul',
  });
}
function buildDays(n: number): Date[] {
  const today = new Date(); today.setHours(0,0,0,0);
  return Array.from({ length: n }, (_, i) => {
    const d = new Date(today); d.setDate(today.getDate() + i); return d;
  });
}

const FN_BASE = process.env.NEXT_PUBLIC_SUPABASE_URL + '/functions/v1';

export default function BookingClient({ shop, services, staff, preselectedStaffId }: Props) {
  const days = buildDays(14);
  const abortRef = useRef<AbortController | null>(null);

  const [selService, setSelService] = useState<string | null>(services[0]?.id ?? null);
  const [selStaff,   setSelStaff]   = useState<string | null>(preselectedStaffId ?? null);
  const [selDate,    setSelDate]    = useState<Date>(() => { const d=new Date(); d.setHours(0,0,0,0); return d; });
  const [selSlot,    setSelSlot]    = useState<string | null>(null);
  const [rawSlots,   setRawSlots]   = useState<RawSlot[]>([]);
  const [slotsLoad,  setSlotsLoad]  = useState(false);
  const [slotsErr,   setSlotsErr]   = useState<string | null>(null);
  const [isClosed,   setIsClosed]   = useState(false);
  const [modalOpen,  setModalOpen]  = useState(false);

  const fetchSlots = useCallback(async () => {
    if (!selService) return;
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setSlotsLoad(true); setSlotsErr(null); setSelSlot(null); setIsClosed(false); setRawSlots([]);
    try {
      const qs = new URLSearchParams({
        shop_slug:  shop.slug,
        date:       toDateStr(selDate),
        service_id: selService,
        staff_id:   selStaff ?? 'any',
      });
      const res = await fetch(`${FN_BASE}/widget-get-availability?${qs}`, { signal: controller.signal });
      if (!res.ok) { setSlotsErr('Müsaitlik bilgisi alınamadı.'); return; }
      const data = await res.json();
      if (data.closed) setIsClosed(true);
      else setRawSlots(data.slots ?? []);
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') return;
      setSlotsErr('Bağlantı hatası. Tekrar deneyin.');
    } finally {
      setSlotsLoad(false);
    }
  }, [selService, selDate, selStaff, shop.slug]);

  useEffect(() => { fetchSlots(); }, [fetchSlots]);

  useEffect(() => {
    const onVisible = () => { if (document.visibilityState === 'visible') fetchSlots(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      abortRef.current?.abort();
    };
  }, [fetchSlots]);

  const slotItems = rawSlots.map(s => ({ time: toTimeLabel(s.starts_at), available: s.available }));
  const isAllFull = !isClosed && !slotsLoad && rawSlots.length > 0 && rawSlots.every(s => !s.available);
  const selRaw    = rawSlots.find(s => toTimeLabel(s.starts_at) === selSlot);
  const selISO    = selRaw?.starts_at ?? '';
  const svc       = services.find(s => s.id === selService);
  const selectedStaff = staff.find(s => s.id === selStaff) ?? null;
  const staffName = selectedStaff?.name;
  const summary   = svc
    ? `${svc.name} · ${svc.duration_min} dk · ${toDateStr(selDate).split('-').reverse().join('.')} ${selSlot ?? ''}${staffName ? ' · '+staffName : ''}`
    : '';

  const preselectedName = preselectedStaffId ? staff.find(s => s.id === preselectedStaffId)?.name : null;
  const showBarberBadge = preselectedName !== null && preselectedName !== undefined && selStaff === preselectedStaffId;

  return (
    <div className="min-h-screen bg-slate-50 font-sans">

      {/* Header */}
      <header className="bg-slate-0 shadow-xs">
        <div className="max-w-[480px] mx-auto px-5 py-7">
          <div className="text-2xs font-semibold tracking-widest text-slate-400 uppercase">
            Online Randevu · Sıradaki
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-ink-900 mt-2">
            {shop.name}
          </h1>
          {shop.address && (
            <div className="text-sm text-slate-500 mt-1.5">{shop.address}</div>
          )}
          {showBarberBadge && (
            <div className="inline-flex items-center gap-1.5 mt-3 bg-brand-100 border border-brand-100 text-brand-700 text-xs font-semibold rounded-pill px-3 py-1">
              ✂ {preselectedName}&apos;in linkindesin
            </div>
          )}
        </div>
      </header>

      {/* Body */}
      <div className="max-w-[480px] mx-auto px-5 pt-6 pb-28">

        {/* 1 — Service */}
        <Section label="Hizmet Seç">
          <ServiceSelector
            services={services}
            selected={selService}
            onSelect={id => { setSelService(id); setSelSlot(null); }}
          />
        </Section>

        {/* 2 — Staff (only if >1 member) */}
        {staff.length > 1 && (
          <Section label="Usta Seç">
            <div className="flex flex-wrap gap-2">
              <StaffChip label="Herhangi" selected={selStaff === null} onClick={() => { setSelStaff(null); setSelSlot(null); }} />
              {staff.map(s => (
                <StaffChip key={s.id} label={s.name} selected={selStaff === s.id} onClick={() => { setSelStaff(s.id); setSelSlot(null); }} />
              ))}
            </div>
          </Section>
        )}

        {/* 3 — Date (unchanged — user-confirmed design, inline styles preserved) */}
        <Section label="Tarih Seç">
          <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4 }}>
            {days.map(d => {
              const str   = toDateStr(d);
              const isSel = str === toDateStr(selDate);
              return (
                <button
                  key={str}
                  onClick={() => { setSelDate(d); setSelSlot(null); }}
                  style={{
                    flexShrink: 0, width: 58, padding: '10px 0', borderRadius: 12,
                    cursor: 'pointer', fontFamily: 'inherit', textAlign: 'center',
                    border: `1.5px solid ${isSel ? 'var(--ink-900)' : 'var(--border)'}`,
                    background: isSel ? 'var(--ink-900)' : 'var(--bg-elevated)',
                    color: isSel ? '#fff' : 'var(--fg-2)',
                    transition: 'background 140ms, border-color 140ms',
                  }}
                >
                  <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.06em', opacity: 0.65 }}>
                    {TR_DAYS[d.getDay()]}
                  </div>
                  <div style={{ fontSize: 20, fontWeight: 700, marginTop: 2 }}>{d.getDate()}</div>
                  <div style={{ fontSize: 10, fontWeight: 600, opacity: 0.55, marginTop: 1 }}>
                    {TR_MON[d.getMonth()]}
                  </div>
                </button>
              );
            })}
          </div>
        </Section>

        {/* 4 — Slots */}
        <Section label="Saat Seç">
          <SlotGrid
            slots={slotItems}
            selected={selSlot}
            onSelect={setSelSlot}
            loading={slotsLoad}
            error={slotsErr}
            onRetry={fetchSlots}
            isClosed={isClosed}
            isAllFull={isAllFull}
          />
        </Section>

      </div>

      {/* Sticky CTA */}
      {selSlot && (
        <div
          className="fixed bottom-0 left-0 right-0 px-5 py-3 pb-5 backdrop-blur-md bg-white/80 border-t border-slate-200/60"
          style={{ animation: 'slideUp 180ms ease' }}
        >
          <div className="max-w-[480px] mx-auto">
            <button
              onClick={() => setModalOpen(true)}
              className="w-full h-14 rounded-md bg-brand-600 text-white font-bold text-[15px] tracking-tight cursor-pointer border-0 font-sans hover:bg-brand-700 transition-colors duration-150"
            >
              Randevu Al — {selSlot}
            </button>
          </div>
        </div>
      )}

      {/* Booking Modal */}
      <BookingModal
        open={modalOpen}
        onClose={() => { setModalOpen(false); setSelSlot(null); }}
        summary={summary}
        shopId={shop.id}
        shopSlug={shop.slug}
        staffId={selStaff}
        staffPhone={selectedStaff?.phone ?? null}
        serviceId={selService ?? ''}
        startsAt={selISO}
        onSuccess={() => {
          const next = nextBookingSuccessState({ modalOpen, selectedSlot: selSlot });
          setModalOpen(next.modalOpen);
          setSelSlot(next.selectedSlot);
          fetchSlots();
        }}
      />
    </div>
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <section className="mb-8">
      <div className="text-2xs font-semibold tracking-widest text-slate-400 uppercase mb-2.5">
        {label}
      </div>
      {children}
    </section>
  );
}

function StaffChip({ label, selected, onClick }: { label: string; selected: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={[
        'px-4 py-2 rounded-pill text-sm font-semibold cursor-pointer font-sans border',
        'transition-all duration-150 motion-safe:active:scale-[0.97]',
        selected
          ? 'bg-ink-900 border-ink-900 text-white'
          : 'bg-slate-0 border-slate-200 text-slate-700 shadow-xs hover:border-slate-300',
      ].join(' ')}
    >
      {label}
    </button>
  );
}
```

- [ ] **Step 2: TypeScript check**

```bash
cd apps/web && npx tsc --noEmit 2>&1 | grep -v "\.expo/types"
```

Expected: No output.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/[slug]/BookingClient.tsx
git commit -m "feat(web): BookingClient — Tailwind migration + header/CTA/chip refinement"
```

---

### Task 4: BookingModal — all states → Tailwind + spacious layout + blur validation

**Files:**
- Modify: `apps/web/src/components/BookingModal.tsx`

Key changes:
- Overlay: `bg-ink-900/40 backdrop-blur-sm` (was rgba string)
- Modal card: `rounded-xl shadow-lg border border-slate-200 bg-slate-0`
- Inputs: `bg-slate-50 border-slate-200 rounded-sm focus:border-brand-600 focus:ring-2 focus:ring-brand-100`
- Phone validation: moves to `onBlur` (was on every keystroke — per ui-ux-pro-max `inline-validation` rule)
- `Overline` component: `color` prop → `className` prop (simpler with Tailwind)
- `fadeIn` / `slideUp` keyframes stay as inline `style=` attrs (globals.css keyframes, can't be referenced from Tailwind without config changes)

- [ ] **Step 1: Replace BookingModal.tsx**

```tsx
'use client';

import { useState, useRef } from 'react';

type ModalState = 'form' | 'loading' | 'success' | 'error';
type ErrorType  = 'conflict' | 'generic';

interface BookingModalProps {
  open: boolean;
  onClose: () => void;
  summary: string;
  shopId: string;
  shopSlug: string;
  staffId: string | null;
  staffPhone?: string | null;
  serviceId: string;
  startsAt: string;
  onSuccess: () => void;
}

const FN_BASE = process.env.NEXT_PUBLIC_SUPABASE_URL + '/functions/v1';

function Overline({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`text-2xs font-semibold tracking-widest uppercase leading-none ${className ?? 'text-slate-400'}`}>
      {children}
    </div>
  );
}

function ModalForm({
  summary, onClose, onConfirm,
}: {
  summary: string;
  onClose: () => void;
  onConfirm: (name: string, phone: string, note: string) => void;
}) {
  const [name,  setName]  = useState('');
  const [phone, setPhone] = useState('');
  const [note,  setNote]  = useState('');
  const [phoneTouched, setPhoneTouched] = useState(false);
  const ok = name.trim().length >= 2 && phone.trim().length >= 10;

  const inputCls = 'bg-slate-50 border border-slate-200 rounded-sm px-3.5 py-3 text-[15px] text-ink-900 font-sans w-full outline-none transition-[border-color,box-shadow] duration-[140ms] focus:border-brand-600 focus:ring-2 focus:ring-brand-100';
  const labelCls = 'text-2xs font-semibold tracking-widest text-slate-400 uppercase mb-1.5';

  return (
    <div className="p-7 pb-6">
      <Overline>Onaylama</Overline>
      <h2 className="text-2xl font-bold tracking-tight text-ink-900 mt-2.5">
        Randevuyu Onayla
      </h2>
      <div className="text-sm text-slate-500 mt-1.5 leading-relaxed">
        {summary}
      </div>

      <div className="flex flex-col gap-3.5 mt-5">
        <div className="flex flex-col">
          <label className={labelCls}>Ad Soyad</label>
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="örn. Ahmet Yılmaz"
            className={inputCls}
          />
        </div>

        <div className="flex flex-col">
          <label className={labelCls}>Telefon</label>
          <input
            type="tel"
            value={phone}
            onChange={e => setPhone(e.target.value)}
            onBlur={() => setPhoneTouched(true)}
            placeholder="0(5xx) xxx xx xx"
            className={inputCls}
          />
          {phoneTouched && phone.length > 0 && phone.trim().length < 10 && (
            <div className="text-xs text-coral-600 mt-1">Geçerli bir telefon numarası gir</div>
          )}
          {!phoneTouched && phone.length === 0 && name.trim().length >= 2 && (
            <div className="text-xs text-slate-400 mt-1">Randevu onayı için telefon numarası gerekli</div>
          )}
        </div>

        <div className="flex flex-col">
          <label className={labelCls}>Not — opsiyonel</label>
          <textarea
            rows={2}
            value={note}
            onChange={e => setNote(e.target.value)}
            placeholder="Saç uzunluğu, özel istek..."
            className={`${inputCls} resize-y`}
          />
        </div>
      </div>

      <div className="flex gap-2.5 mt-5">
        <button
          onClick={onClose}
          className="flex-1 h-12 rounded-md border border-slate-200 bg-transparent text-slate-600 font-sans font-semibold text-sm cursor-pointer hover:border-slate-300 transition-colors duration-150"
        >
          Vazgeç
        </button>
        <button
          onClick={() => ok && onConfirm(name, phone, note)}
          className={[
            'flex-[1.5] h-12 rounded-md border-0 font-sans font-semibold text-sm transition-colors duration-[140ms]',
            ok
              ? 'bg-brand-600 text-white cursor-pointer hover:bg-brand-700'
              : 'bg-slate-200 text-slate-400 cursor-not-allowed',
          ].join(' ')}
        >
          Onayla
        </button>
      </div>
    </div>
  );
}

function ModalLoading() {
  return (
    <div className="px-7 py-16 text-center">
      <div className="w-9 h-9 mx-auto border-[3px] border-slate-200 border-t-brand-600 rounded-full animate-spin" />
      <div className="mt-4 text-sm text-slate-500">Randevu oluşturuluyor…</div>
    </div>
  );
}

function ModalSuccess({
  summary, onClose, staffPhone,
}: {
  summary: string; onClose: () => void; staffPhone?: string | null;
}) {
  return (
    <div className="p-7 pb-6">
      <div className="flex items-center gap-2.5">
        <div className="w-7 h-7 rounded-full bg-mint-600 text-white flex items-center justify-center font-bold text-sm flex-shrink-0">
          ✓
        </div>
        <Overline className="text-mint-700">Onaylandı</Overline>
      </div>
      <h2 className="text-2xl font-bold tracking-tight text-ink-900 mt-3.5">
        Randevunuz alındı
      </h2>
      <div className="text-sm text-slate-500 mt-2 leading-relaxed">
        {summary}
      </div>
      <div className="bg-slate-50 rounded-md px-3.5 py-3 mt-4 text-sm text-slate-600 leading-relaxed">
        Randevunuzu onaylayan bir mesaj telefonunuza iletilecek.
      </div>

      <div className="flex gap-2.5 mt-4">
        <button
          onClick={onClose}
          className="flex-1 h-12 rounded-md border border-slate-200 bg-transparent text-slate-600 font-sans font-semibold text-sm cursor-pointer hover:border-slate-300 transition-colors duration-150"
        >
          Yeni Randevu
        </button>
        <button
          onClick={onClose}
          className="flex-[1.5] h-12 rounded-md border-0 bg-brand-600 text-white font-sans font-semibold text-sm cursor-pointer hover:bg-brand-700 transition-colors duration-150 flex items-center justify-center"
        >
          Tamam
        </button>
      </div>

      {staffPhone && (
        <button
          onClick={() => {
            const phone = staffPhone.replace(/\D/g, '');
            const msg = encodeURIComponent(`Merhaba, ${summary} randevusu aldım. Bilginize 🙏`);
            window.open(`whatsapp://send?phone=90${phone}&text=${msg}`, '_self');
          }}
          className="w-full px-5 py-3 mt-2 bg-[#25D366] text-white border-none rounded-md text-sm font-semibold cursor-pointer font-sans"
        >
          💬 Berberi WhatsApp ile Bilgilendir
        </button>
      )}
    </div>
  );
}

function ModalError({ errorType, onClose }: { errorType: ErrorType; onClose: () => void }) {
  const isConflict = errorType === 'conflict';
  return (
    <div className="p-7 pb-6">
      <div className="flex items-center gap-2.5">
        <div className="w-7 h-7 rounded-full bg-coral-600 text-white flex items-center justify-center font-bold text-[15px] flex-shrink-0">
          !
        </div>
        <Overline className="text-coral-700">Çakışma</Overline>
      </div>
      <h2 className="text-2xl font-bold tracking-tight text-ink-900 mt-3.5">
        {isConflict ? 'Bu saat az önce doldu' : 'Randevu oluşturulamadı'}
      </h2>
      <div className="text-sm text-slate-600 mt-2 leading-relaxed">
        {isConflict
          ? 'Başka bir saat seçin ve tekrar deneyin.'
          : 'Bir hata oluştu. Lütfen tekrar deneyin.'}
      </div>
      <button
        onClick={onClose}
        className="mt-5 w-full h-12 rounded-md border-0 bg-ink-900 text-white font-sans font-semibold text-sm cursor-pointer hover:bg-ink-800 transition-colors duration-150"
      >
        {isConflict ? 'Saat Seç' : 'Kapat'}
      </button>
    </div>
  );
}

export function BookingModal({
  open, onClose, summary,
  shopId, shopSlug, staffId, staffPhone, serviceId, startsAt, onSuccess,
}: BookingModalProps) {
  const [state,     setState]     = useState<ModalState>('form');
  const [errorType, setErrorType] = useState<ErrorType>('conflict');
  const submittingRef = useRef(false);

  if (!open) return null;
  void shopId;

  async function handleConfirm(name: string, phone: string, note: string) {
    if (submittingRef.current) return;
    submittingRef.current = true;
    setState('loading');
    try {
      const res = await fetch(`${FN_BASE}/widget-book-appointment`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          shop_slug:      shopSlug,
          service_id:     serviceId,
          staff_id:       staffId,
          starts_at:      startsAt,
          customer_name:  name.trim(),
          customer_phone: phone.trim() || undefined,
          customer_notes: note.trim()  || undefined,
        }),
      });
      if (res.status === 409) { setErrorType('conflict'); setState('error'); return; }
      if (res.status === 429) { setErrorType('generic');  setState('error'); return; }
      if (!res.ok)            { setErrorType('generic');  setState('error'); return; }
      setState('success');
      onSuccess();
    } catch {
      setErrorType('generic');
      setState('error');
    } finally {
      submittingRef.current = false;
    }
  }

  function handleClose() {
    setState('form');
    setErrorType('conflict');
    onClose();
  }

  return (
    <div
      onClick={handleClose}
      className="fixed inset-0 bg-ink-900/40 backdrop-blur-sm flex items-center justify-center p-6 z-[1000]"
      style={{ animation: 'fadeIn 180ms ease' }}
    >
      <div
        onClick={e => e.stopPropagation()}
        className="bg-slate-0 rounded-xl w-full max-w-[456px] shadow-lg border border-slate-200 overflow-hidden"
        style={{ animation: 'slideUp 280ms cubic-bezier(.32,.72,.0,1)' }}
      >
        {state === 'form'    && <ModalForm    summary={summary} onClose={handleClose} onConfirm={handleConfirm} />}
        {state === 'loading' && <ModalLoading />}
        {state === 'success' && <ModalSuccess summary={summary} onClose={handleClose} staffPhone={staffPhone} />}
        {state === 'error'   && <ModalError   errorType={errorType} onClose={handleClose} />}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: TypeScript check**

```bash
cd apps/web && npx tsc --noEmit 2>&1 | grep -v "\.expo/types"
```

Expected: No output.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/BookingModal.tsx
git commit -m "feat(web): BookingModal — Tailwind migration + refined form/modal states"
```

---

### Task 5: Final build verification

**Files:** none (verification only)

- [ ] **Step 1: Full Next.js build**

```bash
cd apps/web && npx next build 2>&1 | tail -30
```

Expected output ends with something like:
```
Route (app)                              Size     First Load JS
┌ ○ /                                   ...
└ ○ /[slug]                             ...
✓ Generating static pages
```

No TypeScript errors, no import failures, no missing Tailwind class warnings.

- [ ] **Step 2: Update memory**

Open `C:\Users\Emre\.claude\projects\C--Users-Emre-Berber-randevu\memory\project_ship_status.md` and note that `ui/booking-overhaul` branch is complete and ready for merge/review.
