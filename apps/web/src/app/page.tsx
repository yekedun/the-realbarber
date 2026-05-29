import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Sıradaki — Berber Randevu Sistemi',
  description: "Instagram'a linkini at. Müşterilerin 7/24 randevusunu kendisi alsın.",
};

const CSS = `
  :root { color-scheme: light only; }
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  .lp {
    font-family: var(--font-sans, -apple-system, 'Helvetica Neue', sans-serif);
    color: #111;
    background: #fff;
    min-height: 100vh;
    -webkit-font-smoothing: antialiased;
  }
  .wrap { max-width: 1100px; margin: 0 auto; padding: 0 24px; }

  /* ── Nav ──────────────────────────── */
  .lp-nav {
    border-bottom: 1px solid #e5e5e5;
    height: 56px;
    position: sticky;
    top: 0;
    z-index: 50;
    background: rgba(255,255,255,0.92);
    backdrop-filter: blur(12px);
  }
  .lp-nav .wrap { height: 100%; display: flex; align-items: center; justify-content: space-between; }
  .lp-logo { font-size: 15px; font-weight: 700; letter-spacing: -0.02em; color: #111; text-decoration: none; }
  .nav-actions { display: flex; gap: 10px; align-items: center; }
  .nav-link { font-size: 13px; font-weight: 500; color: #888; text-decoration: none; transition: color 0.15s; }
  .nav-link:hover { color: #111; }
  .nav-cta {
    font-size: 13px; font-weight: 600; color: #fff; text-decoration: none;
    background: #1E3A8A; padding: 7px 16px; border-radius: 7px;
    transition: background 0.15s;
  }
  .nav-cta:hover { background: #15296B; }

  /* ── Hero ─────────────────────────── */
  .hero {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 60px;
    align-items: center;
    padding: 80px 0 88px;
    border-bottom: 1px solid #e5e5e5;
  }
  .hero-eyebrow {
    font-size: 11px; font-weight: 600; letter-spacing: 0.1em;
    text-transform: uppercase; color: #888; margin-bottom: 20px;
    display: flex; align-items: center; gap: 10px;
  }
  .hero-eyebrow::before {
    content: ''; display: block; width: 20px; height: 1px; background: #bbb;
  }
  .hero-h1 {
    font-size: clamp(38px, 5.5vw, 58px); font-weight: 700;
    letter-spacing: -0.03em; line-height: 1.06; color: #111; margin-bottom: 20px;
  }
  .hero-h1 span { color: #1E3A8A; }
  .hero-sub {
    font-size: clamp(14px, 1.8vw, 16px); line-height: 1.75; color: #666;
    margin-bottom: 36px; max-width: 400px;
  }
  .hero-btns { display: flex; gap: 10px; flex-wrap: wrap; }

  .btn-p {
    font-size: 14px; font-weight: 700; color: #fff; text-decoration: none;
    background: #1E3A8A; padding: 12px 28px; border-radius: 8px;
    display: inline-block; transition: background 0.15s, transform 0.12s;
  }
  .btn-p:hover { background: #15296B; transform: translateY(-1px); }
  .btn-g {
    font-size: 14px; font-weight: 500; color: #666; text-decoration: none;
    padding: 12px 20px; border-radius: 8px; border: 1px solid #e0e0e0;
    display: inline-block; transition: border-color 0.15s, color 0.15s;
  }
  .btn-g:hover { border-color: #1E3A8A; color: #1E3A8A; }

  /* ── Booking mock ─────────────────── */
  .mock {
    border: 1.5px solid #e0e0e0; border-radius: 14px;
    overflow: hidden; box-shadow: 0 12px 48px rgba(0,0,0,0.09);
    background: #fff;
  }
  .mock-bar {
    background: #f5f5f5; border-bottom: 1px solid #e5e5e5;
    padding: 10px 14px; display: flex; align-items: center; gap: 10px;
  }
  .mock-dots { display: flex; gap: 5px; }
  .mock-dots span { width: 10px; height: 10px; border-radius: 50%; display: block; }
  .mock-dots span:nth-child(1) { background: #ff5f57; }
  .mock-dots span:nth-child(2) { background: #febc2e; }
  .mock-dots span:nth-child(3) { background: #28c840; }
  .mock-url {
    font-family: ui-monospace, 'Cascadia Code', monospace;
    font-size: 11px; color: #888; background: #ebebeb;
    padding: 3px 10px; border-radius: 4px; flex: 1;
  }
  .mock-url b { color: #111; font-weight: 600; }

  .mock-body { padding: 20px; }
  .mock-berber-row {
    display: flex; align-items: center; gap: 12px;
    margin-bottom: 18px; padding-bottom: 16px; border-bottom: 1px solid #f0f0f0;
  }
  .mock-ava {
    width: 44px; height: 44px; border-radius: 10px;
    background: #1E3A8A; color: #fff;
    font-size: 18px; font-weight: 700;
    display: flex; align-items: center; justify-content: center; flex-shrink: 0;
  }
  .mock-name { font-size: 13px; font-weight: 700; color: #111; margin-bottom: 3px; }
  .mock-meta { font-size: 11px; color: #888; }

  .mock-services { display: flex; flex-direction: column; gap: 6px; margin-bottom: 16px; }
  .mock-svc {
    display: flex; justify-content: space-between; align-items: center;
    padding: 9px 12px; border: 1.5px solid #e5e5e5; border-radius: 8px; font-size: 13px;
  }
  .mock-svc.sel { border-color: #1E3A8A; background: #EFF3FB; }
  .mock-svc-n { font-weight: 500; color: #111; }
  .mock-svc-p { color: #888; font-weight: 500; font-size: 12px; }
  .mock-svc.sel .mock-svc-p { color: #1E3A8A; }

  .mock-lbl {
    font-size: 10px; font-weight: 700; letter-spacing: 0.08em;
    text-transform: uppercase; color: #aaa; margin-bottom: 8px;
  }
  .mock-slots {
    display: grid; grid-template-columns: repeat(4, 1fr);
    gap: 5px; margin-bottom: 16px;
  }
  .mock-slot {
    font-size: 11px; font-weight: 600; text-align: center;
    padding: 7px 4px; border-radius: 7px; border: 1.5px solid transparent;
  }
  .mock-slot.off  { background: #f5f5f5; color: #ccc; }
  .mock-slot.on   { background: #fff; color: #111; border-color: #e0e0e0; }
  .mock-slot.pick { background: #1E3A8A; color: #fff; }

  .mock-cta-btn {
    width: 100%; background: #1E3A8A; color: #fff; font-size: 13px;
    font-weight: 700; padding: 11px; border: none; border-radius: 9px;
    cursor: default; letter-spacing: -0.01em;
  }

  /* ── Stats ────────────────────────── */
  .stats-strip { border-bottom: 1px solid #e5e5e5; }
  .stats-grid {
    display: grid; grid-template-columns: repeat(3, 1fr); text-align: center;
  }
  .stat { padding: 28px 16px; border-right: 1px solid #e5e5e5; }
  .stat:last-child { border-right: none; }
  .stat-n {
    display: block; font-size: clamp(28px, 5vw, 40px); font-weight: 700;
    letter-spacing: -0.03em; line-height: 1; margin-bottom: 6px; color: #111;
  }
  .stat-l { font-size: 12px; color: #888; font-weight: 500; }

  /* ── Sections ─────────────────────── */
  .sec { padding: 72px 0; border-bottom: 1px solid #e5e5e5; }
  .sec-hdr { display: flex; align-items: center; gap: 12px; margin-bottom: 32px; }
  .sec-num {
    font-family: ui-monospace, 'Cascadia Code', monospace;
    font-size: 11px; color: #bbb; letter-spacing: 0.08em; flex-shrink: 0;
  }
  .sec-rule { flex: 1; height: 1px; background: #e5e5e5; }
  .sec-title { font-size: clamp(22px, 3.5vw, 30px); font-weight: 700; letter-spacing: -0.025em; color: #111; margin-bottom: 10px; }
  .sec-lead { font-size: 15px; color: #666; line-height: 1.7; max-width: 480px; }

  /* ── Steps ────────────────────────── */
  .steps { margin-top: 40px; max-width: 560px; }
  .step { display: flex; gap: 20px; padding: 22px 0; border-bottom: 1px solid #f0f0f0; }
  .step:last-child { border-bottom: none; }
  .step-n {
    font-family: ui-monospace, 'Cascadia Code', monospace;
    font-size: 12px; color: #ccc; width: 24px; flex-shrink: 0; padding-top: 1px;
  }
  .step-title { font-size: 15px; font-weight: 700; color: #111; margin-bottom: 4px; }
  .step-desc { font-size: 13px; color: #888; line-height: 1.65; }

  /* ── Features ─────────────────────── */
  .feat-grid {
    margin-top: 40px; display: grid; grid-template-columns: repeat(2, 1fr);
    border: 1px solid #e5e5e5; border-radius: 12px; overflow: hidden;
  }
  .feat-item {
    padding: 24px; border-right: 1px solid #e5e5e5;
    border-bottom: 1px solid #e5e5e5; transition: background 0.15s;
  }
  .feat-item:hover { background: #fafafa; }
  .feat-item:nth-child(even) { border-right: none; }
  .feat-item:nth-last-child(-n+2) { border-bottom: none; }
  .feat-icon { font-size: 20px; margin-bottom: 10px; }
  .feat-name { font-size: 14px; font-weight: 700; color: #111; margin-bottom: 6px; }
  .feat-desc { font-size: 13px; color: #888; line-height: 1.65; }

  /* ── CTA ──────────────────────────── */
  .cta-sec { padding: 88px 0; }
  .cta-box {
    border: 1.5px solid #e5e5e5; border-radius: 16px;
    padding: 56px 40px; text-align: center;
    max-width: 600px; margin: 0 auto;
  }
  .cta-title { font-size: clamp(22px, 4vw, 34px); font-weight: 700; letter-spacing: -0.025em; color: #111; margin-bottom: 12px; }
  .cta-sub { font-size: 15px; color: #888; line-height: 1.7; margin-bottom: 28px; }
  .cta-badges { display: flex; align-items: center; justify-content: center; gap: 10px; margin-top: 20px; flex-wrap: wrap; }
  .cta-badge { font-size: 12px; color: #bbb; }
  .cta-sep { width: 3px; height: 3px; border-radius: 50%; background: #ddd; display: inline-block; }

  /* ── Footer ───────────────────────── */
  .lp-foot {
    border-top: 1px solid #e5e5e5;
    padding: 32px 0;
    display: flex; align-items: center; justify-content: space-between;
    flex-wrap: wrap; gap: 12px;
  }
  .foot-brand { font-size: 14px; font-weight: 700; color: #111; }
  .foot-links { display: flex; gap: 18px; flex-wrap: wrap; }
  .foot-links a { font-size: 13px; color: #888; text-decoration: none; transition: color 0.15s; }
  .foot-links a:hover { color: #111; }
  .foot-copy { font-size: 12px; color: #ccc; width: 100%; }

  /* ── Scroll reveal ────────────────── */
  [data-rv] { opacity: 0; transform: translateY(14px); transition: opacity 0.5s ease, transform 0.5s ease; }
  [data-rv].vis { opacity: 1; transform: none; }
  [data-rv].d1 { transition-delay: 0.08s; }
  [data-rv].d2 { transition-delay: 0.16s; }

  /* ── Hero load anim ───────────────── */
  @keyframes fu { from { opacity:0; transform:translateY(16px); } to { opacity:1; transform:none; } }
  .f0 { animation: fu 0.5s cubic-bezier(0.16,1,0.3,1) both; }
  .f1 { animation: fu 0.5s 0.1s cubic-bezier(0.16,1,0.3,1) both; }
  .f2 { animation: fu 0.5s 0.2s cubic-bezier(0.16,1,0.3,1) both; }
  .f3 { animation: fu 0.5s 0.3s cubic-bezier(0.16,1,0.3,1) both; }

  /* ── Mobile ───────────────────────── */
  @media (max-width: 800px) {
    .hero { grid-template-columns: 1fr; gap: 44px; padding: 56px 0; }
    .hero-sub { max-width: none; }
    .mock-slots { grid-template-columns: repeat(4, 1fr); }
  }
  @media (max-width: 560px) {
    .stats-grid { grid-template-columns: 1fr 1fr; }
    .stats-grid .stat:nth-child(2) { border-right: none; }
    .stats-grid .stat:nth-child(3) { grid-column: 1 / -1; border-top: 1px solid #e5e5e5; border-right: none; }
    .hero-btns { flex-direction: column; }
    .hero-btns a { text-align: center; }
    .feat-grid { grid-template-columns: 1fr; }
    .feat-item:nth-child(even) { border-right: none; }
    .feat-item:nth-last-child(-n+2) { border-bottom: 1px solid #e5e5e5; }
    .feat-item:last-child { border-bottom: none; }
    .cta-box { padding: 40px 20px; }
    .lp-foot { flex-direction: column; align-items: flex-start; }
  }
`;

