import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Sıradaki — Berber Randevu Sistemi',
  description: "Instagram'a linkinizi koyun. Müşterileriniz randevusunu kendisi alsın.",
};

const steps = [
  { n: '01', title: 'Dükkanını tanıt', desc: 'Adını, şehrini, hizmetlerini gir. 5 dakikada rezervasyon linkin hazır.' },
  { n: '02', title: 'Linkini paylaş', desc: 'Instagram, WhatsApp, TikTok. Nereye koysan çalışır. Her berber için ayrı link.' },
  { n: '03', title: 'Randevular gelir', desc: 'Müşteri müsait saati seçer, randevuyu alır. Telefon beklemenize gerek yok.' },
];

const features = [
  { n: '01', title: 'Online Randevu', desc: 'Müşterileriniz 7/24 randevu alabilir. Dolu saatler görünmez, sadece müsaitler.' },
  { n: '02', title: 'Kişisel Link', desc: "Her ustanın kendi linki var. Instagram bio'suna koy, direkt sana gelsin." },
  { n: '03', title: 'Ekip Yönetimi', desc: 'Birden fazla usta çalışıyorsa herkese ayrı ajanda. Kimin ne zaman boş olduğunu görün.' },
  { n: '04', title: 'Kazanç Takibi', desc: 'Günlük, haftalık, aylık gelir raporları. Komisyon hesabı dahil.' },
  { n: '05', title: 'Mobil Uygulama', desc: "iOS ve Android'de çalışır. Gittiğin her yerden randevularını yönet." },
  { n: '06', title: 'İzin Yönetimi', desc: 'Tatil, öğle arası, geç gelme. Tek tıkla slotları kapat.' },
];

const BG   = '#F8F5F0';
const INK  = '#0F0E0C';
const SUB  = '#6B6560';
const MUTE = '#9B9590';
const DIV  = '#E5DFD5';
const CARD = '#FDFBF8';
const MONO = 'ui-monospace, "Cascadia Code", "Source Code Pro", Menlo, monospace';
const SERIF = 'Georgia, "Times New Roman", serif';

