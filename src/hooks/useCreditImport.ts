import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../lib/supabase";
import { queryKeys } from "../state/queryKeys";
import { useProfile } from "./useProfile";
import * as XLSX from "xlsx";
type Row = Record<string, any>;
export interface ParsedCreditRow {
  card_name: string;
  billing_date: string;
  transaction_date: string;
  business_name: string;
  amount_ils: number;
  purchase_amount: number;
  reference_number: string;
  transaction_type_desc: string;
  expense_type: "fixed" | "variable" | "one_time";
  category_id: string;
  ownership_type: "shared" | "personal";
  owner_user_id: string;
}
/** Parse Bank Hapoalim Excel file and return flat array of transactions */
export function parseHapoalimExcel(file: File): Promise<Omit<ParsedCreditRow, "category_id" | "ownership_type" | "owner_user_id">[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const wb = XLSX.read(data, { type: "binary", cellDates: true });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json<any[]>(ws, { header: 1, raw: false, dateNF: "YYYY-MM-DD" });
        const parsed: Omit<ParsedCreditRow, "category_id" | "ownership_type" | "owner_user_id">[] = [];
        // Find all sections with "שם בית עסק" header
        let i = 0;
        while (i < rows.length) {
          const row = rows[i] as any[];
          if (row && row.some((c: any) => typeof c === "string" && c.includes("שם בית עסק"))) {
            // Found header row - read data rows below
            i++;
            while (i < rows.length) {
              const dr = rows[i] as any[];
              if (!dr || (!dr[0] && !dr[3])) break; // empty row
              if (dr[3]) {
                const businessName = String(dr[3] ?? "").trim();
                const amtRaw = dr[4];
                const amount = parseFloat(String(amtRaw ?? "0").replace(/[^0-9.-]/g, "")) || 0;
                const purchaseRaw = dr[5];
                const purchase = parseFloat(String(purchaseRaw ?? "0").replace(/[^0-9.-]/g, "")) || 0;
                const txTypeDesc = String(dr[12] ?? dr[13] ?? "").trim();
                const billingDateRaw = dr[1];
                const txDateRaw = dr[2];
                const fmtDate = (v: any): string => {
                  if (!v) return "";
                  if (typeof v === "string") return v.slice(0, 10);
                  if (v instanceof Date) return v.toISOString().slice(0, 10);
                  // XLSX serial date
                  const d = XLSX.SSF.parse_date_code(Number(v));
                  if (d) return `${d.y}-${String(d.m).padStart(2,"0")}-${String(d.d).padStart(2,"0")}`;
                  return "";
                };
                if (businessName && amount > 0) {
                  parsed.push({
                    card_name: String(dr[0] ?? ""),
                    billing_date: fmtDate(billingDateRaw),
                    transaction_date: fmtDate(txDateRaw),
                    business_name: businessName,
                    amount_ils: amount,
                    purchase_amount: purchase,
                    reference_number: String(dr[6] ?? dr[7] ?? ""),
                    transaction_type_desc: txTypeDesc,
                    expense_type: txTypeDesc === "הוראת קבע" ? "fixed" : "variable",
                  });
                }
              }
              i++;
            }
          } else {
            i++;
          }
        }
        resolve(parsed);
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = reject;
    reader.readAsBinaryString(file);
  });
}
export function useCreditImports() {
  const { data: profile } = useProfile();
  const hid = profile?.household_id ?? "";
  const qc = useQueryClient();
  const importsQuery = useQuery<Row[]>({
    queryKey: queryKeys.creditImports(hid),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("credit_imports")
        .select("*, users!credit_imports_imported_by_fkey(display_name)")
        .eq("household_id", hid)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!hid,
  });
  const saveImport = useMutation({
    mutationFn: async ({ fileName, billingMonth, ownershipType, ownerUserId, rows }: {
      fileName: string;
      billingMonth: string;
      ownershipType: "shared" | "personal";
      ownerUserId?: string;
      rows: ParsedCreditRow[];
    }) => {
      // 1. Create import record
      const { data: imp, error: impErr } = await supabase
        .from("credit_imports")
        .insert({
          household_id: hid,
          file_name: fileName,
          billing_month: billingMonth,
          ownership_type: ownershipType,
          owner_user_id: ownerUserId || null,
          imported_by: profile?.id,
          row_count: rows.length,
        })
        .select()
        .single();
      if (impErr) throw impErr;
      // 2. Insert all rows
      const txRows = rows.map((r) => ({
        household_id: hid,
        import_id: imp.id,
        card_name: r.card_name,
        billing_date: r.billing_date || null,
        transaction_date: r.transaction_date || null,
        business_name: r.business_name,
        amount_ils: r.amount_ils,
        purchase_amount: r.purchase_amount,
        reference_number: r.reference_number || null,
        transaction_type_desc: r.transaction_type_desc || null,
        expense_type: r.expense_type,
        category_id: r.category_id || null,
        ownership_type: r.ownership_type,
        owner_user_id: r.owner_user_id || null,
        billing_month: billingMonth,
      }));
      const { error: txErr } = await supabase.from("credit_transactions").insert(txRows);
      if (txErr) throw txErr;
      // 3. Upsert business mappings (only for rows with category set)
      const mappings = rows
        .filter((r) => r.category_id)
        .map((r) => ({
          household_id: hid,
          business_name: r.business_name,
          category_id: r.category_id,
          expense_type: r.expense_type,
        }));
      if (mappings.length > 0) {
        await supabase
          .from("business_mappings")
          .upsert(mappings, { onConflict: "household_id,business_name", ignoreDuplicates: false });
      }
      return imp;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.creditImports(hid) });
      qc.invalidateQueries({ queryKey: queryKeys.analytics(hid, 1) });
      qc.invalidateQueries({ queryKey: queryKeys.analytics(hid, 3) });
      qc.invalidateQueries({ queryKey: queryKeys.analytics(hid, 6) });
      qc.invalidateQueries({ queryKey: queryKeys.analytics(hid, 12) });
    },
  });
  const deleteImport = useMutation({
    mutationFn: async (importId: string) => {
      await supabase.from("credit_transactions").delete().eq("import_id", importId);
      const { error } = await supabase.from("credit_imports").delete().eq("id", importId);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.creditImports(hid) }),
  });
  return { ...importsQuery, saveImport, deleteImport, profile };
}
export function useCreditTransactions(month: string) {
  const { data: profile } = useProfile();
  const hid = profile?.household_id ?? "";
  return useQuery<Row[]>({
    queryKey: queryKeys.creditTransactions(hid, month),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("credit_transactions")
        .select("*, categories(name)")
        .eq("household_id", hid)
        .eq("billing_month", month)
        .order("transaction_date", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!hid,
  });
}
export function useBusinessMappings() {
  const { data: profile } = useProfile();
  const hid = profile?.household_id ?? "";
  return useQuery<Row[]>({
    queryKey: queryKeys.businessMappings(hid),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("business_mappings")
        .select("*, categories(name)")
        .eq("household_id", hid)
        .order("business_name");
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!hid,
  });
}
export function useFinanceAnalytics(monthsBack: number) {
  const { data: profile } = useProfile();
  const hid = profile?.household_id ?? "";
  return useQuery({
    queryKey: queryKeys.analytics(hid, monthsBack),
    queryFn: async () => {
      const now = new Date();
      const months: string[] = [];
      for (let i = monthsBack - 1; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
      }
      const fromDate = months[0] + "-01";
      const toDate = months[months.length - 1] + "-31";
      // Fetch manual transactions
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: txs } = await (supabase as any)
        .from("transactions")
        .select("*, categories(name, transaction_type)")
        .eq("household_id", hid)
        .gte("transaction_date", fromDate)
        .lte("transaction_date", toDate)
        .eq("transaction_type", "expense");
      // Fetch credit transactions
      const { data: creditTxs } = await supabase
        .from("credit_transactions")
        .select("*, categories(name)")
        .eq("household_id", hid)
        .in("billing_month", months);
      const allExpenses = [
        ...(txs ?? []).map((t: any) => ({
          month: t.transaction_date?.slice(0, 7) ?? "",
          category: t.categories?.name ?? "אחר",
          amount: Number(t.amount),
          expense_type: t.expense_type ?? "variable",
          owner: t.owner_user_id,
        })),
        ...(creditTxs ?? []).map((t: any) => ({
          month: t.billing_month ?? "",
          category: t.categories?.name ?? "אחר",
          amount: Number(t.amount_ils),
          expense_type: t.expense_type ?? "variable",
          owner: t.owner_user_id,
        })),
      ];
      // By category
      const catMap: Record<string, number> = {};
      allExpenses.forEach((e) => {
        catMap[e.category] = (catMap[e.category] ?? 0) + e.amount;
      });
      const byCategory = Object.entries(catMap)
        .sort((a, b) => b[1] - a[1])
        .map(([name, value]) => ({ name, value: Math.round(value * 100) / 100 }));
      // By month
      const monthMap: Record<string, { fixed: number; variable: number; one_time: number; total: number }> = {};
      months.forEach((m) => (monthMap[m] = { fixed: 0, variable: 0, one_time: 0, total: 0 }));
      allExpenses.forEach((e) => {
        const m = monthMap[e.month];
        if (!m) return;
        m[e.expense_type as "fixed" | "variable" | "one_time"] += e.amount;
        m.total += e.amount;
      });
      const byMonth = months.map((m) => ({
        month: m,
        label: new Date(m + "-15").toLocaleDateString("he-IL", { month: "short", year: "2-digit" }),
        ...monthMap[m],
      }));
      // Totals
      const total = allExpenses.reduce((s, e) => s + e.amount, 0);
      const fixed = allExpenses.filter((e) => e.expense_type === "fixed").reduce((s, e) => s + e.amount, 0);
      const variable = allExpenses.filter((e) => e.expense_type === "variable").reduce((s, e) => s + e.amount, 0);
      const one_time = allExpenses.filter((e) => e.expense_type === "one_time").reduce((s, e) => s + e.amount, 0);
      return { byCategory, byMonth, total, fixed, variable, one_time, months };
    },
    enabled: !!hid,
  });
}