const FEATURES = [
  { icon: '📅', title: 'Online Randevu',  desc: 'Müşterilerin 7/24 randevu alabilir. Dolu saatler görünmez.' },
  { icon: '👥', title: 'Ekip Yönetimi',   desc: 'Her ustaya ayrı ajanda. Kimin ne zaman boş olduğunu görürsün.' },
  { icon: '💰', title: 'Kazanç Takibi',   desc: 'Aylık ve haftalık raporlar. Komisyon hesaplaması dahil.' },
  { icon: '🔗', title: 'Kişisel Link',    desc: "Her ustanın kendi randevu linki. Instagram'a at, gelsin." },
  { icon: '📱', title: 'Mobil Uygulama',  desc: 'iOS ve Android. Her yerden yönet.' },
  { icon: '🚫', title: 'İzin & Tatil',    desc: 'Tatil günlerini ve öğle aralarını tek tıkla kapat.' },
];

export default function LandingPage() {
  return (
    <>
      <style>{CSS}</style>

      <div className="lp">

        {/* ── Nav ── */}
        <nav className="lp-nav">
          <div className="wrap">
            <Link href="/" className="lp-logo">Sıradaki</Link>
            <div className="nav-actions">
              <Link href="/giris" className="nav-link">Giriş</Link>
              <Link href="/kayit" className="nav-cta">Ücretsiz Dene</Link>
            </div>
          </div>
        </nav>

        {/* ── Hero ── */}
        <div className="wrap">
          <section className="hero">

            {/* Left */}
            <div>
              <p className="hero-eyebrow f0">Berber · Kuaför · Barber</p>
              <h1 className="hero-h1 f1">
                Randevun,<br />
                <span>sana ait.</span>
              </h1>
              <p className="hero-sub f2">
                Instagram&apos;a linkini at. Müşterilerin 7/24 randevusunu kendisi
                alsın. Ekibini yönet, kazancını takip et.
              </p>
              <div className="hero-btns f3">
                <Link href="/kayit" className="btn-p">Ücretsiz Başla</Link>
                <a href="#nasil-calisir" className="btn-g">Nasıl çalışır?</a>
              </div>
            </div>

            {/* Right — booking preview */}
            <div className="f2">
              <div className="mock">
                <div className="mock-bar">
                  <div className="mock-dots">
                    <span /><span /><span />
                  </div>
                  <div className="mock-url">
                    siradaki.app/<b>ahmet</b>
                  </div>
                </div>
                <div className="mock-body">
                  <div className="mock-berber-row">
                    <div className="mock-ava">A</div>
                    <div>
                      <div className="mock-name">Ahmet Koçoğlu</div>
                      <div className="mock-meta">Beşiktaş, İstanbul · ⭐ 4.9</div>
                    </div>
                  </div>
                  <div className="mock-services">
                    <div className="mock-svc">
                      <span className="mock-svc-n">Saç Kesimi</span>
                      <span className="mock-svc-p">120 ₺</span>
                    </div>
                    <div className="mock-svc sel">
                      <span className="mock-svc-n">Sakal Tıraşı</span>
                      <span className="mock-svc-p">60 ₺</span>
                    </div>
                  </div>
                  <p className="mock-lbl">Uygun saatler</p>
                  <div className="mock-slots">
                    {[
                      { t: '10:00', s: 'off' }, { t: '11:00', s: 'on' },
                      { t: '12:30', s: 'off' }, { t: '14:00', s: 'pick' },
                      { t: '15:00', s: 'on' },  { t: '16:30', s: 'on' },
                      { t: '17:00', s: 'on' },  { t: '18:00', s: 'off' },
                    ].map(sl => (
                      <div key={sl.t} className={`mock-slot ${sl.s}`}>{sl.t}</div>
                    ))}
                  </div>
                  <button className="mock-cta-btn">Randevu Al →</button>
                </div>
              </div>
            </div>

          </section>
        </div>

        {/* ── Stats ── */}
        <div className="stats-strip">
          <div className="wrap">
            <div className="stats-grid">
              {[
                { n: '5 dk', l: 'Kurulum süresi' },
                { n: '7/24', l: 'Randevu alınabilir' },
                { n: '0 ₺',  l: 'Başlangıç ücreti' },
              ].map(s => (
                <div key={s.n} className="stat">
                  <span className="stat-n">{s.n}</span>
                  <span className="stat-l">{s.l}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── How it works ── */}
        <div className="wrap">
          <section id="nasil-calisir" className="sec" data-rv>
            <div className="sec-hdr">
              <span className="sec-num">01</span>
              <div className="sec-rule" />
            </div>
            <h2 className="sec-title">5 dakikada dükkanını kur</h2>
            <p className="sec-lead">
              Teknik bilgi gerekmez. Adını ve şehrini gir, hizmetlerini ekle, linki paylaş.
            </p>
            <div className="steps">
              {[
                { n: '01', title: 'Dükkanını tanıt',   desc: 'Adını ve şehrini gir. Randevu linkin hazır.' },
                { n: '02', title: 'Hizmetlerini ekle', desc: 'Saç kesimi, sakal tıraşı... fiyat ve süreyle birlikte.' },
                { n: '03', title: 'Linki paylaş',      desc: "Instagram veya WhatsApp'a at. Randevular akmaya başlar." },
              ].map(s => (
                <div key={s.n} className="step">
                  <span className="step-n">{s.n}</span>
                  <div>
                    <div className="step-title">{s.title}</div>
                    <div className="step-desc">{s.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>

        {/* ── Features ── */}
        <div className="wrap">
          <section className="sec" data-rv>
            <div className="sec-hdr">
              <span className="sec-num">02</span>
              <div className="sec-rule" />
            </div>
            <h2 className="sec-title">İhtiyacın olan her şey</h2>
            <div className="feat-grid">
              {FEATURES.map(f => (
                <div key={f.title} className="feat-item">
                  <div className="feat-icon">{f.icon}</div>
                  <div className="feat-name">{f.title}</div>
                  <div className="feat-desc">{f.desc}</div>
                </div>
              ))}
            </div>
          </section>
        </div>

        {/* ── CTA ── */}
        <div className="wrap">
          <section className="cta-sec" data-rv>
            <div className="cta-box">
              <h2 className="cta-title">Bugün başla, yarın hazırsın.</h2>
              <p className="cta-sub">Kurulum ücreti yok. Kredi kartı gerekmez.</p>
              <Link href="/kayit" className="btn-p" style={{ padding: '14px 44px', fontSize: '15px' }}>
                Ücretsiz Başla →
              </Link>
              <div className="cta-badges">
                <span className="cta-badge">5 dk kurulum</span>
                <span className="cta-sep" />
                <span className="cta-badge">Kredi kartı yok</span>
                <span className="cta-sep" />
                <span className="cta-badge">İstediğin zaman iptal</span>
              </div>
            </div>
          </section>
        </div>

        {/* ── Footer ── */}
        <div className="wrap">
          <footer className="lp-foot">
            <span className="foot-brand">Sıradaki</span>
            <div className="foot-links">
              <Link href="/gizlilik-politikasi">Gizlilik Politikası</Link>
              <Link href="/kullanim-kosullari">Kullanım Koşulları</Link>
              <Link href="/cerez-politikasi">Çerez Politikası</Link>
              <a href="mailto:destek@siradaki.app">İletişim</a>
            </div>
            <p className="foot-copy">© {new Date().getFullYear()} Sıradaki. Tüm hakları saklıdır.</p>
          </footer>
        </div>

      </div>

      {/* Scroll reveal */}
      <script dangerouslySetInnerHTML={{ __html: `
        (function(){
          var o = new IntersectionObserver(function(es){
            es.forEach(function(e){ if(e.isIntersecting){ e.target.classList.add('vis'); o.unobserve(e.target); }});
          }, { threshold: 0.12 });
          document.querySelectorAll('[data-rv]').forEach(function(el){ o.observe(el); });
        })();
      `}} />
    </>
  );
}
