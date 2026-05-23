import Link from 'next/link';

// W4 — 404 page from 404.html

const SUGGESTIONS = [
  { name: 'Keskin Berber', slug: 'keskin-berber', color: '#1E3A8A' },
  { name: 'Demir Kuaför',  slug: 'demir-kuafor',  color: '#00B894' },
  { name: 'Yılmaz Berber', slug: 'yilmaz-berber', color: '#A0303F' },
  { name: 'Lale Güzellik', slug: 'lale-guzellik', color: '#6F4A14' },
];

function initials(name: string) {
  return name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
}

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: 'var(--bg)' }}>

      {/* ── Nav ── */}
      <nav
        className="sticky top-0 z-10 flex items-center px-8 border-b"
        style={{ height: 56, background: 'var(--bg)', borderColor: 'var(--border)' }}
      >
        <Link
          href="/"
          className="flex items-center gap-2.5 no-underline"
          style={{ fontSize: 15, fontWeight: 700, color: 'var(--fg-1)', letterSpacing: '-0.01em' }}
        >
          <div
            className="flex items-center justify-center rounded-[8px]"
            style={{ width: 28, height: 28, background: 'var(--brand-600)', color: '#fff', fontWeight: 800, fontSize: 15 }}
          >
            ›
          </div>
          Sıradaki
        </Link>
      </nav>

      {/* ── Hero ── */}
      <div className="flex-1 flex flex-col items-center justify-center text-center px-6 py-20">

        {/* 404 number */}
        <div
          className="fade-1 tabular-nums"
          style={{
            fontSize: 'clamp(96px, 18vw, 180px)',
            fontWeight: 700,
            letterSpacing: '-0.04em',
            lineHeight: 0.9,
            color: 'var(--brand-600)',
            marginBottom: 32,
          }}
        >
          404
        </div>

        {/* Title */}
        <div
          className="fade-2"
          style={{ fontSize: 'clamp(22px, 4vw, 34px)', fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--fg-1)', marginBottom: 12 }}
        >
          Berber Bulunamadı
        </div>

        {/* Body */}
        <p
          className="fade-3"
          style={{ fontSize: 16, color: 'var(--fg-3)', lineHeight: 1.6, maxWidth: 400, margin: '0 auto 40px' }}
        >
          Aradığın berber profili mevcut değil ya da bağlantı yanlış yazılmış olabilir.
        </p>

        {/* Buttons */}
        <div className="fade-4 flex gap-3 flex-wrap justify-center">
          <Link
            href="/"
            className="inline-flex items-center"
            style={{
              height: 48, padding: '0 24px', borderRadius: 12, border: 0,
              background: 'var(--brand-600)', color: '#fff',
              fontWeight: 600, fontSize: 15, textDecoration: 'none',
              transition: 'filter 140ms, transform 120ms',
            }}
          >
            Örnek Berbere Bak
          </Link>
          <button
            onClick={() => typeof window !== 'undefined' && window.history.back()}
            style={{
              height: 48, padding: '0 24px', borderRadius: 12,
              border: '1.5px solid var(--border)', background: 'transparent',
              color: 'var(--fg-2)', fontFamily: 'inherit', fontWeight: 600, fontSize: 15,
              cursor: 'pointer', transition: 'border-color 140ms, transform 120ms',
            }}
          >
            Geri Dön
          </button>
        </div>

        {/* Suggestions */}
        <div className="fade-5 w-full mt-14 px-6" style={{ maxWidth: 680, margin: '56px auto 0' }}>
          <div
            className="text-left mb-3"
            style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.16em', textTransform: 'uppercase', color: 'var(--fg-4)' }}
          >
            Popüler Berberler
          </div>
          <div className="grid gap-2.5" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))' }}>
            {SUGGESTIONS.map(s => (
              <Link
                key={s.slug}
                href={`/${s.slug}`}
                className="flex items-center gap-3 no-underline"
                style={{
                  padding: '14px 16px', borderRadius: 12,
                  border: '1.5px solid var(--border)',
                  background: 'var(--bg-elevated)',
                  transition: 'border-color 140ms, box-shadow 140ms, transform 120ms',
                }}
              >
                <div
                  className="shrink-0 flex items-center justify-center rounded-full"
                  style={{ width: 36, height: 36, background: s.color, color: '#fff', fontWeight: 700, fontSize: 13 }}
                >
                  {initials(s.name)}
                </div>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--fg-1)' }}>{s.name}</div>
                  <div style={{ fontSize: 12, color: 'var(--fg-3)', marginTop: 2 }}>siradaki.app/{s.slug}</div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </div>

      {/* ── Footer ── */}
      <footer
        className="border-t text-center"
        style={{
          padding: '24px 32px', borderColor: 'var(--border)',
          fontSize: 12, color: 'var(--fg-4)', fontFamily: 'var(--font-mono)',
        }}
      >
        siradaki.app · Randevu ve ekip yönetim platformu
      </footer>

    </div>
  );
}
