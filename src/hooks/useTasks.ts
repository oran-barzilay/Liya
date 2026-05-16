import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../lib/supabase";
import { queryKeys } from "../state/queryKeys";
import { useProfile } from "./useProfile";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = Record<string, any>;

export function useTasks() {
  const { data: profile } = useProfile();
  const hid = profile?.household_id ?? "";
  const qc = useQueryClient();

  const query = useQuery<Row[]>({
    queryKey: queryKeys.tasks(hid),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tasks")
        .select("*")
        .eq("household_id", hid)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!hid,
  });

  const createTask = useMutation({
    mutationFn: async (task: Row) => {
      const { data, error } = await supabase
        .from("tasks")
        .insert({ ...task, created_by: profile?.id, household_id: hid })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.tasks(hid) }),
  });

  const updateTask = useMutation({
    mutationFn: async ({ id, ...updates }: Row) => {
      const { data, error } = await supabase
        .from("tasks")
        .update(updates)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.tasks(hid) }),
  });

  const deleteTask = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("tasks").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.tasks(hid) }),
  });

  return { ...query, createTask, updateTask, deleteTask, profile };
}

