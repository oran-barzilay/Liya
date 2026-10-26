import { useMemo } from "react";
import twColors from "tailwindcss/colors";
import { contrastRatio, useThemeStore, type AccentColor } from "../state/stores/themeStore";

/**
 * Turns the user's palette (app bg, menu bg, text colors, accent) into the full
 * set of CSS variables the UI reads. Every text-ish color is checked against the
 * surfaces it sits on and nudged until it is readable, so no palette — preset,
 * saved or hand-picked — can make text disappear.
 */

type Shade = 50 | 100 | 200 | 300 | 400 | 500 | 600 | 700 | 800 | 900 | 950;
type Scale = Record<Shade, string>;

const SHADES: Shade[] = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950];
const DARK_INK = "#0f172a";
const LIGHT_INK = "#f8fafc";

// Tuned Tailwind scales for the named accents (300–950); lighter shades are derived.
const NAMED_ACCENTS: Record<Exclude<AccentColor, "custom">, Partial<Scale>> = {
  indigo:  { 300: "#a5b4fc", 400: "#818cf8", 500: "#6366f1", 600: "#4f46e5", 700: "#4338ca", 800: "#3730a3", 900: "#312e81", 950: "#1e1b4b" },
  purple:  { 300: "#d8b4fe", 400: "#c084fc", 500: "#a855f7", 600: "#9333ea", 700: "#7e22ce", 800: "#6b21a8", 900: "#581c87", 950: "#3b0764" },
  blue:    { 300: "#93c5fd", 400: "#60a5fa", 500: "#3b82f6", 600: "#2563eb", 700: "#1d4ed8", 800: "#1e40af", 900: "#1e3a8a", 950: "#172554" },
  emerald: { 300: "#6ee7b7", 400: "#34d399", 500: "#10b981", 600: "#059669", 700: "#047857", 800: "#065f46", 900: "#064e3b", 950: "#022c22" },
  rose:    { 300: "#fda4af", 400: "#fb7185", 500: "#f43f5e", 600: "#e11d48", 700: "#be123c", 800: "#9f1239", 900: "#881337", 950: "#4c0519" },
  amber:   { 300: "#fcd34d", 400: "#fbbf24", 500: "#f59e0b", 600: "#d97706", 700: "#b45309", 800: "#92400e", 900: "#78350f", 950: "#451a03" },
};

// Neutral ramp: fraction of the way from the app background (950) toward the ink (50)
const RAMP: Record<Shade, number> = {
  950: 0, 900: 0.06, 800: 0.12, 700: 0.2, 600: 0.45, 500: 0.58, 400: 0.7, 300: 0.82, 200: 0.9, 100: 0.95, 50: 0.98,
};

// Status/category hues used directly in the UI (must match tailwind.config.ts VAR_HUES)
const HUES = ["red", "rose", "pink", "orange", "amber", "yellow", "green", "emerald", "teal", "sky", "blue", "indigo", "purple"] as const;

// On light backgrounds: pale shades become deep (text), deep shades become pale (tints/borders);
// the solid button shades (500–700) stay put.
const LIGHT_MAP: Record<Shade, Shade> = {
  50: 50, 100: 100, 200: 800, 300: 800, 400: 700, 500: 600, 600: 600, 700: 700, 800: 200, 900: 100, 950: 50,
};

function toRgb(hex: string): [number, number, number] {
  const h = /^#[0-9a-fA-F]{6}$/.test(hex) ? hex.slice(1) : "000000";
  return [0, 2, 4].map((i) => Number.parseInt(h.slice(i, i + 2), 16)) as [number, number, number];
}

function toHex([r, g, b]: number[]): string {
  return "#" + [r, g, b].map((v) => Math.round(Math.min(255, Math.max(0, v))).toString(16).padStart(2, "0")).join("");
}

/** Mix `a` toward `b` by fraction `t` (0 = a, 1 = b). */
export function mix(a: string, b: string, t: number): string {
  const ca = toRgb(a);
  const cb = toRgb(b);
  return toHex(ca.map((v, i) => v + (cb[i] - v) * t));
}

const triplet = (hex: string) => toRgb(hex).join(" ");

/** True when dark text reads better than light text on this background. */
export function isLightBackground(bg: string): boolean {
  return contrastRatio(DARK_INK, bg) >= contrastRatio(LIGHT_INK, bg);
}

/** Push `fg` toward black/white until it reaches `min` contrast against every background. */
export function ensureContrast(fg: string, bgs: string[], min: number): string {
  const worst = (c: string) => Math.min(...bgs.map((b) => contrastRatio(c, b)));
  if (worst(fg) >= min) return fg;
  const target = isLightBackground(bgs[0]) ? "#000000" : "#ffffff";
  for (let t = 0.1; t < 1; t += 0.1) {
    const c = mix(fg, target, t);
    if (worst(c) >= min) return c;
  }
  return target;
}

function accentScale(accentColor: AccentColor, accentCustom: string): Scale {
  const named = accentColor === "custom" ? null : NAMED_ACCENTS[accentColor];
  const base = named?.[600] ?? accentCustom;
  const derived: Scale = {
    50: mix(base, "#ffffff", 0.93), 100: mix(base, "#ffffff", 0.85), 200: mix(base, "#ffffff", 0.72),
    300: mix(base, "#ffffff", 0.55), 400: mix(base, "#ffffff", 0.35), 500: mix(base, "#ffffff", 0.15),
    600: base,
    700: mix(base, "#000000", 0.15), 800: mix(base, "#000000", 0.3), 900: mix(base, "#000000", 0.45),
    950: mix(base, "#000000", 0.62),
  };
  return { ...derived, ...named };
}

