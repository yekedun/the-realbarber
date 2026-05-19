/**
 * Sıradaki Design System — Mobile tokens.
 * Source of truth: design bundle `colors_and_type.css`.
 * Spec: docs/superpowers/specs/2026-05-18-siradaki-design-system-migration-design.md
 *
 * Legacy alias names below the "DEPRECATED SHIM" line resolve to Sıradaki
 * values so screens still render correctly between P0 and P5. They will be
 * removed in P5 after every screen has migrated to native Sıradaki names.
 */

// ===== Sıradaki canonical tokens =====
export const T = {
  // Ink scale (primary text, primary buttons)
  ink900: "#0B1220",
  ink800: "#15192A",
  ink700: "#1F2438",
  ink500: "#3B4256",

  // Slate scale (neutral ramp)
  slate700: "#2F3649",
  slate500: "#5B6477",
  slate400: "#8590A4",
  slate300: "#B4BBC8",
  slate200: "#D6DBE5",
  slate100: "#EEF1F5",
  slate50:  "#F7F8FA",
  slate0:   "#FFFFFF",

  // Brand navy (primary accent)
  brand700: "#15296B",
  brand600: "#1E3A8A",
  brand500: "#3B5BB8",
  brand100: "#DDE3F2",

  // Mint (positive / completed / live)
  mint700: "#008264",
  mint600: "#00B894",
  mint100: "#C6F3E5",

  // Umber (kazanç / komisyon / warning)
  umber700: "#503410",
  umber600: "#6F4A14",
  umber100: "#ECE6DC",

  // Coral (danger / cancel / conflict)
  coral700: "#7A1F2E",
  coral600: "#A0303F",
  coral100: "#EFD3D8",

  // Semantic
  bg:          "#F7F8FA",  // slate50
  bgElevated:  "#FFFFFF",  // slate0
  bgSunken:    "#EEF1F5",  // slate100
  fg1:         "#0B1220",  // ink900 — primary text
  fg2:         "#2F3649",  // slate700 — secondary heading
  fg3:         "#5B6477",  // slate500 — meta, captions
  fg4:         "#8590A4",  // slate400 — tertiary, disabled
  fgOnInk:     "#FFFFFF",
  fgOnAccent:  "#FFFFFF",
  border:        "#D6DBE5", // slate200
  borderStrong:  "#0B1220", // ink900
  divider:       "#EEF1F5", // slate100
  accent:        "#1E3A8A", // brand600
  accentHover:   "#15296B", // brand700
  accentTint:    "#DDE3F2", // brand100
  positive:      "#00B894", // mint600
  warning:       "#6F4A14", // umber600
  danger:        "#A0303F", // coral600
  focusRing:     "rgba(30, 58, 138, 0.42)", // brand600 @ 42%
} as const;

// ===== Radii (Sıradaki: 5 fixed + pill) =====
export const R = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 18,
  xl: 24,
  pill: 9999,
} as const;

// ===== Spacing (4px base) =====
export const S = {
  s0: 0,
  s1: 4,
  s2: 8,
  s3: 12,
  s4: 16,
  s5: 20,
  s6: 24,
  s7: 32,
  s8: 40,
  s9: 56,
  s10: 72,
} as const;

// ===== Typography tokens =====
export const Type = {
  family: "Montserrat",
  weight: { regular: "400", medium: "500", semibold: "600", bold: "700" } as const,
  size: {
    overline:   12,
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
  track: {
    overline: 1.92,   // 0.16em × 12px
    tight:    -0.18,  // -0.012em × 15px
    display:  -0.68,  // -0.02em × 34px
  },
  lineHeight: {
    tight: 1.08,
    snug:  1.22,
    base:  1.45,
    loose: 1.6,
  },
} as const;

// ===== Shadow recipes (cool neutral tint, iOS-shaped) =====
export const Shadow = {
  xs: {
    shadowColor: "#0B1220",
    shadowOpacity: 0.04,
    shadowRadius: 1,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  sm: {
    shadowColor: "#0B1220",
    shadowOpacity: 0.05,
    shadowRadius: 2,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
  },
  md: {
    shadowColor: "#0B1220",
    shadowOpacity: 0.22,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  lg: {
    shadowColor: "#0B1220",
    shadowOpacity: 0.30,
    shadowRadius: 48,
    shadowOffset: { width: 0, height: 24 },
    elevation: 12,
  },
} as const;

// ===== Motion tokens =====
export const Motion = {
  easeOut:  "cubic-bezier(.2,.7,.2,1)",
  easeIn:   "cubic-bezier(.6,.0,.8,.2)",
  easeSoft: "cubic-bezier(.32,.72,.0,1)",
  durFast: 120,
  durBase: 200,
  durSlow: 360,
} as const;
