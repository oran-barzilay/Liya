import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../lib/supabase";
import { useProfile } from "./useProfile";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = Record<string, any>;

export function useChildren() {
  const { data: profile } = useProfile();
  const hid = profile?.household_id ?? "";

  return useQuery<Row[]>({
    queryKey: ["children", hid],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("children")
        .select("*")
        .eq("household_id", hid);
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!hid,
  });
}

export function useBabyLogs(childId?: string) {
  const { data: profile } = useProfile();
  const hid = profile?.household_id ?? "";
  const qc = useQueryClient();

  const query = useQuery<Row[]>({
    queryKey: ["baby_logs", hid, childId ?? "all"],
    queryFn: async () => {
      let q = supabase
        .from("baby_logs")
        .select("*")
        .eq("household_id", hid)
        .order("event_at", { ascending: false })
        .limit(100);
      if (childId) q = q.eq("child_id", childId);
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!hid,
  });

  const addLog = useMutation({
    mutationFn: async (log: Row) => {
      const { data, error } = await supabase
        .from("baby_logs")
        .insert({ ...log, household_id: hid, recorded_by: profile?.id })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["baby_logs", hid] }),
  });

  return { ...query, addLog, profile };
}

export function useAppointments() {
  const { data: profile } = useProfile();
  const hid = profile?.household_id ?? "";
  const qc = useQueryClient();

  const query = useQuery<Row[]>({
    queryKey: ["appointments", hid],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("appointments")
        .select("*, children(name)")
        .eq("household_id", hid)
        .gte("starts_at", new Date().toISOString())
        .order("starts_at");
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!hid,
  });

  const upsertAppointment = useMutation({
    mutationFn: async (appt: Row) => {
      const payload = { ...appt, household_id: hid, created_by: profile?.id };
      const { data, error } = appt.id
        ? await supabase.from("appointments").update(payload).eq("id", appt.id).select().single()
        : await supabase.from("appointments").insert(payload).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["appointments", hid] }),
  });

  return { ...query, upsertAppointment, profile };
}

