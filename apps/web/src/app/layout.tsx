import type { Metadata } from 'next';
import localFont from 'next/font/local';
import './globals.css';

const montserrat = localFont({
  src: [
    { path: '../fonts/Montserrat-Regular.otf',  weight: '400', style: 'normal' },
    { path: '../fonts/Montserrat-Medium.otf',   weight: '500', style: 'normal' },
    { path: '../fonts/Montserrat-SemiBold.otf', weight: '600', style: 'normal' },
    { path: '../fonts/Montserrat-Bold.otf',     weight: '700', style: 'normal' },
  ],
  variable: '--font-montserrat',
});

export const metadata: Metadata = {
  title: 'Keskin Berber — Online Randevu · Sıradaki',
  description: 'Online randevu al — Sıradaki randevu ve ekip yönetim platformu',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="tr" className={montserrat.variable}>
      <body className="bg-slate-50 font-sans text-ink-900 antialiased">
        {children}
      </body>
    </html>
  );
}
