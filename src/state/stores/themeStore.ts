import { create } from "zustand";
import { persist } from "zustand/middleware";

export type AccentColor = "indigo" | "purple" | "blue" | "emerald" | "rose" | "amber";

export const ACCENT_OPTIONS: { id: AccentColor; label: string; swatch: string }[] = [
  { id: "indigo",  label: "כחול-סגול", swatch: "#4f46e5" },
  { id: "purple",  label: "סגול",      swatch: "#9333ea" },
  { id: "blue",    label: "כחול",      swatch: "#2563eb" },
  { id: "emerald", label: "ירוק",      swatch: "#059669" },
  { id: "rose",    label: "ורוד",      swatch: "#e11d48" },
  { id: "amber",   label: "כתום",      swatch: "#d97706" },
];

interface ThemeState {
  accentColor: AccentColor;
  setAccentColor: (color: AccentColor) => void;
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set) => ({
      accentColor: "indigo",
      setAccentColor: (accentColor) => set({ accentColor }),
    }),
    { name: "fami-theme" }
  )
);

