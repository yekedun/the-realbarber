'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { ServiceSelector, type Service } from '../../components/ServiceSelector';
import { SlotGrid } from '../../components/SlotGrid';
import { BookingModal } from '../../components/BookingModal';
import { nextBookingSuccessState } from './booking-flow-state';
import { trackWebEvent } from '../../lib/analytics';

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
      <header className="bg-slate-0 shadow-xs border-b border-slate-100">
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
            <div className="inline-flex items-center gap-1.5 mt-3 bg-brand-100 border border-[#A5B4FC] text-brand-700 text-xs font-semibold rounded-pill px-3 py-1">
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
                <StaffChip key={s.id} label={s.name ?? 'İsimsiz'} selected={selStaff === s.id} onClick={() => { setSelStaff(s.id); setSelSlot(null); }} />
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
              onClick={() => { trackWebEvent('web_booking_started', { shop_slug: shop.slug, service_id: selService ?? undefined }); setModalOpen(true); }}
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
          trackWebEvent('web_booking_completed', { shop_slug: shop.slug, service_id: selService ?? undefined });
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
        'px-4 py-3 rounded-pill text-sm font-semibold cursor-pointer font-sans border',
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
