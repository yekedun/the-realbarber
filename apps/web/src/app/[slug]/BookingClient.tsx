'use client';

// W2 · Booking Client — interactive booking flow
// Service selector → staff selector → date picker → slot grid → modal confirm

import { useState, useEffect, useCallback, useRef } from 'react';
import { ServiceSelector, type Service } from '../../components/ServiceSelector';
import { SlotGrid } from '../../components/SlotGrid';
import { BookingModal } from '../../components/BookingModal';
import { nextBookingSuccessState } from './booking-flow-state';

/* ── Types ────────────────────────────────────────────────────── */
interface StaffMember { id: string; name: string; phone: string | null; }
interface Shop { id: string; name: string; address: string | null; slug: string; }
interface Props { shop: Shop; services: Service[]; staff: StaffMember[]; preselectedStaffId?: string | null; }
interface RawSlot { starts_at: string; available: boolean; }

/* ── Helpers ──────────────────────────────────────────────────── */
const TR_DAYS  = ['Paz','Pzt','Sal','Çar','Per','Cum','Cmt'];
const TR_MON   = ['Oca','Şub','Mar','Nis','May','Haz','Tem','Ağu','Eyl','Eki','Kas','Ara'];

function toDateStr(d: Date) {
  // YYYY-MM-DD in local clock
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

/* ── Component ────────────────────────────────────────────────── */
export default function BookingClient({ shop, services, staff, preselectedStaffId }: Props) {
  const days = buildDays(14);

  const abortRef = useRef<AbortController | null>(null);

  const [selService, setSelService] = useState<string | null>(services[0]?.id ?? null);
  const [selStaff,   setSelStaff]   = useState<string | null>(preselectedStaffId ?? null);
  const [selDate,    setSelDate]    = useState<Date>(() => { const d=new Date(); d.setHours(0,0,0,0); return d; });
  const [selSlot,    setSelSlot]    = useState<string | null>(null); // HH:MM label

  const [rawSlots,   setRawSlots]   = useState<RawSlot[]>([]);
  const [slotsLoad,  setSlotsLoad]  = useState(false);
  const [slotsErr,   setSlotsErr]   = useState<string | null>(null);
  const [isClosed,   setIsClosed]   = useState(false);
  const [modalOpen,  setModalOpen]  = useState(false);

  /* Fetch available slots */
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
      const res = await fetch(`${FN_BASE}/widget-get-availability?${qs}`, {
        signal: controller.signal,
      });
      if (!res.ok) { setSlotsErr('Müsaitlik bilgisi alınamadı.'); return; }
      const data = await res.json();
      if (data.closed) {
        setIsClosed(true);
      } else {
        setRawSlots(data.slots ?? []);
      }
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') return;
      setSlotsErr('Bağlantı hatası. Tekrar deneyin.');
    } finally {
      setSlotsLoad(false);
    }
  }, [selService, selDate, selStaff, shop.slug]);

  useEffect(() => { fetchSlots(); }, [fetchSlots]);

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible') fetchSlots();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      abortRef.current?.abort();
    };
  }, [fetchSlots]);

  /* Map rawSlots → SlotGrid format */
  const slotItems = rawSlots.map(s => ({ time: toTimeLabel(s.starts_at), available: s.available }));
  const isAllFull = !isClosed && !slotsLoad && rawSlots.length > 0 && rawSlots.every(s => !s.available);

  /* Find ISO timestamp for the selected slot label */
  const selRaw    = rawSlots.find(s => toTimeLabel(s.starts_at) === selSlot);
  const selISO    = selRaw?.starts_at ?? '';

  /* Booking summary */
  const svc          = services.find(s => s.id === selService);
  const selectedStaff = staff.find(s => s.id === selStaff) ?? null;
  const staffName    = selectedStaff?.name;
  const summary   = svc
    ? `${svc.name} · ${svc.duration_min} dk · ${toDateStr(selDate).split('-').reverse().join('.')} ${selSlot ?? ''}${staffName ? ' · '+staffName : ''}`
    : '';

  /* Barber badge: shown when pre-selected, disappears when user picks someone else */
  const preselectedName = preselectedStaffId ? staff.find(s => s.id === preselectedStaffId)?.name : null;
  const showBarberBadge = preselectedName !== null && preselectedName !== undefined && selStaff === preselectedStaffId;

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', fontFamily: 'var(--font-sans)' }}>

      {/* ── Header ──────────────────────────────────────────── */}
      <header style={{ background: 'var(--bg-elevated)', borderBottom: '1px solid var(--divider)', padding: '20px 20px 16px' }}>
        <div style={{ maxWidth: 480, margin: '0 auto' }}>
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.22em', textTransform: 'uppercase', color: 'var(--fg-4)' }}>
            Online Randevu · Sıradaki
          </div>
          <h1 style={{ fontSize: 28, fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--fg-1)', marginTop: 8, marginBottom: 0 }}>
            {shop.name}
          </h1>
          {shop.address && (
            <div style={{ fontSize: 13, color: 'var(--fg-3)', marginTop: 5 }}>{shop.address}</div>
          )}
          {showBarberBadge && (
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              marginTop: 10, padding: '4px 10px', borderRadius: 999,
              background: 'var(--brand-50, #EEF2FF)', border: '1px solid var(--brand-200, #A5B4FC)',
              fontSize: 12, fontWeight: 600, color: 'var(--brand-700, #3730A3)',
            }}>
              ✂ {preselectedName}&apos;in linkindesin
            </div>
          )}
        </div>
      </header>

      {/* ── Body ────────────────────────────────────────────── */}
      <div style={{ maxWidth: 480, margin: '0 auto', padding: '24px 20px 100px' }}>

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
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              <StaffChip label="Herhangi" selected={selStaff === null} onClick={() => { setSelStaff(null); setSelSlot(null); }} />
              {staff.map(s => (
                <StaffChip key={s.id} label={s.name} selected={selStaff === s.id} onClick={() => { setSelStaff(s.id); setSelSlot(null); }} />
              ))}
            </div>
          </Section>
        )}

        {/* 3 — Date */}
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

      {/* ── Sticky CTA ──────────────────────────────────────── */}
      {selSlot && (
        <div style={{
          position: 'fixed', bottom: 0, left: 0, right: 0,
          padding: '12px 20px 20px',
          background: 'var(--bg-elevated)',
          borderTop: '1px solid var(--divider)',
          animation: 'slideUp 180ms ease',
        }}>
          <div style={{ maxWidth: 480, margin: '0 auto' }}>
            <button
              onClick={() => setModalOpen(true)}
              style={{
                width: '100%', height: 52, borderRadius: 14, border: 0,
                background: 'var(--brand-600)', color: '#fff',
                fontFamily: 'inherit', fontWeight: 700, fontSize: 15,
                cursor: 'pointer', letterSpacing: '-0.01em',
              }}
            >
              Randevu Al — {selSlot}
            </button>
          </div>
        </div>
      )}

      {/* ── Booking Modal ────────────────────────────────────── */}
      <BookingModal
        open={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setSelSlot(null);
        }}
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

/* ── Sub-components ───────────────────────────────────────────── */
function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <section style={{ marginBottom: 28 }}>
      <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.22em', textTransform: 'uppercase', color: 'var(--fg-4)', marginBottom: 10 }}>
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
      style={{
        padding: '8px 18px', borderRadius: 999, fontSize: 13, fontWeight: 600,
        cursor: 'pointer', fontFamily: 'inherit',
        border: `1.5px solid ${selected ? 'var(--ink-900)' : 'var(--border)'}`,
        background: selected ? 'var(--ink-900)' : 'var(--bg-elevated)',
        color: selected ? '#fff' : 'var(--fg-2)',
        transition: 'background 120ms, border-color 120ms',
      }}
    >
      {label}
    </button>
  );
}