export interface ThemeInput {
  accentColor: AccentColor;
  accentCustom: string;
  appBg: string;
  menuBg: string;
  textPrimary: string;
  textMuted: string;
}

export interface ResolvedTheme {
  surface: "light" | "dark";
  vars: Record<string, string>;
  textPrimary: string;
  textMuted: string;
  surface800: string;
  border: string;
}

export function buildThemeVars(t: ThemeInput): ResolvedTheme {
  const appBg = /^#[0-9a-fA-F]{6}$/.test(t.appBg) ? t.appBg : "#020617";
  const menuBg = /^#[0-9a-fA-F]{6}$/.test(t.menuBg) ? t.menuBg : "#0f172a";
  const light = isLightBackground(appBg);
  const ink = light ? DARK_INK : LIGHT_INK;

  // Neutral (slate) ramp derived from the app background, so cards, inputs,
  // borders and muted icons always sit on the same side as the background.
  const slate = Object.fromEntries(SHADES.map((s) => [s, mix(appBg, ink, RAMP[s])])) as Scale;
  const surfaces = [appBg, slate[900], slate[800]];

  // Muted icons / placeholders need 3:1, lighter neutrals used as text need 4.5:1
  slate[600] = ensureContrast(slate[600], surfaces, 3);
  slate[500] = ensureContrast(slate[500], surfaces, 3);
  for (const s of [400, 300, 200] as Shade[]) slate[s] = ensureContrast(slate[s], surfaces, 4.5);

  const textPrimary = ensureContrast(t.textPrimary, surfaces, 4.5);
  const textMuted = ensureContrast(t.textMuted, surfaces, 4.5);

  // Accent: on light backgrounds flip the scale (pale tints become backgrounds,
  // deep shades become text), then guarantee the text shades are readable.
  const dark = accentScale(t.accentColor, t.accentCustom);
  const accent: Scale = light
    ? { 50: dark[50], 100: dark[100], 200: dark[800], 300: dark[800], 400: dark[700], 500: dark[600],
        600: dark[600], 700: dark[700], 800: dark[200], 900: dark[100], 950: dark[50] }
    : { ...dark };
  accent[400] = ensureContrast(accent[400], surfaces, 4.5);
  accent[300] = ensureContrast(accent[300], [...surfaces, accent[900]], 4.5);
  accent[200] = ensureContrast(accent[200], surfaces, 4.5);
  // Text on accent fills (buttons 600, hover 500, selected tabs 700): whichever ink reads best on all of them
  const fills = [accent[500], accent[600], accent[700]];
  const minOn = (ink: string) => Math.min(...fills.map((f) => contrastRatio(ink, f)));
  const onAccent = minOn("#ffffff") >= minOn(DARK_INK) ? "#ffffff" : DARK_INK;

  // Menu chrome is computed from its own background (it may differ from the app's).
  const menuLight = isLightBackground(menuBg);
  const menuText = ensureContrast(menuLight ? "#334155" : "#cbd5e1", [menuBg], 4.5);
  const menuMuted = ensureContrast(menuLight ? "#64748b" : "#94a3b8", [menuBg], 4.5);
  const menuAccent = ensureContrast(menuLight ? dark[700] : dark[400], [menuBg, mix(menuBg, dark[500], 0.15)], 4.5);

  const vars: Record<string, string> = {
    "--app-bg": appBg,
    "--menu-bg": menuBg,
    "--text-primary": textPrimary,
    "--text-muted": textMuted,
    "--surface-950": slate[950],
    "--surface-900": slate[900],
    "--surface-800": slate[800],
    "--surface-700": slate[700],
    "--surface-border": mix(appBg, ink, 0.1),
    "--on-accent": onAccent,
    "--menu-text": menuText,
    "--menu-muted": menuMuted,
    "--menu-strong": menuLight ? DARK_INK : LIGHT_INK,
    "--menu-border": mix(menuBg, menuText, 0.14),
    "--menu-hover": mix(menuBg, menuText, 0.1),
    "--menu-accent": menuAccent,
  };
  for (const s of SHADES) {
    vars[`--slate-${s}`] = triplet(slate[s]);
    vars[`--accent-${s}`] = triplet(accent[s]);
  }

  // Hues: map per mode, then make the shades used as text readable on the
  // surfaces and on their own tinted panels (e.g. text-red-300 on bg-red-950/30).
  for (const h of HUES) {
    const src = twColors[h] as Record<Shade, string>;
    const scale = Object.fromEntries(SHADES.map((s) => [s, src[light ? LIGHT_MAP[s] : s]])) as Scale;
    const tint = mix(appBg, scale[950], 0.4);
    for (const s of [200, 300, 400] as Shade[]) scale[s] = ensureContrast(scale[s], [...surfaces, tint], 4.5);
    for (const s of SHADES) vars[`--${h}-${s}`] = triplet(scale[s]);
  }

  return { surface: light ? "light" : "dark", vars, textPrimary, textMuted, surface800: slate[800], border: vars["--surface-border"] };
}

/** The resolved (contrast-safe) theme for the current store palette. */
export function useResolvedTheme(): ResolvedTheme {
  const { accentColor, accentCustom, appBg, menuBg, textPrimary, textMuted } = useThemeStore();
  return useMemo(
    () => buildThemeVars({ accentColor, accentCustom, appBg, menuBg, textPrimary, textMuted }),
    [accentColor, accentCustom, appBg, menuBg, textPrimary, textMuted]
  );
}
