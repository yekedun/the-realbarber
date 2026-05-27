'use client';

import { useEffect, useState } from 'react';

// SlotGrid — from index.html slot section
// 5-col grid on ≥400px, 4-col on <400px (useColumns drives this dynamically)

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
