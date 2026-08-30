import { create } from "zustand";
import { persist } from "zustand/middleware";

export type AccentColor =
  | "indigo"
  | "purple"
  | "blue"
  | "emerald"
  | "rose"
  | "amber"
  | "custom";

export interface Palette {
  name?: string;
  accentColor: AccentColor;
  accentCustom: string;
  menuBg: string;
  appBg: string;
  textPrimary: string;
  textMuted: string;
}

const LIGHT_TEXT = "#f8fafc";
const DARK_TEXT = "#0f172a";
const LIGHT_MUTED = "#94a3b8";
const DARK_MUTED = "#64748b";

export const ACCENT_OPTIONS: { id: Exclude<AccentColor, "custom">; label: string; swatch: string }[] = [
  { id: "indigo", label: "כחול-סגול", swatch: "#4f46e5" },
  { id: "purple", label: "סגול", swatch: "#9333ea" },
  { id: "blue", label: "כחול", swatch: "#2563eb" },
  { id: "emerald", label: "ירוק טבעי", swatch: "#059669" },
  { id: "rose", label: "ורוד", swatch: "#e11d48" },
  { id: "amber", label: "כתום", swatch: "#d97706" },
];

/** Pre-built theme presets */
export const THEME_PRESETS: Palette[] = [
  {
    name: "יום מרווה",
    accentColor: "custom",
    accentCustom: "#3f8f6b",
    menuBg: "#f2f5ec",
    appBg: "#fffdf8",
    textPrimary: "#1f2937",
    textMuted: "#5b6672",
  },
  {
    name: "שמנת ירקרקה",
    accentColor: "custom",
    accentCustom: "#2e8b65",
    menuBg: "#f5f1e5",
    appBg: "#fffef9",
    textPrimary: "#24303a",
    textMuted: "#66727d",
  },
  {
    name: "מנטה בהירה",
    accentColor: "custom",
    accentCustom: "#2c9c77",
    menuBg: "#edf7f0",
    appBg: "#fcfffd",
    textPrimary: "#14212b",
    textMuted: "#5f6e7c",
  },
  {
    name: "לילה כהה",
    accentColor: "indigo",
    accentCustom: "#4f46e5",
    menuBg: "#0f172a",
    appBg: "#020617",
    textPrimary: "#f1f5f9",
    textMuted: "#94a3b8",
  },
  {
    name: "חול חם",
    accentColor: "amber",
    accentCustom: "#d97706",
    menuBg: "#1c1917",
    appBg: "#0c0a09",
    textPrimary: "#fafaf9",
    textMuted: "#a8a29e",
  },
  {
    name: "יער",
    accentColor: "emerald",
    accentCustom: "#0f9f75",
    menuBg: "#022c22",
    appBg: "#05211a",
    textPrimary: "#ecfdf5",
    textMuted: "#9fdcc4",
  },
  {
    name: "שקיעה",
    accentColor: "rose",
    accentCustom: "#e11d48",
    menuBg: "#1a0a10",
    appBg: "#0f0208",
    textPrimary: "#fef2f2",
    textMuted: "#fca5a5",
  },
  {
    name: "אוקיינוס",
    accentColor: "blue",
    accentCustom: "#2563eb",
    menuBg: "#0c1929",
    appBg: "#020c1b",
    textPrimary: "#e2e8f0",
    textMuted: "#7dd3fc",
  },
  {
    name: "בהיר מינימלי",
    accentColor: "indigo",
    accentCustom: "#4f46e5",
    menuBg: "#f8fafc",
    appBg: "#ffffff",
    textPrimary: "#0f172a",
    textMuted: "#64748b",
  },
  {
    name: "סגול עמוק",
    accentColor: "purple",
    accentCustom: "#9333ea",
    menuBg: "#1e1033",
    appBg: "#0f0720",
    textPrimary: "#f5f3ff",
    textMuted: "#c4b5fd",
  },
  {
    name: "גרפיט",
    accentColor: "blue",
    accentCustom: "#3b82f6",
    menuBg: "#1e293b",
    appBg: "#0f172a",
    textPrimary: "#e2e8f0",
    textMuted: "#94a3b8",
  },
];

interface ThemeState {
  appName: string;
  accentColor: AccentColor;
  accentCustom: string;
  menuBg: string;
  appBg: string;
  textPrimary: string;
  textMuted: string;
  favoritePalettes: Palette[];
  setAppName: (name: string) => void;
  setAccentColor: (color: AccentColor) => void;
  setAccentCustom: (hex: string) => void;
  setMenuBg: (hex: string) => void;
  setAppBg: (hex: string) => void;
  setTextPrimary: (hex: string) => void;
  setTextMuted: (hex: string) => void;
  saveCurrentPalette: (name?: string) => void;
  applyPalette: (palette: Palette) => void;
  removePalette: (index: number) => void;
}

const DEFAULT_CUSTOM = "#4f46e5";
const DEFAULT_MENU_BG = "#0f172a";
const DEFAULT_APP_BG = "#020617";
const DEFAULT_TEXT_PRIMARY = "#f1f5f9";
const DEFAULT_TEXT_MUTED = "#94a3b8";

function normalizeHex(value: string, fallback: string) {
  const v = value.trim();
  return /^#[0-9a-fA-F]{6}$/.test(v) ? v : fallback;
}

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const cleaned = hex.replace("#", "");
  if (!/^[0-9a-fA-F]{6}$/.test(cleaned)) return null;
  return {
    r: Number.parseInt(cleaned.slice(0, 2), 16),
    g: Number.parseInt(cleaned.slice(2, 4), 16),
    b: Number.parseInt(cleaned.slice(4, 6), 16),
  };
}

