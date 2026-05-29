'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/browser';
import { slugify, DEFAULT_WORKING_HOURS } from '@berber/shared';

export default function KayitPage() {
  const router = useRouter();

  const [shopName, setShopName] = useState('');
  const [email, setEmail]       = useState('');
  const [pass, setPass]         = useState('');
  const [passConf, setPassConf] = useState('');
  const [error, setError]       = useState<string | null>(null);
  const [loading, setLoading]   = useState(false);

  const slug      = slugify(shopName);
  const passErr   = pass.length > 0 && pass.length < 8 ? 'En az 8 karakter gerekli' : null;
  const confErr   = passConf && pass !== passConf ? 'Şifreler eşleşmiyor' : null;
  const emailErr  = email && !email.includes('@') ? 'Geçerli bir e-posta gir' : null;
  const canSubmit = shopName.trim().length >= 2 && email.includes('@') && pass.length >= 8 && pass === passConf;

  const passScore  = pass.length >= 12 ? 3 : pass.length >= 8 ? 2 : pass.length > 0 ? 1 : 0;
  const scoreLabel = ['', 'Zayıf', 'Orta', 'Güçlü'][passScore];
  const scoreColor = ['', 'text-red-500', 'text-yellow-600', 'text-green-600'][passScore];
  const barColor   = ['', 'bg-red-400', 'bg-yellow-400', 'bg-green-500'][passScore];

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setError(null);
    setLoading(true);
    try {
      const supabase = createClient();
      const trimmed  = shopName.trim();

      const { data: authData, error: signUpErr } = await supabase.auth.signUp({
        email: email.trim(),
        password: pass,
        options: { data: { shop_name: trimmed } },
      });
      if (signUpErr || !authData.user) {
        setError(signUpErr?.message ?? 'Kayıt başarısız.');
        return;
      }

      const { error: shopErr } = await supabase.from('shops').insert({
        owner_user_id: authData.user.id,
        name:          trimmed,
        display_name:  trimmed,
        slug,
        working_hours: DEFAULT_WORKING_HOURS as unknown as import('@berber/db').Json,
      });
      if (shopErr) {
        if (shopErr.code === '23505') {
          setError('Bu dükkan adı zaten alınmış. Farklı bir isim dene.');
        } else {
          setError('Dükkan oluşturulamadı: ' + shopErr.message);
        }
        return;
      }

      router.replace('/dashboard');
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-white flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="mb-8">
          <Link href="/" className="text-sm font-bold text-gray-900 tracking-tight">Sıradaki</Link>
          <p className="mt-6 text-xs font-semibold uppercase tracking-widest text-gray-400">Dükkan Paneli</p>
          <h1 className="mt-2 text-2xl font-bold text-gray-900 tracking-tight">Hesap Oluştur</h1>
          <p className="mt-1 text-sm text-gray-500">Dükkanını Sıradaki&apos;ye ekle, randevularını online al.</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-gray-400 mb-1.5">
              Dükkan Adı
            </label>
            <input
              type="text"
              value={shopName}
              onChange={e => setShopName(e.target.value)}
              placeholder="örn. Keskin Berber"
              className="w-full px-3 py-2.5 border rounded-lg text-sm bg-gray-50 focus:bg-white outline-none transition border-gray-200 focus:border-blue-900 focus:ring-2 focus:ring-blue-100"
            />
            <p className="mt-1 text-xs text-gray-400">Müşteriler bu ismi görecek</p>
            {slug && (
              <div className="mt-2 px-3 py-2 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-xs text-gray-500">Randevu linkin:</p>
                <p className="text-xs font-semibold text-blue-900 mt-0.5">
                  siradaki.app/<span className="text-blue-700">{slug}</span>
                </p>
              </div>
            )}
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-gray-400 mb-1.5">
              E-posta
            </label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="berber@dukkan.com"
              className={`w-full px-3 py-2.5 border rounded-lg text-sm bg-gray-50 focus:bg-white outline-none transition ${emailErr ? 'border-red-400' : 'border-gray-200 focus:border-blue-900 focus:ring-2 focus:ring-blue-100'}`}
            />
            {emailErr && <p className="mt-1 text-xs text-red-500">{emailErr}</p>}
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-gray-400 mb-1.5">
              Şifre
            </label>
            <input
              type="password"
              value={pass}
              onChange={e => setPass(e.target.value)}
              placeholder="En az 8 karakter"
              className={`w-full px-3 py-2.5 border rounded-lg text-sm bg-gray-50 focus:bg-white outline-none transition ${passErr ? 'border-red-400' : 'border-gray-200 focus:border-blue-900 focus:ring-2 focus:ring-blue-100'}`}
            />
            {pass && (
              <div className="mt-2 flex items-center gap-2">
                <div className="flex gap-1 flex-1">
                  {[1,2,3].map(i => (
                    <div key={i} className={`flex-1 h-1 rounded-full ${i <= passScore ? barColor : 'bg-gray-200'}`} />
                  ))}
                </div>
                <span className={`text-xs font-semibold ${scoreColor}`}>{scoreLabel}</span>
              </div>
            )}
            {passErr && <p className="mt-1 text-xs text-red-500">{passErr}</p>}
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-gray-400 mb-1.5">
              Şifre Tekrar
            </label>
            <input
              type="password"
              value={passConf}
              onChange={e => setPassConf(e.target.value)}
              placeholder="Şifreni tekrar gir"
              className={`w-full px-3 py-2.5 border rounded-lg text-sm bg-gray-50 focus:bg-white outline-none transition ${confErr ? 'border-red-400' : 'border-gray-200 focus:border-blue-900 focus:ring-2 focus:ring-blue-100'}`}
            />
            {confErr && <p className="mt-1 text-xs text-red-500">{confErr}</p>}
          </div>

          <p className="text-xs text-gray-400 leading-relaxed">
            Kayıt olarak{' '}
            <Link href="/kullanim-kosullari" className="text-blue-900 font-semibold">Kullanım Koşulları</Link>
            &apos;nı ve{' '}
            <Link href="/gizlilik-politikasi" className="text-blue-900 font-semibold">Gizlilik Politikası</Link>
            &apos;nı kabul etmiş olursun.
          </p>

          {error && <p className="text-xs text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}

          <button
            type="submit"
            disabled={!canSubmit || loading}
            className="w-full bg-blue-900 hover:bg-blue-950 disabled:opacity-50 text-white font-semibold text-sm py-2.5 rounded-lg transition-colors"
          >
            {loading ? 'Hesap oluşturuluyor…' : 'Hesap Oluştur'}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-gray-500">
          Hesabın var mı?{' '}
          <Link href="/giris" className="text-blue-900 font-semibold hover:underline">
            Giriş yap
          </Link>
        </p>
      </div>
    </div>
  );
}
