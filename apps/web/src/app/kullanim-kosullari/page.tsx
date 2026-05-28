// /kullanim-kosullari · Terms of Service
// App Store ve Google Play için zorunlu sayfa.
// ⚠️  İletişim bilgilerini ve şirket adını kendi bilgilerinle güncelle.
import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Kullanım Koşulları — Sıradaki',
  description: 'Sıradaki uygulamasının kullanım koşulları.',
};

const LAST_UPDATED = '24 Mayıs 2026';
const CONTACT_EMAIL = 'emreyek29@gmail.com';
const DATA_CONTROLLER = 'Yunus Emre Kadakal';

export default function KullanimKosullariPage() {
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
          Kullanım Koşulları
        </h1>

        <Legal>
          <H2>1. Taraflar ve Kapsam</H2>
          <P>
            Bu Kullanım Koşulları, {DATA_CONTROLLER} (&quot;Sıradaki&quot;) tarafından sağlanan
            Sıradaki mobil uygulaması ve web sitesini kullanan tüm kullanıcılar için geçerlidir.
            Uygulamayı kullanarak bu koşulları kabul etmiş sayılırsınız.
          </P>

          <H2>2. Hizmetin Tanımı</H2>
          <P>
            Sıradaki, berber, kuaför ve benzeri kişisel bakım işletmelerinin online randevu
            almasına, ekip yönetimine ve kazanç takibine olanak tanıyan bir yazılım hizmetidir (SaaS).
          </P>

          <H2>3. Hesap Oluşturma ve Güvenlik</H2>
          <P>
            Hesap oluştururken doğru ve güncel bilgi sağlamak zorundasınız.
            Hesabınızın güvenliğinden siz sorumlusunuz. Şifrenizi kimseyle paylaşmayın.
            Hesabınızda yetkisiz kullanım fark ederseniz derhal{' '}
            <a href={`mailto:${CONTACT_EMAIL}`} style={{ color: 'var(--brand-600)' }}>{CONTACT_EMAIL}</a>{' '}
            adresine bildirin.
          </P>

          <H2>4. Kullanıcı Sorumlulukları</H2>
          <P>Aşağıdaki davranışlar yasaktır:</P>
          <ul>
            <li>Yanlış veya yanıltıcı bilgi paylaşmak</li>
            <li>Başka kullanıcıların verilerine izinsiz erişmeye çalışmak</li>
            <li>Platformu kötü amaçlı yazılım yaymak için kullanmak</li>
            <li>Hizmetin aşırı yüklenme ya da bozulmasına neden olmak</li>
            <li>Uygulamayı yasadışı amaçlarla kullanmak</li>
          </ul>

          <H2>5. Ücretlendirme</H2>
          <P>
            Sıradaki şu an ücretsizdir. Ücretli özelliklerin devreye alınması durumunda
            kullanıcılar önceden e-posta ile bilgilendirilecektir. Ücret değişikliğini
            kabul etmemeniz durumunda hesabınızı ücretsiz olarak kapatma hakkınız saklıdır.
          </P>

          <H2>6. Hizmet Sürekliliği</H2>
          <P>
            Bakım, güncelleme veya teknik sorunlar nedeniyle geçici kesintiler yaşanabilir.
            Sıradaki, makul süre öncesinde kullanıcıları planlı bakımlar hakkında bilgilendirir.
          </P>

          <H2>7. Fikri Mülkiyet</H2>
          <P>
            Uygulamada yer alan tüm içerik, tasarım ve yazılım {DATA_CONTROLLER}&apos;e aittir.
            Kullanıcılar yalnızca kişisel ve ticari kullanım hakkı elde eder;
            uygulamayı kopyalamak, değiştirmek veya dağıtmak yasaktır.
          </P>

          <H2>8. Hesap Silme</H2>
          <P>
            Hesabınızı dilediğiniz zaman uygulama içinden (Ayarlar → Hesabımı Sil) veya
            e-posta yoluyla kapatabilirsiniz. Hesap silindikten sonra verileriniz
            Gizlilik Politikası&apos;nda belirtilen süre içinde silinir.
          </P>

          <H2>9. Sorumluluğun Sınırlandırılması</H2>
          <P>
            Sıradaki, kullanıcıların platformda oluşturduğu randevular ile işletme-müşteri
            arasındaki anlaşmazlıklardan sorumlu değildir. Platform, doğrudan veya dolaylı
            zararlar için azami yasal sınırlar dahilinde sorumluluk üstlenir.
          </P>

          <H2>10. Uygulanacak Hukuk</H2>
          <P>
            Bu koşullar Türk hukuku kapsamında yorumlanır. Anlaşmazlıklarda İstanbul
            Mahkemeleri ve İcra Daireleri yetkilidir.
          </P>

          <H2>11. İletişim</H2>
          <P>
            Kullanım koşullarıyla ilgili sorularınız için:{' '}
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
