'use client';

// W3a — Booking modal (index.html Modal*)
// 4 states: form | loading | success | error
// Error sub-types: conflict | generic

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

/* ── Overline ─────────────────────────────────────────────────────── */
function Overline({ children, color }: { children: React.ReactNode; color?: string }) {
  return (
    <div style={{
      fontSize: 11, fontWeight: 600, letterSpacing: '0.16em',
      textTransform: 'uppercase', color: color ?? 'var(--fg-3)', lineHeight: 1,
    }}>
      {children}
    </div>
  );
}

/* ── Form ─────────────────────────────────────────────────────────── */
function ModalForm({
  summary, onClose, onConfirm,
}: {
  summary: string; onClose: () => void; onConfirm: (name: string, phone: string, note: string) => void;
}) {
  const [name,  setName]  = useState('');
  const [phone, setPhone] = useState('');
  const [note,  setNote]  = useState('');
  const ok = name.trim().length >= 2 && phone.trim().length >= 10;

  return (
    <div style={{ padding: '28px 28px 24px' }}>
      <Overline>Onaylama</Overline>
      <h2 style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-0.018em', marginTop: 10 }}>
        Randevuyu Onayla
      </h2>
      <div style={{ fontSize: 13, color: 'var(--fg-3)', marginTop: 6, lineHeight: 1.55 }}>
        {summary}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginTop: 22 }}>
        {/* Ad Soyad */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
          <label style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.16em', textTransform: 'uppercase', color: 'var(--fg-3)' }}>
            Ad Soyad
          </label>
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="örn. Ahmet Yılmaz"
            style={{
              fontFamily: 'var(--font-sans)', fontSize: 15, color: 'var(--fg-1)',
              background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 12,
              padding: '12px 14px', outline: 'none', width: '100%',
              transition: 'border-color 140ms',
            }}
          />
        </div>

        {/* Telefon */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
          <label style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.16em', textTransform: 'uppercase', color: 'var(--fg-3)' }}>
            Telefon
          </label>
          <input
            type="tel"
            value={phone}
            onChange={e => setPhone(e.target.value)}
            placeholder="0(5xx) xxx xx xx"
            style={{
              fontFamily: 'var(--font-sans)', fontSize: 15, color: 'var(--fg-1)',
              background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 12,
              padding: '12px 14px', outline: 'none', width: '100%',
              transition: 'border-color 140ms',
            }}
          />
          {phone.length > 0 && phone.trim().length < 10 && (
            <div style={{ fontSize: 12, color: 'var(--coral-600)', marginTop: 4 }}>
              Geçerli bir telefon numarası gir
            </div>
          )}
          {phone.length === 0 && name.trim().length >= 2 && (
            <div style={{ fontSize: 12, color: 'var(--fg-4)', marginTop: 4 }}>
              Randevu onayı için telefon numarası gerekli
            </div>
          )}
        </div>

        {/* Not */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
          <label style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.16em', textTransform: 'uppercase', color: 'var(--fg-3)' }}>
            Not — opsiyonel
          </label>
          <textarea
            rows={2}
            value={note}
            onChange={e => setNote(e.target.value)}
            placeholder="Saç uzunluğu, özel istek..."
            style={{
              fontFamily: 'var(--font-sans)', fontSize: 15, color: 'var(--fg-1)',
              background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 12,
              padding: '12px 14px', outline: 'none', width: '100%',
              transition: 'border-color 140ms', resize: 'vertical',
            }}
          />
        </div>
      </div>

      <div style={{ display: 'flex', gap: 10, marginTop: 22 }}>
        <button
          onClick={onClose}
          style={{
            flex: 1, height: 48, borderRadius: 12, border: '1.5px solid var(--border)',
            background: 'transparent', color: 'var(--fg-2)',
            fontFamily: 'inherit', fontWeight: 600, fontSize: 14, cursor: 'pointer',
          }}
        >
          Vazgeç
        </button>
        <button
          onClick={() => ok && onConfirm(name, phone, note)}
          style={{
            flex: 1.5, height: 48, borderRadius: 12, border: 0,
            background: ok ? 'var(--brand-600)' : 'var(--slate-300)',
            color: '#fff', fontFamily: 'inherit', fontWeight: 600, fontSize: 14,
            cursor: ok ? 'pointer' : 'not-allowed',
            transition: 'background 140ms',
          }}
        >
          Onayla
        </button>
      </div>
    </div>
  );
}

/* ── Loading ──────────────────────────────────────────────────────── */
function ModalLoading() {
  return (
    <div style={{ padding: '60px 28px', textAlign: 'center' }}>
      <div style={{
        width: 36, height: 36, margin: '0 auto',
        border: '3px solid var(--slate-200)', borderTopColor: 'var(--brand-600)',
        borderRadius: 9999, animation: 'spin 700ms linear infinite',
      }} />
      <div style={{ marginTop: 18, fontSize: 14, color: 'var(--fg-3)' }}>
        Randevu oluşturuluyor…
      </div>
    </div>
  );
}

/* ── Success ──────────────────────────────────────────────────────── */
function ModalSuccess({
  summary, onClose, staffPhone,
}: {
  summary: string; onClose: () => void; staffPhone?: string | null;
}) {
  return (
    <div style={{ padding: '28px 28px 24px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{
          width: 28, height: 28, borderRadius: 9999, background: 'var(--mint-600)',
          color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontWeight: 700, fontSize: 14,
        }}>✓</div>
        <Overline color="var(--mint-700)">Onaylandı</Overline>
      </div>
      <h2 style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-0.018em', marginTop: 14 }}>
        Randevunuz alındı
      </h2>
      <div style={{ fontSize: 13, color: 'var(--fg-3)', marginTop: 8, lineHeight: 1.55 }}>
        {summary}
      </div>
      <div style={{
        background: 'var(--bg-sunken)', borderRadius: 10, padding: '12px 14px', marginTop: 18,
        fontSize: 13, color: 'var(--fg-2)', lineHeight: 1.5,
      }}>
        Randevunuzu onaylayan bir mesaj telefonunuza iletilecek.
      </div>

      <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
        <button
          onClick={onClose}
          style={{
            flex: 1, height: 48, borderRadius: 12, border: '1.5px solid var(--border)',
            background: 'transparent', color: 'var(--fg-2)',
            fontFamily: 'inherit', fontWeight: 600, fontSize: 14, cursor: 'pointer',
          }}
        >
          Yeni Randevu
        </button>
        <button
          onClick={onClose}
          style={{
            flex: 1.5, height: 48, borderRadius: 12, border: 0,
            background: 'var(--brand-600)', color: '#fff',
            fontFamily: 'inherit', fontWeight: 600, fontSize: 14, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          Tamam
        </button>
      </div>

      {staffPhone && (
        <button
          onClick={() => {
            const phone = staffPhone.replace(/\D/g, '');
            const msg = encodeURIComponent(
              `Merhaba, ${summary} randevusu aldım. Bilginize 🙏`
            );
            window.open(`whatsapp://send?phone=90${phone}&text=${msg}`, '_self');
          }}
          style={{
            width: '100%',
            padding: '12px 20px',
            marginTop: 8,
            background: '#25D366',
            color: '#fff',
            border: 'none',
            borderRadius: 10,
            fontSize: 14,
            fontWeight: 600,
            cursor: 'pointer',
            fontFamily: 'inherit',
          }}
        >
          💬 Berberi WhatsApp ile Bilgilendir
        </button>
      )}
    </div>
  );
}

/* ── Error ────────────────────────────────────────────────────────── */
function ModalError({ errorType, onClose }: { errorType: ErrorType; onClose: () => void }) {
  const isConflict = errorType === 'conflict';
  return (
    <div style={{ padding: '28px 28px 24px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{
          width: 28, height: 28, borderRadius: 9999, background: 'var(--coral-600)',
          color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontWeight: 700, fontSize: 15,
        }}>!</div>
        <Overline color="var(--coral-700)">Çakışma</Overline>
      </div>
      <h2 style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-0.018em', marginTop: 14 }}>
        {isConflict ? 'Bu saat az önce doldu' : 'Randevu oluşturulamadı'}
      </h2>
      <div style={{ fontSize: 14, color: 'var(--fg-2)', marginTop: 8, lineHeight: 1.55 }}>
        {isConflict
          ? 'Başka bir saat seçin ve tekrar deneyin.'
          : 'Bir hata oluştu. Lütfen tekrar deneyin.'}
      </div>
      <button
        onClick={onClose}
        style={{
          marginTop: 22, width: '100%', height: 48, borderRadius: 12, border: 0,
          background: 'var(--ink-900)', color: '#fff',
          fontFamily: 'inherit', fontWeight: 600, fontSize: 14, cursor: 'pointer',
        }}
      >
        {isConflict ? 'Saat Seç' : 'Kapat'}
      </button>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════
   BOOKING MODAL (W3a)
   ════════════════════════════════════════════════════════════════════ */
export function BookingModal({
  open, onClose, summary,
  shopId, shopSlug, staffId, staffPhone, serviceId, startsAt, onSuccess,
}: BookingModalProps) {
  const [state,     setState]     = useState<ModalState>('form');
  const [errorType, setErrorType] = useState<ErrorType>('conflict');
  const submittingRef = useRef(false);

  if (!open) return null;
  void shopId; // kept in props for future use

  async function handleConfirm(name: string, phone: string, note: string) {
    if (submittingRef.current) return;
    submittingRef.current = true;
    setState('loading');
    try {
      const res = await fetch(`${FN_BASE}/widget-book-appointment`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          shop_slug:       shopSlug,
          service_id:      serviceId,
          staff_id:        staffId,
          starts_at:       startsAt,
          customer_name:   name.trim(),
          customer_phone:  phone.trim() || undefined,
          customer_notes:  note.trim()  || undefined,
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
    // Reset state for next use
    setState('form');
    setErrorType('conflict');
    onClose();
  }

  return (
    // Overlay
    <div
      onClick={handleClose}
      style={{
        position: 'fixed', inset: 0,
        background: 'rgba(11,18,32,0.42)',
        backdropFilter: 'blur(6px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 24, zIndex: 1000,
        animation: 'fadeIn 180ms ease',
      }}
    >
      {/* Modal card */}
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: 'var(--bg-elevated)',
          borderRadius: 18,
          width: '100%', maxWidth: 456,
          boxShadow: 'var(--shadow-lg)',
          border: '1px solid var(--border)',
          overflow: 'hidden',
          animation: 'slideUp 280ms cubic-bezier(.32,.72,.0,1)',
        }}
      >
        {state === 'form'    && <ModalForm    summary={summary} onClose={handleClose} onConfirm={handleConfirm} />}
        {state === 'loading' && <ModalLoading />}
        {state === 'success' && <ModalSuccess summary={summary} onClose={handleClose} staffPhone={staffPhone} />}
        {state === 'error'   && <ModalError   errorType={errorType} onClose={handleClose} />}
      </div>
    </div>
  );
}
