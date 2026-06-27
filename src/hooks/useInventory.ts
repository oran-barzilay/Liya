import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../lib/supabase";
import { queryKeys } from "../state/queryKeys";
import { useProfile } from "./useProfile";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = Record<string, any>;

export function useInventory() {
  const { data: profile } = useProfile();
  const hid = profile?.household_id ?? "";
  const qc = useQueryClient();

  const query = useQuery<Row[]>({
    queryKey: queryKeys.inventory(hid),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("inventory")
        .select("*")
        .eq("household_id", hid)
        .order("name");
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!hid,
  });

  const upsertItem = useMutation({
    mutationFn: async (item: Row) => {
      const payload = { ...item, household_id: hid, updated_by: profile?.id };
      const { data, error } = item.id
        ? await supabase.from("inventory").update(payload).eq("id", item.id).select().single()
        : await supabase.from("inventory").insert(payload).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.inventory(hid) });
      qc.invalidateQueries({ queryKey: queryKeys.tasks(hid) });
    },
  });

  const deleteItem = useMutation({
    mutationFn: async (id: string) => {
      // Also delete related tasks (inventory restock tasks referencing this item)
      await supabase.from("tasks")
        .delete()
        .eq("household_id", hid)
        .eq("module", "inventory")
        .like("description", `%${id}%`);
      const { error } = await supabase.from("inventory").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.inventory(hid) });
      qc.invalidateQueries({ queryKey: queryKeys.tasks(hid) });
    },
  });

  return { ...query, upsertItem, deleteItem, profile };
}

