'use client';

import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/browser';

function GirisForm() {
  const router = useRouter();
  const params = useSearchParams();
  const redirect = params.get('redirect') ?? '/dashboard';

  const [email, setEmail]     = useState('');
  const [pass, setPass]       = useState('');
  const [error, setError]     = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password: pass });
      if (error) { setError(error.message); return; }
      router.push(redirect);
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogle() {
    const supabase = createClient();
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${location.origin}/auth/callback?redirect=${redirect}` },
    });
  }

  return (
    <div className="min-h-screen bg-white flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="mb-8">
          <Link href="/" className="text-sm font-bold text-gray-900 tracking-tight">Sıradaki</Link>
          <p className="mt-6 text-xs font-semibold uppercase tracking-widest text-gray-400">Dükkan Paneli</p>
          <h1 className="mt-2 text-2xl font-bold text-gray-900 tracking-tight">Giriş Yap</h1>
        </div>

        <button
          onClick={handleGoogle}
          className="w-full flex items-center justify-center gap-3 border border-gray-200 rounded-lg py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
          </svg>
          Google ile Giriş Yap
        </button>

        <div className="flex items-center gap-3 my-5">
          <div className="flex-1 h-px bg-gray-100" />
          <span className="text-xs text-gray-400">veya</span>
          <div className="flex-1 h-px bg-gray-100" />
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-gray-400 mb-1.5">
              E-posta
            </label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="berber@dukkan.com"
              required
              className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm bg-gray-50 focus:bg-white focus:border-blue-900 focus:ring-2 focus:ring-blue-100 outline-none transition"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-gray-400 mb-1.5">
              Şifre
            </label>
            <input
              type="password"
              value={pass}
              onChange={e => setPass(e.target.value)}
              placeholder="Şifren"
              required
              className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm bg-gray-50 focus:bg-white focus:border-blue-900 focus:ring-2 focus:ring-blue-100 outline-none transition"
            />
          </div>

          {error && <p className="text-xs text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}

          <button
            type="submit"
            disabled={loading || !email || !pass}
            className="w-full bg-blue-900 hover:bg-blue-950 disabled:opacity-50 text-white font-semibold text-sm py-2.5 rounded-lg transition-colors"
          >
            {loading ? 'Giriş yapılıyor…' : 'Giriş Yap'}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-gray-500">
          Hesabın yok mu?{' '}
          <Link href="/kayit" className="text-blue-900 font-semibold hover:underline">
            Ücretsiz başla
          </Link>
        </p>
      </div>
    </div>
  );
}

export default function GirisPage() {
  return (
    <Suspense>
      <GirisForm />
    </Suspense>
  );
}
