import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../lib/supabase";
import { queryKeys } from "../state/queryKeys";
import { useProfile } from "./useProfile";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = Record<string, any>;

function currentMonth() {
  return new Date().toISOString().slice(0, 7); // YYYY-MM
}

export function useCategories() {
  const { data: profile } = useProfile();
  const hid = profile?.household_id ?? "";

  return useQuery<Row[]>({
    queryKey: queryKeys.categories(hid),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("categories")
        .select("*")
        .eq("household_id", hid)
        .order("name");
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!hid,
  });
}

export function useTransactions(month = currentMonth()) {
  const { data: profile } = useProfile();
  const hid = profile?.household_id ?? "";
  const qc = useQueryClient();
  const from = `${month}-01`;
  const to = `${month}-31`;

  const query = useQuery<Row[]>({
    queryKey: queryKeys.transactions(hid, month),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("transactions")
        .select("*, categories(name, transaction_type)")
        .eq("household_id", hid)
        .gte("transaction_date", from)
        .lte("transaction_date", to)
        .order("transaction_date", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!hid,
  });

  const addTransaction = useMutation({
    mutationFn: async (tx: Row) => {
      const { data, error } = await supabase
        .from("transactions")
        .insert({ ...tx, household_id: hid, entered_by: profile?.id })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.transactions(hid, month) }),
  });

  const deleteTransaction = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("transactions").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.transactions(hid, month) }),
  });

  const totals = (query.data ?? []).reduce(
    (acc, tx) => {
      if (tx.transaction_type === "income") acc.income += Number(tx.amount);
      else acc.expenses += Number(tx.amount);
      return acc;
    },
    { income: 0, expenses: 0 }
  );

  return { ...query, addTransaction, deleteTransaction, totals, profile };
}

