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
