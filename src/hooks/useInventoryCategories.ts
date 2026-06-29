import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../lib/supabase";
import { queryKeys } from "../state/queryKeys";
import { useProfile } from "./useProfile";
type Row = Record<string, any>;
export function useInventoryCategories() {
  const { data: profile } = useProfile();
  const hid = profile?.household_id ?? "";
  const qc = useQueryClient();
  const query = useQuery<Row[]>({
    queryKey: queryKeys.inventoryCategories(hid),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("inventory_categories")
        .select("*")
        .eq("household_id", hid)
        .order("sort_order");
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!hid,
  });
  const addCategory = useMutation({
    mutationFn: async (name: string) => {
      const maxOrder = Math.max(0, ...(query.data ?? []).map((c) => c.sort_order ?? 0));
      const { data, error } = await supabase
        .from("inventory_categories")
        .insert({ household_id: hid, name, sort_order: maxOrder + 1, is_system: false })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.inventoryCategories(hid) }),
  });
  const deleteCategory = useMutation({
    mutationFn: async (id: string) => {
      // Unlink items from this category first
      await supabase.from("inventory").update({ category_id: null }).eq("category_id", id);
      const { error } = await supabase.from("inventory_categories").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.inventoryCategories(hid) });
      qc.invalidateQueries({ queryKey: queryKeys.inventory(hid) });
    },
  });
  return { ...query, addCategory, deleteCategory };
}
