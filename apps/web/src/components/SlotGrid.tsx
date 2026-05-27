'use client';

import { useEffect, useState } from 'react';

// SlotGrid — from index.html slot section
// 5-col grid on ≥480px, 4-col on <480px

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

  /* ── Loading skeleton ── */
  if (loading) {
    return (
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: 8 }}>
        {Array.from({ length: 10 }).map((_, i) => (
          <div
            key={i}
            style={{
              height: 50, borderRadius: 10,
              background: 'var(--slate-100)',
              animation: 'pulse 1.4s ease-in-out infinite',
            }}
          />
        ))}
      </div>
    );
  }

  /* ── Error + retry ── */
  if (error) {
    return (
      <div style={{ textAlign: 'center', padding: '24px 0' }}>
        <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--fg-1)' }}>
          Müsaitlik bilgisi alınamadı.
        </p>
        <p style={{ fontSize: 12, color: 'var(--fg-4)', marginTop: 4 }}>
          Bağlantıyı kontrol edip tekrar deneyin.
        </p>
        {onRetry && (
          <button
            onClick={onRetry}
            style={{
              marginTop: 12, fontSize: 13, fontWeight: 600,
              color: 'var(--brand-600)', background: 'none',
              border: 0, cursor: 'pointer', textDecoration: 'underline',
              textUnderlineOffset: 2, fontFamily: 'inherit',
            }}
          >
            Tekrar Dene
          </button>
        )}
      </div>
    );
  }

  /* ── Closed day ── */
  if (isClosed) {
    return (
      <p style={{ fontSize: 14, color: 'var(--fg-4)', padding: '16px 0' }}>
        Bu gün için çalışma saati tanımlanmamış.
      </p>
    );
  }

  /* ── All-full ── */
  if (isAllFull || (slots.length > 0 && slots.every(s => !s.available))) {
    return (
      <p style={{ fontSize: 14, color: 'var(--fg-4)', padding: '16px 0' }}>
        Bu günde müsait saat kalmadı. Başka bir gün seçin.
      </p>
    );
  }

  /* ── Grid of slots ── */
  return (
    <div style={{ display: 'grid', gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: 8 }}>
      {slots.map(s => (
        <button
          key={s.time}
          disabled={!s.available}
          onClick={() => s.available && onSelect(s.time)}
          style={{
            fontFamily: 'var(--font-sans)',
            fontSize: 14,
            fontWeight: (selected === s.time || s.available) ? 600 : 400,
            fontVariantNumeric: 'tabular-nums',
            height: 50,
            borderRadius: 10,
            cursor: s.available ? 'pointer' : 'not-allowed',
            pointerEvents: !s.available ? ('none' as const) : undefined,
            border: `1.5px solid ${
              selected === s.time ? 'var(--brand-600)'
              : !s.available ? 'transparent'
              : s.hot ? 'var(--umber-600)'
              : 'var(--border)'
            }`,
            background:
              selected === s.time ? 'var(--brand-600)'
              : !s.available ? 'var(--bg-sunken)'
              : s.hot ? 'var(--umber-100)'
              : 'var(--bg-elevated)',
            color:
              selected === s.time ? '#fff'
              : !s.available ? 'var(--fg-4)'
              : s.hot ? 'var(--umber-700)'
              : 'var(--fg-1)',
            transition: 'border-color 120ms, background 120ms, transform 100ms, box-shadow 120ms',
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 1,
          }}
        >
          <span>{s.time}</span>
          {s.hot && selected !== s.time && s.available && (
            <span style={{
              fontSize: 9, fontWeight: 600,
              color: 'var(--umber-600)', letterSpacing: '0.04em', lineHeight: 1,
            }}>
              az yer
            </span>
          )}
        </button>
      ))}
    </div>
  );
}
