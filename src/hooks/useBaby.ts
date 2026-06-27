import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../lib/supabase";
import { useProfile } from "./useProfile";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = Record<string, any>;

export function useChildren() {
  const { data: profile } = useProfile();
  const hid = profile?.household_id ?? "";
  const qc = useQueryClient();

  const query = useQuery<Row[]>({
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

  const addChild = useMutation({
    mutationFn: async (child: { name: string; birth_date: string }) => {
      const { data, error } = await supabase
        .from("children")
        .insert({ ...child, household_id: hid })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["children", hid] }),
  });

  const deleteChild = useMutation({
    mutationFn: async (childId: string) => {
      const { error } = await supabase.from("children").delete().eq("id", childId);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["children", hid] }),
  });

  return { ...query, addChild, deleteChild };
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
        .limit(200);
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

  const updateLog = useMutation({
    mutationFn: async (log: Row) => {
      const { id, ...rest } = log;
      const { data, error } = await supabase
        .from("baby_logs")
        .update(rest)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["baby_logs", hid] }),
  });

  const deleteLog = useMutation({
    mutationFn: async (logId: string) => {
      const { error } = await supabase.from("baby_logs").delete().eq("id", logId);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["baby_logs", hid] }),
  });

  return { ...query, addLog, updateLog, deleteLog, profile };
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

  const deleteAppointment = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("appointments").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["appointments", hid] }),
  });

  return { ...query, upsertAppointment, deleteAppointment, profile };
}
