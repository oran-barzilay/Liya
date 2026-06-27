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

export const ACCENT_OPTIONS: { id: Exclude<AccentColor, "custom">; label: string; swatch: string }[] = [
  { id: "indigo", label: "כחול-סגול", swatch: "#4f46e5" },
  { id: "purple", label: "סגול", swatch: "#9333ea" },
  { id: "blue", label: "כחול", swatch: "#2563eb" },
  { id: "emerald", label: "ירוק", swatch: "#059669" },
  { id: "rose", label: "ורוד", swatch: "#e11d48" },
  { id: "amber", label: "כתום", swatch: "#d97706" },
];

/** Pre-built theme presets */
export const THEME_PRESETS: Palette[] = [
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
    accentCustom: "#059669",
    menuBg: "#022c22",
    appBg: "#052e16",
    textPrimary: "#ecfdf5",
    textMuted: "#6ee7b7",
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

/**
 * Compute relative luminance and ensure text/background contrast.
 * Returns the better of the two text colors based on WCAG contrast ratio.
 */
export function getContrastColor(bgHex: string): "light" | "dark" {
  const hex = bgHex.replace("#", "");
  if (hex.length !== 6) return "light";
  const r = parseInt(hex.slice(0, 2), 16) / 255;
  const g = parseInt(hex.slice(2, 4), 16) / 255;
  const b = parseInt(hex.slice(4, 6), 16) / 255;
  const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return luminance > 0.4 ? "dark" : "light";
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
      setAppBg: (appBg) => set({ appBg: normalizeHex(appBg, DEFAULT_APP_BG) }),
      setTextPrimary: (textPrimary) => set({ textPrimary: normalizeHex(textPrimary, DEFAULT_TEXT_PRIMARY) }),
      setTextMuted: (textMuted) => set({ textMuted: normalizeHex(textMuted, DEFAULT_TEXT_MUTED) }),
      saveCurrentPalette: (name) => {
        const state = get();
        const palette: Palette = {
          name: name || `ערכה #${state.favoritePalettes.length + 1}`,
          accentColor: state.accentColor,
          accentCustom: state.accentCustom,
          menuBg: state.menuBg,
          appBg: state.appBg,
          textPrimary: state.textPrimary,
          textMuted: state.textMuted,
        };
        set({ favoritePalettes: [...state.favoritePalettes, palette].slice(-12) });
      },
      applyPalette: (palette) =>
        set({
          accentColor: palette.accentColor,
          accentCustom: normalizeHex(palette.accentCustom, DEFAULT_CUSTOM),
          menuBg: normalizeHex(palette.menuBg, DEFAULT_MENU_BG),
          appBg: normalizeHex(palette.appBg, DEFAULT_APP_BG),
          textPrimary: normalizeHex(palette.textPrimary ?? DEFAULT_TEXT_PRIMARY, DEFAULT_TEXT_PRIMARY),
          textMuted: normalizeHex(palette.textMuted ?? DEFAULT_TEXT_MUTED, DEFAULT_TEXT_MUTED),
        }),
      removePalette: (index) =>
        set((state) => ({
          favoritePalettes: state.favoritePalettes.filter((_, i) => i !== index),
        })),
    }),
    { name: "fami-theme" }
  )
);
