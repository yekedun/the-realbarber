'use client';

// W3a — Booking modal
// 4 states: form | loading | success | error

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

  const inputCls = 'bg-slate-50 border border-slate-200 rounded-md px-3.5 py-3 text-[15px] text-ink-900 font-sans w-full outline-none transition-[border-color,box-shadow] duration-[140ms] focus:border-brand-600 focus:ring-2 focus:ring-brand-100';
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
          <label htmlFor="booking-name" className={labelCls}>Ad Soyad</label>
          <input
            id="booking-name"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="örn. Ahmet Yılmaz"
            className={inputCls}
          />
        </div>

        <div className="flex flex-col">
          <label htmlFor="booking-phone" className={labelCls}>Telefon</label>
          <input
            id="booking-phone"
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
          <label htmlFor="booking-note" className={labelCls}>Not — opsiyonel</label>
          <textarea
            id="booking-note"
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
          aria-disabled={!ok}
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
        className="bg-white rounded-xl w-full max-w-[456px] shadow-lg border border-slate-200 overflow-hidden"
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
