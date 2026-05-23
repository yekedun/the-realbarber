'use client';

// ServiceSelector — exact service row layout from index.html / screen-22

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
    return <p style={{ fontSize: 14, color: 'var(--fg-4)', padding: '16px 0' }}>Henüz hizmet tanımlanmamış.</p>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {services.map(s => {
        const isSel = selected === s.id;
        return (
          <div
            key={s.id}
            onClick={() => onSelect(s.id)}
            style={{
              padding: '16px 18px',
              borderRadius: 12,
              cursor: 'pointer',
              border: `1.5px solid ${isSel ? 'var(--brand-600)' : 'var(--border)'}`,
              background: isSel ? 'var(--brand-600)' : 'var(--bg-elevated)',
              color: isSel ? '#fff' : 'var(--fg-1)',
              transition: 'border-color 140ms, background 140ms, box-shadow 120ms',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
              {/* Left: name + duration badge */}
              <div>
                <div style={{ fontSize: 16, fontWeight: 600 }}>{s.name}</div>
                {/* Duration badge */}
                <div style={{
                  display: 'inline-flex', alignItems: 'center', marginTop: 6,
                  fontSize: 12, fontWeight: 600,
                  color: isSel ? 'rgba(255,255,255,0.65)' : 'var(--fg-4)',
                  background: isSel ? 'rgba(255,255,255,0.12)' : 'var(--bg-sunken)',
                  border: `1px solid ${isSel ? 'rgba(255,255,255,0.15)' : 'var(--border)'}`,
                  borderRadius: 9999, padding: '2px 8px', letterSpacing: '0.02em',
                }}>
                  {s.duration_min} dk
                </div>
              </div>
              {/* Right: price badge */}
              <div style={{
                fontSize: 22, fontWeight: 700, fontVariantNumeric: 'tabular-nums', flexShrink: 0,
                color: isSel ? '#fff' : 'var(--fg-1)',
              }}>
                {s.price}₺
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
