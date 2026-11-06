import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../lib/supabase";
import { useProfile } from "./useProfile";

export type SummarySection = "events" | "today" | "overdue" | "shopping" | "tomorrow";
export type WeeklySection = "events" | "tasks" | "overdue" | "shopping";

export interface WhatsappSettings {
  household_id: string;
  enabled: boolean;
  group_id: string | null;
  group_name: string | null;
  daily_enabled: boolean;
  daily_time: string; // "HH:MM:SS"
  time_zone: string;
  sections: Partial<Record<SummarySection, boolean>>;
  greeting: string | null;
  last_daily_sent_on: string | null;
  weekly_enabled: boolean;
  weekly_day: number; // 0 = Sunday … 6 = Saturday
  weekly_time: string;
  weekly_sections: Partial<Record<WeeklySection, boolean>>;
  weekly_greeting: string | null;
  last_weekly_sent_on: string | null;
  assistant_enabled: boolean;
  assistant_trigger: string;
  purchase_detection: boolean;
}

export interface WhatsappMessage {
  id: string;
  text: string;
  weekdays: number[];
  send_time: string;
  enabled: boolean;
  last_sent_on: string | null;
}

export interface WhatsappLogEntry {
  id: string;
  kind: "daily" | "weekly" | "custom" | "reminder" | "manual" | "assistant";
  message: string;
  ok: boolean;
  error: string | null;
  sent_at: string;
}

export const DEFAULT_SETTINGS: Omit<WhatsappSettings, "household_id"> = {
  enabled: true,
  group_id: null,
  group_name: null,
  daily_enabled: true,
  daily_time: "07:30:00",
  time_zone: "Asia/Jerusalem",
  sections: { events: true, today: true, overdue: true, shopping: true, tomorrow: true },
  greeting: null,
  last_daily_sent_on: null,
  weekly_enabled: false,
  weekly_day: 6,
  weekly_time: "20:00:00",
  weekly_sections: { events: true, tasks: true, overdue: true, shopping: true },
  weekly_greeting: null,
  last_weekly_sent_on: null,
  assistant_enabled: true,
  assistant_trigger: "פאמי",
  purchase_detection: true,
};

/** Calls the server endpoint as the signed-in user */
export async function whatsappAction<T = Record<string, unknown>>(action: string, payload: Record<string, unknown> = {}): Promise<T> {
  const { data } = await supabase.auth.getSession();
  const res = await fetch("/api/whatsapp", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${data.session?.access_token ?? ""}` },
    body: JSON.stringify({ action, ...payload }),
  });
  const body = (await res.json().catch(() => ({}))) as T & { ok?: boolean; error?: string };
  if (!res.ok || body.ok === false) throw new Error(body.error || `שגיאה ${res.status}`);
  return body;
}

export function useWhatsapp() {
  const { data: profile } = useProfile();
  const hid = profile?.household_id ?? "";
  const qc = useQueryClient();

  const settings = useQuery<WhatsappSettings>({
    queryKey: ["whatsapp_settings", hid],
    queryFn: async () => {
      const { data, error } = await supabase.from("whatsapp_settings").select("*").eq("household_id", hid).maybeSingle();
      if (error) throw error;
      return {
        ...DEFAULT_SETTINGS, ...(data ?? {}), household_id: hid,
        sections: { ...DEFAULT_SETTINGS.sections, ...(data?.sections ?? {}) },
        weekly_sections: { ...DEFAULT_SETTINGS.weekly_sections, ...(data?.weekly_sections ?? {}) },
      };
    },
    enabled: !!hid,
  });

  const messages = useQuery<WhatsappMessage[]>({
    queryKey: ["whatsapp_messages", hid],
    queryFn: async () => {
      const { data, error } = await supabase.from("whatsapp_messages").select("*").eq("household_id", hid).order("send_time");
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!hid,
  });

  const log = useQuery<WhatsappLogEntry[]>({
    queryKey: ["whatsapp_log", hid],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("whatsapp_log").select("*").eq("household_id", hid).order("sent_at", { ascending: false }).limit(40);
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!hid,
  });

  const saveSettings = useMutation({
    mutationFn: async (patch: Partial<WhatsappSettings>) => {
      const { household_id: _ignored, last_daily_sent_on: _daily, last_weekly_sent_on: _weekly, ...current } = settings.data ?? { ...DEFAULT_SETTINGS, household_id: hid };
      const { error } = await supabase.from("whatsapp_settings").upsert({ ...current, ...patch, household_id: hid });
      if (error) throw error;
    },
    onMutate: async (patch) => {
      await qc.cancelQueries({ queryKey: ["whatsapp_settings", hid] });
      const prev = qc.getQueryData<WhatsappSettings>(["whatsapp_settings", hid]);
      if (prev) qc.setQueryData(["whatsapp_settings", hid], { ...prev, ...patch });
      return { prev };
    },
    onError: (_e, _p, ctx) => ctx?.prev && qc.setQueryData(["whatsapp_settings", hid], ctx.prev),
    onSettled: () => qc.invalidateQueries({ queryKey: ["whatsapp_settings", hid] }),
  });

  const upsertMessage = useMutation({
    mutationFn: async (m: Partial<WhatsappMessage> & { text: string }) => {
      const row = { ...m, household_id: hid };
      const { error } = m.id
        ? await supabase.from("whatsapp_messages").update(row).eq("id", m.id)
        : await supabase.from("whatsapp_messages").insert(row);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["whatsapp_messages", hid] }),
  });

  const deleteMessage = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("whatsapp_messages").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["whatsapp_messages", hid] }),
  });

  /** Send a one-off text or the summary right now */
  const sendNow = useMutation({
    mutationFn: (payload: { action: "send_text" | "send_summary"; text?: string; kind?: "daily" | "weekly" }) => whatsappAction(payload.action, payload),
    onSettled: () => qc.invalidateQueries({ queryKey: ["whatsapp_log", hid] }),
  });

  return {
    settings: settings.data,
    isLoading: settings.isLoading,
    loadError: settings.error as Error | null,
    messages: messages.data ?? [],
    log: log.data ?? [],
    saveSettings,
    upsertMessage,
    deleteMessage,
    sendNow,
  };
}
