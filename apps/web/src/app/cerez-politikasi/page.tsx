// /cerez-politikasi · Cookie Policy
import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Çerez Politikası — Sıradaki',
  description: 'Sıradaki web sitesinin çerez politikası.',
};

const LAST_UPDATED = '24 Mayıs 2026';
const CONTACT_EMAIL = 'emreyek29@gmail.com';

export default function CerezPolitikasiPage() {
  return (
    <div style={{ fontFamily: 'var(--font-sans)', color: 'var(--fg-1)', minHeight: '100vh', background: 'var(--bg)' }}>
      <nav style={{ background: 'var(--bg-elevated)', borderBottom: '1px solid var(--divider)', padding: '16px 24px' }}>
        <Link href="/" style={{ fontSize: 14, fontWeight: 700, color: 'var(--fg-1)', textDecoration: 'none' }}>← Sıradaki</Link>
      </nav>
      <div style={{ maxWidth: 720, margin: '0 auto', padding: '48px 24px 80px' }}>
        <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--fg-4)', marginBottom: 12 }}>
          Son güncelleme: {LAST_UPDATED}
        </p>
        <h1 style={{ fontSize: 'clamp(28px, 5vw, 40px)', fontWeight: 700, letterSpacing: '-0.02em', margin: '0 0 32px' }}>
          Çerez Politikası
        </h1>

        <Legal>
          <H2>1. Çerez Nedir?</H2>
          <P>
            Çerezler (cookie), web sitemizi ziyaret ettiğinizde tarayıcınıza kaydedilen
            küçük metin dosyalarıdır. Oturumunuzu açık tutmak ve deneyiminizi kişiselleştirmek
            için kullanılır.
          </P>

          <H2>2. Kullandığımız Çerezler</H2>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, marginBottom: 16 }}>
            <thead>
              <tr style={{ borderBottom: '2px solid var(--divider)', background: 'var(--bg-elevated)' }}>
                {['Çerez Adı', 'Amaç', 'Süre', 'Tür'].map(h => (
                  <th key={h} style={{ textAlign: 'left', padding: '8px 12px', fontWeight: 700, color: 'var(--fg-1)', fontSize: 12 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[
                ['sb-auth-token', 'Supabase oturum yönetimi', 'Oturum', 'Zorunlu'],
                ['sb-refresh-token', 'Oturum yenileme', '1 yıl', 'Zorunlu'],
                ['_ga / _gid', 'Google Analytics — anonim kullanım analizi', '2 yıl / 1 gün', 'Analitik'],
              ].map(([name, purpose, duration, type]) => (
                <tr key={name} style={{ borderBottom: '1px solid var(--divider)' }}>
                  <td style={{ padding: '8px 12px', fontFamily: 'var(--font-mono)', fontSize: 11 }}>{name}</td>
                  <td style={{ padding: '8px 12px', color: 'var(--fg-2)' }}>{purpose}</td>
                  <td style={{ padding: '8px 12px', color: 'var(--fg-3)' }}>{duration}</td>
                  <td style={{ padding: '8px 12px', color: 'var(--fg-3)' }}>{type}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <H2>3. Çerezleri Devre Dışı Bırakma</H2>
          <P>
            Tarayıcı ayarlarınızdan çerezleri devre dışı bırakabilirsiniz. Ancak
            &quot;Zorunlu&quot; çerezler devre dışı bırakıldığında giriş yapma özelliği
            çalışmayabilir.
          </P>

          <H2>4. İletişim</H2>
          <P>
            Çerez politikamız hakkındaki sorularınız için:{' '}
            <a href={`mailto:${CONTACT_EMAIL}`} style={{ color: 'var(--brand-600)' }}>{CONTACT_EMAIL}</a>
          </P>
        </Legal>
      </div>
    </div>
  );
}

function Legal({ children }: { children: React.ReactNode }) {
  return <div style={{ lineHeight: 1.7 }}>{children}</div>;
}
function H2({ children }: { children: React.ReactNode }) {
  return <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--fg-1)', margin: '36px 0 12px', letterSpacing: '-0.01em' }}>{children}</h2>;
}
function P({ children }: { children: React.ReactNode }) {
  return <p style={{ fontSize: 14, color: 'var(--fg-2)', margin: '0 0 14px', lineHeight: 1.7 }}>{children}</p>;
}
