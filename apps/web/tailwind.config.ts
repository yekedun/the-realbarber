import type { Config } from "tailwindcss";

/**
 * Sıradaki Design System — Tailwind theme.
 * Source of truth: design bundle `colors_and_type.css`.
 * Spec: docs/superpowers/specs/2026-05-18-siradaki-design-system-migration-design.md
 *
 * Deprecated alias names (red, blue, navy, muted, hair, surface, …) are kept
 * but remapped to Sıradaki hex values. Removed in P5 after every screen has
 * migrated to native Sıradaki names.
 */
const config: Config = {
  content: [
    "./src/app/**/*.{ts,tsx}",
    "./src/components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Sıradaki canonical scales
        ink: {
          900: "#0B1220",
          800: "#15192A",
          700: "#1F2438",
          500: "#3B4256",
          DEFAULT: "#0B1220",
        },
        slate: {
          0:   "#FFFFFF",
          50:  "#F7F8FA",
          100: "#EEF1F5",
          200: "#D6DBE5",
          300: "#B4BBC8",
          400: "#8590A4",
          500: "#5B6477",
          700: "#2F3649",
        },
        brand: {
          100: "#DDE3F2",
          500: "#3B5BB8",
          600: "#1E3A8A",
          700: "#15296B",
          DEFAULT: "#1E3A8A",
        },
        mint: {
          100: "#C6F3E5",
          600: "#00B894",
          700: "#008264",
          DEFAULT: "#00B894",
        },
        umber: {
          100: "#ECE6DC",
          600: "#6F4A14",
          700: "#503410",
          DEFAULT: "#6F4A14",
        },
        coral: {
          100: "#EFD3D8",
          600: "#A0303F",
          700: "#7A1F2E",
          DEFAULT: "#A0303F",
        },
        // Semantic
        bg: "#F7F8FA",
        bgElevated: "#FFFFFF",
        bgSunken: "#EEF1F5",
        border: "#D6DBE5",
        borderStrong: "#0B1220",
        divider: "#EEF1F5",
        positive: "#00B894",
        warning: "#6F4A14",
        danger: "#A0303F",

      },
      borderRadius: {
        xs: "4px",
        sm: "8px",
        md: "12px",
        lg: "18px",
        xl: "24px",
      },
      boxShadow: {
        xs: "0 1px 0 rgba(11,18,32,0.04)",
        sm: "0 1px 2px rgba(11,18,32,0.05), 0 1px 0 rgba(11,18,32,0.04)",
        md: "0 6px 18px -10px rgba(11,18,32,0.22), 0 1px 0 rgba(11,18,32,0.04)",
        lg: "0 24px 48px -22px rgba(11,18,32,0.30), 0 2px 0 rgba(11,18,32,0.05)",
        now:  "0 0 0 1px #1E3A8A, 0 6px 18px -10px rgba(30,58,138,0.45)",
      },
      fontFamily: {
        sans: ['"Montserrat"', "Helvetica Neue", "Arial", "sans-serif"],
        mono: ["ui-monospace", '"SF Mono"', '"JetBrains Mono"', "Menlo", "monospace"],
      },
      fontSize: {
        overline:   ["12px", { lineHeight: "1", letterSpacing: "0.16em" }],
        meta:       ["13px", "1.45"],
        body:       ["15px", "1.45"],
        bodyLg:     ["16px", "1.45"],
        lead:       ["17px", "1.6"],
        h4:         ["18px", "1.22"],
        h3:         ["22px", "1.22"],
        h2:         ["28px", "1.22"],
        h1:         ["34px", "1.08"],
        display:    ["44px", "1.08"],
        displayXl:  ["64px", "1.05"],
      },
      letterSpacing: {
        overline: "0.16em",
        tight:    "-0.012em",
        display:  "-0.02em",
        // Deprecated shim
        eyebrow:      "0.16em",
        eyebrowTight: "0.16em",
        title:        "-0.02em",
      },
      transitionTimingFunction: {
        out:  "cubic-bezier(.2,.7,.2,1)",
        in:   "cubic-bezier(.6,.0,.8,.2)",
        soft: "cubic-bezier(.32,.72,.0,1)",
      },
      transitionDuration: {
        fast: "120ms",
        base: "200ms",
        slow: "360ms",
      },
    },
  },
  plugins: [],
};

export default config;
