import { create } from "zustand";
import { persist } from "zustand/middleware";

export const DEFAULT_TIMEZONE = "Asia/Jerusalem";

export const TIMEZONE_OPTIONS = [
  { value: "Asia/Jerusalem", label: "ישראל (Asia/Jerusalem)" },
  { value: "UTC", label: "UTC" },
  { value: "Europe/London", label: "לונדון" },
  { value: "Europe/Paris", label: "פריז" },
  { value: "America/New_York", label: "ניו יורק" },
  { value: "America/Los_Angeles", label: "לוס אנג'לס" },
  { value: "Asia/Dubai", label: "דובאי" },
  { value: "Asia/Tokyo", label: "טוקיו" },
] as const;

interface PreferencesState {
  timeZone: string;
  assistantModel: string;
  setTimeZone: (timeZone: string) => void;
  setAssistantModel: (assistantModel: string) => void;
}

export const usePreferencesStore = create<PreferencesState>()(
  persist(
    (set) => ({
      timeZone: DEFAULT_TIMEZONE,
      assistantModel: "",
      setTimeZone: (timeZone) => set({ timeZone: timeZone.trim() || DEFAULT_TIMEZONE }),
      setAssistantModel: (assistantModel) => set({ assistantModel: assistantModel.trim() }),
    }),
    { name: "fami-preferences" }
  )
);

