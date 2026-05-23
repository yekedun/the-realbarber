/**
 * Sıradaki — Design Tokens
 * Single source of truth for all color, spacing, radius, shadow and typography values.
 * Import this file everywhere — never use raw hex/number values in components.
 *
 * Usage (React Native):
 *   import { colors, spacing, radius, typography } from '@siradaki/shared/theme';
 *   const styles = StyleSheet.create({ container: { backgroundColor: colors.brand[600] } });
 *
 * Usage (Web / Tailwind):
 *   See tailwind.config extension in docs/handoff/tailwind-extension.ts
 */

/* ── Core color scales ──────────────────────────────────────── */

export const colors = {
  /** Ink — formal navy-black. Page text. */
  ink: {
    900: '#0B1220',
    800: '#15192A',
    700: '#1F2438',
    500: '#3B4256',
  },

  /** Slate — cool neutral ramp. */
  slate: {
    700: '#2F3649',
    500: '#5B6477',   // secondary text
    400: '#8590A4',   // tertiary, disabled
    300: '#B4BBC8',   // placeholder
    200: '#D6DBE5',   // hairline border
    100: '#EEF1F5',   // divider, sunken surface
    50:  '#F7F8FA',   // page canvas
    0:   '#FFFFFF',   // card surface
  },

  /** Brand — navy blue, primary accent. */
  brand: {
    700: '#15296B',
    600: '#1E3A8A',   // PRIMARY
    500: '#3B5BB8',
    100: '#DDE3F2',
  },

  /** Mint — positive / completed / active. */
  mint: {
    700: '#008264',
    600: '#00B894',
    100: '#C6F3E5',
  },

  /** Umber — earnings / warning / commission. */
  umber: {
    700: '#503410',
    600: '#6F4A14',
    100: '#ECE6DC',
  },

  /** Coral — danger / cancel / conflict. */
  coral: {
    700: '#7A1F2E',
    600: '#A0303F',
    100: '#EFD3D8',
  },
} as const;

/* ── Semantic aliases ───────────────────────────────────────── */

export const semantic = {
  bg:          colors.slate[50],
  bgElevated:  colors.slate[0],
  bgSunken:    colors.slate[100],

  fg1: colors.ink[900],     // primary text
  fg2: colors.slate[700],   // secondary heading
  fg3: colors.slate[500],   // meta, captions
  fg4: colors.slate[400],   // tertiary, disabled

  border:       colors.slate[200],
  borderStrong: colors.ink[900],
  divider:      colors.slate[100],

  accent:      colors.brand[600],
  accentHover: colors.brand[700],
  accentTint:  colors.brand[100],

  positive: colors.mint[600],
  warning:  colors.umber[600],
  danger:   colors.coral[600],
} as const;

/* ── Spacing (4pt base) ─────────────────────────────────────── */

export const spacing = {
  0:  0,
  1:  4,
  2:  8,
  3:  12,
  4:  16,
  5:  20,
  6:  24,
  7:  32,
  8:  40,
  9:  56,
  10: 72,
} as const;

/** Short alias — S.4 === spacing[4] === 16 */
export const S = spacing;

/* ── Border radius ──────────────────────────────────────────── */

export const radius = {
  xs:   4,
  sm:   8,
  md:   12,
  lg:   18,
  xl:   24,
  pill: 9999,
} as const;

/* ── Typography ─────────────────────────────────────────────── */

export const typography = {
  /**
   * Font family names — must match the names registered in useFonts().
   * See docs/handoff/IMPLEMENTATION.md §1 for font loading setup.
   */
  fontFamily: {
    sans:  'Montserrat',
    mono:  'SpaceMono',      // change to your mono font if different
  },

  fontWeight: {
    regular:  '400' as const,
    medium:   '500' as const,
    semiBold: '600' as const,
    bold:     '700' as const,
  },

  fontSize: {
    overline:   11,
    caption:    12,
    meta:       13,
    body:       15,
    bodyLg:     16,
    lead:       17,
    h4:         18,
    h3:         22,
    h2:         28,
    h1:         34,
    display:    44,
    displayXl:  64,
  },

  lineHeight: {
    tight:  1.08,
    snug:   1.22,
    base:   1.45,
    loose:  1.6,
  },

  letterSpacing: {
    overline: 2.5,   // ~0.16em at 15px
    tight:    -0.3,
    display:  -0.5,
  },
} as const;

/* ── Shadows (React Native) ─────────────────────────────────── */

export const shadows = {
  xs: {
    shadowColor: colors.ink[900],
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 0,
    elevation: 1,
  },
  sm: {
    shadowColor: colors.ink[900],
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  md: {
    shadowColor: colors.ink[900],
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 4,
  },
  lg: {
    shadowColor: colors.ink[900],
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.18,
    shadowRadius: 24,
    elevation: 8,
  },
} as const;

/* ── Motion ─────────────────────────────────────────────────── */

export const motion = {
  /** ms durations */
  durFast:  120,
  durBase:  200,
  durSlow:  360,
} as const;
