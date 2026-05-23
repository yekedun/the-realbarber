import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        ink:   { 900: '#0B1220', 800: '#15192A', 700: '#1F2438', 500: '#3B4256' },
        slate: { 700: '#2F3649', 500: '#5B6477', 400: '#8590A4', 300: '#B4BBC8', 200: '#D6DBE5', 100: '#EEF1F5', 50: '#F7F8FA', 0: '#FFFFFF' },
        brand: { 700: '#15296B', 600: '#1E3A8A', 500: '#3B5BB8', 100: '#DDE3F2' },
        mint:  { 700: '#008264', 600: '#00B894', 100: '#C6F3E5' },
        umber: { 700: '#503410', 600: '#6F4A14', 100: '#ECE6DC' },
        coral: { 700: '#7A1F2E', 600: '#A0303F', 100: '#EFD3D8' },
      },
      fontFamily: {
        sans: ['var(--font-montserrat)', 'Helvetica Neue', 'Arial', 'sans-serif'],
        mono: ['ui-monospace', 'Cascadia Code', 'Source Code Pro', 'Menlo', 'Consolas', 'monospace'],
      },
      borderRadius: {
        'xs':   '4px',
        'sm':   '8px',
        'md':   '12px',  // rounded-md  = 12px
        'lg':   '18px',  // rounded-lg  = 18px
        'xl':   '24px',
        'pill': '9999px',
      },
      boxShadow: {
        'xs': '0 1px 0 rgba(11,18,32,0.04)',
        'sm': '0 1px 2px rgba(11,18,32,0.05), 0 1px 0 rgba(11,18,32,0.04)',
        'md': '0 6px 18px -10px rgba(11,18,32,0.22), 0 1px 0 rgba(11,18,32,0.04)',
        'lg': '0 24px 48px -22px rgba(11,18,32,0.30), 0 2px 0 rgba(11,18,32,0.05)',
      },
      fontSize: {
        // matches design overlines
        '2xs': ['9px',  { lineHeight: '1' }],
        'xs':  ['11px', { lineHeight: '1.4' }],
      },
      gridTemplateColumns: {
        'sidebar': '360px 1fr',
        'sidebar-w': '380px 1fr',
      },
    },
  },
  plugins: [],
};

export default config;
