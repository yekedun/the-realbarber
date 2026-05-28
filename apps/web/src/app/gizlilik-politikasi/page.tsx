// /gizlilik-politikasi · Privacy Policy — KVKK uyumlu
// App Store ve Google Play için zorunlu sayfa.
// ⚠️  İletişim bilgilerini ve veri sorumlusu adını kendi bilgilerinle güncelle.
import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Gizlilik Politikası — Sıradaki',
  description: 'Sıradaki uygulamasının KVKK kapsamındaki gizlilik politikası.',
};

const LAST_UPDATED = '24 Mayıs 2026';
const CONTACT_EMAIL = 'emreyek29@gmail.com';
const DATA_CONTROLLER = 'Yunus Emre Kadakal';

export default function GizlilikPolitikasiPage() {
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
          Gizlilik Politikası
        </h1>

        <Legal>
          <H2>1. Veri Sorumlusu</H2>
          <P>
            Bu Gizlilik Politikası, {DATA_CONTROLLER} (&quot;Sıradaki&quot;, &quot;biz&quot;) tarafından
            işletilen Sıradaki mobil uygulaması ve web sitesi (sıradaki.com) için geçerlidir.
            Kişisel verilerin işlenmesinden sorumlu veri sorumlusu {DATA_CONTROLLER}&apos;dir.
          </P>

          <H2>2. Hangi Kişisel Veriler Toplanıyor?</H2>
          <P>Sıradaki, aşağıdaki kişisel verileri toplamaktadır:</P>
          <ul>
            <li><strong>Hesap bilgileri:</strong> Ad, soyadı, e-posta adresi, şifrelenmiş parola.</li>
            <li><strong>İşletme bilgileri:</strong> Dükkan adı, adresi, çalışma saatleri, hizmet listesi.</li>
            <li><strong>Randevu bilgileri:</strong> Müşteri adı, telefon numarası, randevu tarihi ve saati, seçilen hizmet.</li>
            <li><strong>Cihaz bilgileri:</strong> İşletim sistemi sürümü, uygulama sürümü, hata raporları (anonim).</li>
            <li><strong>Kullanım verileri:</strong> Uygulama içi eylemler (anonim analitik).</li>
          </ul>

          <H2>3. Verilerin İşlenme Amaçları</H2>
          <P>Toplanan veriler aşağıdaki amaçlarla işlenmektedir:</P>
          <ul>
            <li>Randevu oluşturma, güncelleme ve iptal etme hizmetlerinin sunulması</li>
            <li>Kullanıcı hesabının doğrulanması ve güvenliğinin sağlanması</li>
            <li>Uygulama performansının izlenmesi ve hataların giderilmesi</li>
            <li>Yasal yükümlülüklerin yerine getirilmesi</li>
          </ul>

          <H2>4. Verilerin Saklanması ve Aktarılması</H2>
          <P>
            Verileriniz, Supabase Inc. altyapısı üzerinde (Avrupa Birliği veri merkezleri)
            güvenli biçimde saklanmaktadır. Supabase, GDPR uyumlu bir platformdur.
            Verileriniz, açık rızanız olmadan üçüncü taraflarla pazarlama amacıyla
            paylaşılmaz.
          </P>

          <H2>5. Veri Saklama Süresi</H2>
          <P>
            Hesabınız aktif olduğu sürece verileriniz saklanır. Hesap silindiğinde tüm
            kişisel veriler 30 gün içinde kalıcı olarak silinir. Randevu kayıtları
            yasal zorunluluklar kapsamında en fazla 2 yıl saklanabilir.
          </P>

          <H2>6. KVKK Kapsamındaki Haklarınız</H2>
          <P>6698 sayılı KVKK çerçevesinde aşağıdaki haklara sahipsiniz:</P>
          <ul>
            <li>Kişisel verilerinizin işlenip işlenmediğini öğrenme</li>
            <li>Verilerinize erişim talep etme ve kopyasını alma</li>
            <li>Yanlış veya eksik verilerin düzeltilmesini isteme</li>
            <li>Verilerinizin silinmesini veya imha edilmesini talep etme</li>
            <li>Veri işlemenin kısıtlanmasını isteme</li>
            <li>Veri taşınabilirliği talep etme</li>
          </ul>
          <P>
            Bu haklarınızı kullanmak için{' '}
            <a href={`mailto:${CONTACT_EMAIL}`} style={{ color: 'var(--brand-600)' }}>{CONTACT_EMAIL}</a>{' '}
            adresine başvurabilirsiniz.
          </P>

          <H2>7. Hesap Silme</H2>
          <P>
            Hesabınızı ve tüm verilerinizi silmek için uygulama içinde
            Ayarlar → Hesabımı Sil seçeneğini kullanabilir ya da{' '}
            <a href={`mailto:${CONTACT_EMAIL}`} style={{ color: 'var(--brand-600)' }}>{CONTACT_EMAIL}</a>{' '}
            adresine e-posta gönderebilirsiniz.
          </P>

          <H2>8. Bildirim İzinleri</H2>
          <P>
            Uygulama, randevu hatırlatmaları göndermek için push bildirim izni isteyebilir.
            Bu izni dilediğiniz zaman cihazınızın ayarlarından geri alabilirsiniz.
          </P>

          <H2>9. İletişim</H2>
          <P>
            Bu politikayla ilgili sorularınız için:{' '}
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
