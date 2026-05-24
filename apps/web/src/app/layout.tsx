import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Keskin Berber — Online Randevu · Sıradaki',
  description: 'Online randevu al — Sıradaki randevu ve ekip yönetim platformu',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="tr">
      <body className="bg-slate-50 font-sans text-ink-900 antialiased">
        {children}
      </body>
    </html>
  );
}
