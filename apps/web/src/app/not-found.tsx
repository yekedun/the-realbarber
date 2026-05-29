'use client';

import Link from 'next/link';

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

        <div
          className="fade-2"
          style={{ fontSize: 'clamp(22px, 4vw, 34px)', fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--fg-1)', marginBottom: 12 }}
        >
          Sayfa Bulunamadı
        </div>

        <p
          className="fade-3"
          style={{ fontSize: 16, color: 'var(--fg-3)', lineHeight: 1.6, maxWidth: 400, margin: '0 auto 40px' }}
        >
          Aradığın sayfa mevcut değil ya da bağlantı yanlış yazılmış olabilir.
        </p>

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
            Ana Sayfaya Dön
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
