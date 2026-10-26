import type { Config } from "tailwindcss";

const SHADES = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950];
// Hues whose shades are CSS variables (src/styles/hues.css) so they stay readable on light themes
const VAR_HUES = ["red", "rose", "pink", "orange", "amber", "yellow", "green", "emerald", "teal", "sky", "blue", "indigo", "purple"];

/** { 50: "rgb(var(--name-50) / <alpha-value>)", ... } */
const varScale = (name: string) =>
  Object.fromEntries(SHADES.map((s) => [s, `rgb(var(--${name}-${s}) / <alpha-value>)`]));

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Heebo", "system-ui", "sans-serif"],
      },
      colors: {
        // Neutral ramp + accent are computed from the active palette (src/lib/themeVars.ts)
        slate: varScale("slate"),
        accent: varScale("accent"),
        ...Object.fromEntries(VAR_HUES.map((h) => [h, varScale(h)])),
      },
    },
  },
  plugins: [],
} satisfies Config;