function channelToLinear(value: number): number {
  const c = value / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

function relativeLuminance(hex: string): number {
  const rgb = hexToRgb(hex);
  if (!rgb) return 0;
  const r = channelToLinear(rgb.r);
  const g = channelToLinear(rgb.g);
  const b = channelToLinear(rgb.b);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrastRatio(foregroundHex: string, backgroundHex: string): number {
  const l1 = relativeLuminance(foregroundHex);
  const l2 = relativeLuminance(backgroundHex);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

function bestTextPairForBackground(bgHex: string): { primary: string; muted: string } {
  const darkScore = contrastRatio(DARK_TEXT, bgHex);
  const lightScore = contrastRatio(LIGHT_TEXT, bgHex);
  if (darkScore >= lightScore) {
    return { primary: DARK_TEXT, muted: DARK_MUTED };
  }
  return { primary: LIGHT_TEXT, muted: LIGHT_MUTED };
}

function ensureReadablePalette(palette: Palette): Palette {
  const background = normalizeHex(palette.appBg, DEFAULT_APP_BG);
  const pair = bestTextPairForBackground(background);
  const primary = normalizeHex(palette.textPrimary, pair.primary);
  const muted = normalizeHex(palette.textMuted, pair.muted);
  const fixedPrimary = contrastRatio(primary, background) >= 4.5 ? primary : pair.primary;
  const fixedMuted = contrastRatio(muted, background) >= 3 ? muted : pair.muted;
  return {
    ...palette,
    appBg: background,
    menuBg: normalizeHex(palette.menuBg, DEFAULT_MENU_BG),
    textPrimary: fixedPrimary,
    textMuted: fixedMuted,
  };
}

/**
 * Compute relative luminance and ensure text/background contrast.
 * Returns the better of the two text colors based on WCAG contrast ratio.
 */
export function getContrastColor(bgHex: string): "light" | "dark" {
  return relativeLuminance(bgHex) > 0.4 ? "dark" : "light";
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set, get) => ({
      appName: "Fami",
      accentColor: "indigo",
      accentCustom: DEFAULT_CUSTOM,
      menuBg: DEFAULT_MENU_BG,
      appBg: DEFAULT_APP_BG,
      textPrimary: DEFAULT_TEXT_PRIMARY,
      textMuted: DEFAULT_TEXT_MUTED,
      favoritePalettes: [],
      setAppName: (appName) => set({ appName: appName.trim() || "Fami" }),
      setAccentColor: (accentColor) => set({ accentColor }),
      setAccentCustom: (accentCustom) =>
        set({ accentColor: "custom", accentCustom: normalizeHex(accentCustom, DEFAULT_CUSTOM) }),
      setMenuBg: (menuBg) => set({ menuBg: normalizeHex(menuBg, DEFAULT_MENU_BG) }),
      setAppBg: (appBg) =>
        set((state) => {
          const next = ensureReadablePalette({
            name: state.appName,
            accentColor: state.accentColor,
            accentCustom: state.accentCustom,
            menuBg: state.menuBg,
            appBg,
            textPrimary: state.textPrimary,
            textMuted: state.textMuted,
          });
          return {
            appBg: next.appBg,
            textPrimary: next.textPrimary,
            textMuted: next.textMuted,
          };
        }),
      setTextPrimary: (textPrimary) =>
        set((state) => {
          const normalized = normalizeHex(textPrimary, DEFAULT_TEXT_PRIMARY);
          const safe = contrastRatio(normalized, state.appBg) >= 4.5
            ? normalized
            : bestTextPairForBackground(state.appBg).primary;
          return { textPrimary: safe };
        }),
      setTextMuted: (textMuted) =>
        set((state) => {
          const normalized = normalizeHex(textMuted, DEFAULT_TEXT_MUTED);
          const safe = contrastRatio(normalized, state.appBg) >= 3
            ? normalized
            : bestTextPairForBackground(state.appBg).muted;
          return { textMuted: safe };
        }),
      saveCurrentPalette: (name) => {
        const state = get();
        const palette = ensureReadablePalette({
          name: name || `ערכה #${state.favoritePalettes.length + 1}`,
          accentColor: state.accentColor,
          accentCustom: state.accentCustom,
          menuBg: state.menuBg,
          appBg: state.appBg,
          textPrimary: state.textPrimary,
          textMuted: state.textMuted,
        });
        set({ favoritePalettes: [...state.favoritePalettes, palette].slice(-12) });
      },
      applyPalette: (palette) =>
        set(() => {
          const safe = ensureReadablePalette({
            ...palette,
            accentCustom: normalizeHex(palette.accentCustom, DEFAULT_CUSTOM),
            textPrimary: normalizeHex(palette.textPrimary ?? DEFAULT_TEXT_PRIMARY, DEFAULT_TEXT_PRIMARY),
            textMuted: normalizeHex(palette.textMuted ?? DEFAULT_TEXT_MUTED, DEFAULT_TEXT_MUTED),
            menuBg: normalizeHex(palette.menuBg, DEFAULT_MENU_BG),
            appBg: normalizeHex(palette.appBg, DEFAULT_APP_BG),
          });
          return {
            accentColor: safe.accentColor,
            accentCustom: safe.accentCustom,
            menuBg: safe.menuBg,
            appBg: safe.appBg,
            textPrimary: safe.textPrimary,
            textMuted: safe.textMuted,
          };
        }),
      removePalette: (index) =>
        set((state) => ({
          favoritePalettes: state.favoritePalettes.filter((_, i) => i !== index),
        })),
    }),
    { name: "fami-theme" }
  )
);