export default function LandingPage() {
  return (
    <div style={{ background: BG, color: INK, minHeight: '100vh', fontFamily: 'var(--font-montserrat), "Helvetica Neue", Arial, sans-serif' }}>

      {/* NAV */}
      <nav style={{
        borderBottom: `1px solid ${DIV}`,
        height: 56,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 24px',
        position: 'sticky', top: 0,
        background: BG, zIndex: 10,
      }}>
        <span style={{ fontFamily: MONO, fontSize: 14, fontWeight: 500, letterSpacing: '-0.01em' }}>
          Sıradaki
        </span>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <Link href="/giris" style={{ fontSize: 13, color: SUB, textDecoration: 'none', fontWeight: 500 }}>
            Giriş
          </Link>
          <Link href="/kayit" style={{
            fontSize: 12, fontWeight: 600, color: BG,
            background: INK, padding: '9px 20px',
            textDecoration: 'none', letterSpacing: '0.06em', textTransform: 'uppercase',
          }}>
            Ücretsiz Başla
          </Link>
        </div>
      </nav>

      {/* HERO */}
      <section style={{ maxWidth: 1024, margin: '0 auto', padding: '88px 24px 72px', borderBottom: `1px solid ${DIV}` }}>
        <p style={{ fontFamily: MONO, fontSize: 10, fontWeight: 500, letterSpacing: '0.2em', textTransform: 'uppercase', color: MUTE, marginBottom: 32 }}>
          Berber · Kuaför · Barber
        </p>
        <h1 style={{
          fontFamily: SERIF,
          fontSize: 'clamp(36px, 6vw, 64px)',
          fontWeight: 400, lineHeight: 1.05,
          letterSpacing: '-0.02em',
          margin: '0 0 24px', maxWidth: 680,
        }}>
          Müşterileriniz sizi<br />sosyal medyadan bulsun.
        </h1>
        <p style={{ fontSize: 17, lineHeight: 1.7, color: SUB, maxWidth: 460, margin: '0 0 44px' }}>
          Instagram&apos;a linkinizi koyun. Müşterileriniz randevusunu kendisi alsın —
          siz sadece işinize bakın.
        </p>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
          <Link href="/kayit" style={{
            fontSize: 12, fontWeight: 600, color: BG,
            background: INK, padding: '14px 36px',
            textDecoration: 'none', letterSpacing: '0.06em', textTransform: 'uppercase',
          }}>
            Ücretsiz Başla
          </Link>
          <a href="#nasil-calisir" style={{
            fontSize: 14, fontWeight: 500, color: INK,
            padding: '13px 24px',
            textDecoration: 'none',
            border: `1px solid #C8C0B4`,
            letterSpacing: '-0.01em',
          }}>
            Nasıl çalışır? →
          </a>
        </div>
      </section>

      {/* STATS */}
      <section style={{ maxWidth: 1024, margin: '0 auto', padding: '0 24px', borderBottom: `1px solid ${DIV}`, display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)' }}>
        {[
          { value: '5 dk', label: 'Kurulum süresi' },
          { value: '7/24', label: 'Randevu alınabilir' },
          { value: '0 ₺', label: 'Başlangıç ücreti' },
        ].map((s, i) => (
          <div key={i} style={{
            padding: '36px 0',
            borderRight: i < 2 ? `1px solid ${DIV}` : undefined,
            paddingLeft: i > 0 ? 40 : 0,
          }}>
            <div style={{ fontFamily: SERIF, fontSize: 'clamp(28px, 4vw, 42px)', fontWeight: 400, letterSpacing: '-0.03em', marginBottom: 8, lineHeight: 1 }}>
              {s.value}
            </div>
            <div style={{ fontFamily: MONO, fontSize: 10, fontWeight: 500, letterSpacing: '0.14em', textTransform: 'uppercase', color: MUTE }}>
              {s.label}
            </div>
          </div>
        ))}
      </section>

      {/* HOW IT WORKS */}
      <section id="nasil-calisir" style={{ maxWidth: 1024, margin: '0 auto', padding: '72px 24px', borderBottom: `1px solid ${DIV}` }}>
        <p style={{ fontFamily: MONO, fontSize: 10, fontWeight: 500, letterSpacing: '0.2em', textTransform: 'uppercase', color: MUTE, marginBottom: 48 }}>
          Nasıl çalışır
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 40 }}>
          {steps.map((s) => (
            <div key={s.n}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
                <span style={{ fontFamily: MONO, fontSize: 11, color: '#C8C0B4', flexShrink: 0 }}>{s.n}</span>
                <div style={{ height: 1, flex: 1, background: DIV }} />
              </div>
              <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 10, letterSpacing: '-0.01em' }}>{s.title}</h3>
              <p style={{ fontSize: 13, lineHeight: 1.7, color: SUB, margin: 0 }}>{s.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* FEATURES */}
      <section style={{ maxWidth: 1024, margin: '0 auto', padding: '72px 24px', borderBottom: `1px solid ${DIV}` }}>
        <p style={{ fontFamily: MONO, fontSize: 10, fontWeight: 500, letterSpacing: '0.2em', textTransform: 'uppercase', color: MUTE, marginBottom: 48 }}>
          Özellikler
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 2 }}>
          {features.map((f) => (
            <div key={f.n} style={{
              border: `1px solid ${DIV}`,
              padding: '28px 24px',
              background: CARD,
            }}>
              <span style={{ fontFamily: MONO, fontSize: 10, color: '#C8C0B4', display: 'block', marginBottom: 14 }}>{f.n}</span>
              <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 8, letterSpacing: '-0.01em' }}>{f.title}</h3>
              <p style={{ fontSize: 13, lineHeight: 1.7, color: SUB, margin: 0 }}>{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section style={{ maxWidth: 1024, margin: '0 auto', padding: '88px 24px', borderBottom: `1px solid ${DIV}`, textAlign: 'center' }}>
        <p style={{ fontFamily: MONO, fontSize: 10, fontWeight: 500, letterSpacing: '0.2em', textTransform: 'uppercase', color: MUTE, marginBottom: 24 }}>
          Başlamak için hazır mısınız?
        </p>
        <h2 style={{
          fontFamily: SERIF,
          fontSize: 'clamp(28px, 4vw, 48px)',
          fontWeight: 400, letterSpacing: '-0.02em',
          margin: '0 0 20px', lineHeight: 1.1,
        }}>
          Dükkanınızı dijitale taşıyın.
        </h2>
        <p style={{ fontSize: 15, color: SUB, marginBottom: 40, lineHeight: 1.7, maxWidth: 380, margin: '0 auto 40px' }}>
          Kaydolun, linkinizi alın, Instagram&apos;a koyun.<br />İlk randevu bugün gelebilir.
        </p>
        <Link href="/kayit" style={{
          fontSize: 12, fontWeight: 600, color: BG,
          background: INK, padding: '16px 44px',
          textDecoration: 'none', letterSpacing: '0.06em', textTransform: 'uppercase',
          display: 'inline-block',
        }}>
          Ücretsiz Başla
        </Link>
      </section>

      {/* FOOTER */}
      <footer style={{
        maxWidth: 1024, margin: '0 auto',
        padding: '32px 24px',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        flexWrap: 'wrap', gap: 16,
      }}>
        <span style={{ fontFamily: MONO, fontSize: 12, color: '#C8C0B4' }}>Sıradaki</span>
        <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
          {[
            { label: 'Gizlilik', href: '/gizlilik-politikasi' },
            { label: 'Koşullar', href: '/kullanim-kosullari' },
            { label: 'Çerezler', href: '/cerez-politikasi' },
          ].map((l) => (
            <Link key={l.href} href={l.href} style={{ fontSize: 12, color: MUTE, textDecoration: 'none' }}>
              {l.label}
            </Link>
          ))}
          <a href="mailto:destek@siradaki.com" style={{ fontSize: 12, color: MUTE, textDecoration: 'none' }}>
            İletişim
          </a>
        </div>
        <span style={{ fontFamily: MONO, fontSize: 11, color: '#C8C0B4' }}>
          © {new Date().getFullYear()}
        </span>
      </footer>

    </div>
  );
}
