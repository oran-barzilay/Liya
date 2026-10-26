import { useState, useRef } from "react";
import { useTransactions, useCategories } from "../hooks/useFinance";
import { useProfile } from "../hooks/useProfile";
import { useCreditImports, useCreditTransactions, useFinanceAnalytics, parseHapoalimExcel, type ParsedCreditRow } from "../hooks/useCreditImport";
import Icon from "../components/Icon";
import AppCalendar from "../components/AppCalendar";
import Fab from "../components/Fab";
import {
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend
} from "recharts";
type Row = Record<string, any>;
const CHART_COLORS = ["#818cf8","#34d399","#f87171","#fbbf24","#a78bfa","#38bdf8","#fb7185","#4ade80","#f59e0b","#60a5fa"];
// Static class names so Tailwind can see them (template-built names are purged)
const SUMMARY_TONE = {
  emerald: { box: "bg-emerald-950/40 border-emerald-800", label: "text-emerald-400", value: "text-emerald-300" },
  red:     { box: "bg-red-950/40 border-red-800",         label: "text-red-400",     value: "text-red-300" },
} as const;
// Chart chrome follows the active theme
const TOOLTIP_STYLE = { background: "var(--surface-800)", border: "1px solid var(--surface-border)", borderRadius: 8, color: "var(--text-primary)" };
const AXIS_TICK = { fontSize: 11, fill: "var(--text-muted)" };
const EXPENSE_TYPE_LABEL: Record<string, string> = {
  fixed: "קבועה", variable: "משתנה", one_time: "חד פעמית"
};
// ─── Manual Tab ────────────────────────────────────────────────────────────────
function AddTxModal({ categories, profile, members, onClose, onSave }: {
  categories: Row[]; profile: Row | null | undefined; members: Row[];
  onClose: () => void; onSave: (t: Row) => void;
}) {
  const [type, setType] = useState<"income" | "expense">("expense");
  const [amount, setAmount] = useState("");
  const [catId, setCatId] = useState("");
  const [expenseType, setExpenseType] = useState("variable");
  const [ownership, setOwnership] = useState("shared");
  const [ownerUserId, setOwnerUserId] = useState(profile?.id ?? "");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState("");
  const filteredCats = categories.filter((c) => c.transaction_type === type);
  return (
    <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <form onSubmit={(e) => {
        e.preventDefault();
        onSave({
          transaction_type: type, amount: Number(amount), category_id: catId,
          expense_type: expenseType, ownership_type: ownership,
          owner_user_id: ownership === "personal" ? ownerUserId : profile?.id,
          transaction_date: date, notes: notes || null,
        });
        onClose();
      }} className="modal-panel bg-slate-900 border-slate-700 sm:max-w-sm space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-theme">תנועה חדשה</h3>
          <button type="button" onClick={onClose} className="-m-2 p-2 rounded-lg text-theme-muted hover:text-theme" aria-label="סגור"><Icon name="x" className="w-5 h-5" /></button>
        </div>
        <div className="flex rounded-lg bg-slate-800 p-0.5">
          {(["expense","income"] as const).map((t) => (
            <button key={t} type="button" onClick={() => setType(t)}
              className={"flex-1 py-2.5 sm:py-1.5 rounded-md text-sm sm:text-xs font-medium transition-colors " +
                (type===t ? (t==="income" ? "bg-emerald-700 text-white" : "bg-red-700 text-white") : "text-theme-muted")}>
              {t==="income" ? "הכנסה" : "הוצאה"}
            </button>
          ))}
        </div>
        <div><label className="text-xs text-theme-muted block mb-1">סכום (₪) *</label>
          <input type="number" inputMode="decimal" required min="0" step="0.01" value={amount} onChange={(e)=>setAmount(e.target.value)} className="input-base w-full" placeholder="0.00" /></div>
        <div><label className="text-xs text-theme-muted block mb-1">קטגוריה *</label>
          <select required value={catId} onChange={(e)=>setCatId(e.target.value)} className="input-base w-full">
            <option value="">בחר...</option>{filteredCats.map((c)=><option key={c.id} value={c.id}>{c.name}</option>)}
          </select></div>
        <div className="grid grid-cols-2 gap-2">
          <div><label className="text-xs text-theme-muted block mb-1">סוג הוצאה</label>
            <select value={expenseType} onChange={(e)=>setExpenseType(e.target.value)} className="input-base w-full">
              <option value="variable">משתנה</option><option value="fixed">קבועה</option><option value="one_time">חד פעמית</option>
            </select></div>
          <div><label className="text-xs text-theme-muted block mb-1">שייכות</label>
            <select value={ownership} onChange={(e)=>setOwnership(e.target.value)} className="input-base w-full">
              <option value="shared">משותף</option><option value="personal">אישי</option>
            </select></div>
        </div>
        {ownership==="personal" && members.length>0 && (
          <div><label className="text-xs text-theme-muted block mb-1">של מי</label>
            <select value={ownerUserId} onChange={(e)=>setOwnerUserId(e.target.value)} className="input-base w-full">
              {members.map((m)=><option key={m.id} value={m.id}>{m.display_name}</option>)}
            </select></div>
        )}
        <AppCalendar label="תאריך" value={date} onChange={setDate} />
        <div><label className="text-xs text-theme-muted block mb-1">הערות</label>
          <input value={notes} onChange={(e)=>setNotes(e.target.value)} className="input-base w-full" /></div>
        <button type="submit" className="w-full bg-accent-600 hover:bg-accent-500 text-white font-medium py-3 sm:py-2 rounded-xl sm:rounded-lg text-sm">הוסף תנועה</button>
      </form>
    </div>
  );
}
function ManualTab({ categories, profile, members }: { categories: Row[]; profile: Row | null | undefined; members: Row[] }) {
  const currentMonth = new Date().toISOString().slice(0, 7);
  const [month, setMonth] = useState(currentMonth);
  const { data: txs = [], addTransaction, deleteTransaction, totals } = useTransactions(month);
  const [modal, setModal] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [filterOwner, setFilterOwner] = useState<string>("all");
  const balance = totals.income - totals.expenses;
  const filtered = filterOwner === "all" ? txs : txs.filter((t) => t.owner_user_id === filterOwner);
  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2 mb-5">
        <div className="flex items-center gap-2 min-w-0">
          <AppCalendar value={month + "-01"} onChange={(d) => setMonth(d.slice(0,7))} placeholder="בחר חודש" />
        </div>
        <button onClick={() => setModal(true)} className="hidden md:flex w-full sm:w-auto bg-accent-600 hover:bg-accent-500 text-white text-sm font-medium px-4 py-2 rounded-lg items-center justify-center gap-1.5">
          <Icon name="plus" className="w-3.5 h-3.5" /> הוסף תנועה
        </button>
      </div>
      <div className="grid grid-cols-3 gap-2 sm:gap-4 mb-5">
        {([{l:"הכנסות",v:totals.income,c:"emerald"},{l:"הוצאות",v:totals.expenses,c:"red"},{l:"מאזן",v:balance,c:balance>=0?"emerald":"red"}] as const).map(({l,v,c})=>(
          <div key={l} className={`border rounded-xl p-3 sm:p-4 min-w-0 ${SUMMARY_TONE[c].box}`}>
            <div className={`text-xs font-medium mb-1 ${SUMMARY_TONE[c].label}`}>{l}</div>
            <div className={`text-sm sm:text-xl font-bold truncate ${SUMMARY_TONE[c].value}`}>{v>=0?"+":""}{v.toLocaleString("he-IL")} ₪</div>
          </div>
        ))}
      </div>
      <div className="flex gap-2 mb-4 overflow-x-auto no-scrollbar">
        <button onClick={()=>setFilterOwner("all")} className={"px-3 py-1.5 rounded-lg text-xs font-medium transition-colors " + (filterOwner==="all" ? "bg-slate-700 text-theme" : "bg-slate-900 border border-slate-800 text-theme-muted hover:text-theme")}>הכל</button>
        {members.map((m) => (
          <button key={m.id} onClick={()=>setFilterOwner(m.id)} className={"px-3 py-1.5 rounded-lg text-xs font-medium transition-colors " + (filterOwner===m.id ? "bg-slate-700 text-theme" : "bg-slate-900 border border-slate-800 text-theme-muted hover:text-theme")}>{m.display_name}</button>
        ))}
      </div>
      <div className="space-y-2">
        {filtered.map((tx) => (
          <div key={tx.id} className="flex items-center gap-3 bg-slate-900 border border-slate-800 rounded-xl ps-4 pe-1 sm:pe-4 py-2 sm:py-3 group">
            <div className={"w-2 h-2 rounded-full shrink-0 " + (tx.transaction_type==="income" ? "bg-emerald-500" : "bg-red-500")} />
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-theme">{tx.categories?.name ?? "ללא קטגוריה"}</div>
              <div className="text-xs text-theme-muted truncate">
                <span className="sm:hidden">{tx.transaction_date}{tx.notes ? " · " : ""}</span>{tx.notes}
              </div>
            </div>
            <span className="text-xs bg-slate-800 text-theme-muted px-2 py-0.5 rounded-full hidden sm:block">{EXPENSE_TYPE_LABEL[tx.expense_type] ?? tx.expense_type}</span>
            <span className="text-xs text-theme-muted hidden sm:block">{tx.transaction_date}</span>
            <span className={"font-semibold text-sm shrink-0 " + (tx.transaction_type==="income" ? "text-emerald-400" : "text-red-400")}>
              {tx.transaction_type==="income" ? "+" : "-"}₪{Number(tx.amount).toLocaleString("he-IL")}
            </span>
            <button onClick={()=>setPendingDeleteId(tx.id)} className="p-2.5 sm:p-1 text-slate-600 hover:text-red-400 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 sm:focus:opacity-100" aria-label="מחיקה">
              <Icon name="trash" className="w-4 h-4" />
            </button>
          </div>
        ))}
        {filtered.length===0 && <div className="text-center py-12 text-theme-muted">אין תנועות החודש.</div>}
      </div>
      <div className="h-20 md:hidden" aria-hidden="true" />
      <Fab label="תנועה" onClick={() => setModal(true)} />
      {modal && <AddTxModal categories={categories} profile={profile} members={members} onClose={()=>setModal(false)} onSave={(d)=>addTransaction.mutate(d)} />}
      {pendingDeleteId && (
        <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) setPendingDeleteId(null); }}>
          <div className="modal-panel sm:max-w-md border-slate-700 bg-slate-900">
            <div className="flex items-center gap-2 mb-1"><Icon name="warning" className="w-5 h-5 text-red-400" /><h3 className="text-base font-semibold text-theme">למחוק תנועה זו?</h3></div>
            <p className="text-sm text-theme-muted mt-1">הפעולה אינה ניתנת לביטול.</p>
            <div className="grid grid-cols-2 gap-2 mt-5 sm:flex sm:justify-end sm:mt-4">
              <button onClick={()=>setPendingDeleteId(null)} className="px-4 py-2.5 sm:py-2 rounded-xl sm:rounded-lg text-sm font-medium bg-slate-800 text-theme-muted hover:bg-slate-700">ביטול</button>
              <button onClick={()=>{deleteTransaction.mutate(pendingDeleteId);setPendingDeleteId(null);}} className="px-4 py-2.5 sm:py-2 rounded-xl sm:rounded-lg text-sm font-medium bg-red-600 text-white hover:bg-red-500">מחיקה</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
// ─── Credit Import Tab ──────────────────────────────────────────────────────────
interface ReviewRow extends Omit<ParsedCreditRow, "category_id" | "ownership_type" | "owner_user_id"> {
  category_id: string;
  ownership_type: "shared" | "personal";
  owner_user_id: string;
}
function CreditTab({ categories, profile, members }: { categories: Row[]; profile: Row | null | undefined; members: Row[] }) {
  const { data: imports = [], saveImport, deleteImport } = useCreditImports();
  const currentMonth = new Date().toISOString().slice(0, 7);
  const [viewMonth, setViewMonth] = useState(currentMonth);
  const { data: txRows = [] } = useCreditTransactions(viewMonth);
  const [reviewing, setReviewing] = useState<ReviewRow[] | null>(null);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [billingMonth, setBillingMonth] = useState(currentMonth);
  const [importOwnership, setImportOwnership] = useState<"shared" | "personal">("shared");
  const [importOwnerUserId, setImportOwnerUserId] = useState(profile?.id ?? "");
  const [parsing, setParsing] = useState(false);
  const [parseError, setParseError] = useState("");
  const [expandedImport, setExpandedImport] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const expenseCategories = categories.filter((c) => c.transaction_type === "expense");
  const handleFile = async (f: File) => {
    setImportFile(f);
    setParseError("");
    setParsing(true);
    try {
      const rows = await parseHapoalimExcel(f);
      const reviewRows: ReviewRow[] = rows.map((r) => ({
        ...r,
        category_id: "",
        ownership_type: importOwnership,
        owner_user_id: importOwnership === "personal" ? importOwnerUserId : (profile?.id ?? ""),
      }));
      setReviewing(reviewRows);
    } catch (e: any) {
      setParseError(e?.message ?? "שגיאה בניתוח הקובץ");
    } finally {
      setParsing(false);
    }
  };
  const updateRow = (idx: number, patch: Partial<ReviewRow>) => {
    if (!reviewing) return;
    const updated = reviewing.map((r, i) => i === idx ? { ...r, ...patch } : r);
    setReviewing(updated);
  };
  const confirmImport = () => {
    if (!reviewing || !importFile) return;
    saveImport.mutate({
      fileName: importFile.name,
      billingMonth,
      ownershipType: importOwnership,
      ownerUserId: importOwnership === "personal" ? importOwnerUserId : undefined,
      rows: reviewing,
    }, { onSuccess: () => { setReviewing(null); setImportFile(null); } });
  };
  return (
    <div>
      {/* Upload area */}
      <div className="bg-slate-900 border border-dashed border-slate-600 rounded-xl p-4 sm:p-6 mb-5">
        <div className="flex flex-col items-center gap-3 text-center">
          <Icon name="credit-card" className="w-8 h-8 text-accent-400" />
          <div>
            <p className="text-sm font-medium text-theme">ייבוא פירוט אשראי - בנק הפועלים</p>
            <p className="text-xs text-theme-muted mt-0.5">העלה קובץ Excel בפורמט בנק הפועלים</p>
          </div>
          <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-3 items-end justify-center w-full sm:w-auto text-right">
            <div>
              <label className="text-xs text-theme-muted block mb-1">חודש חיוב</label>
              <AppCalendar value={billingMonth + "-01"} onChange={(d) => setBillingMonth(d.slice(0,7))} placeholder="YYYY-MM" />
            </div>
            <div>
              <label className="text-xs text-theme-muted block mb-1">שייכות</label>
              <select value={importOwnership} onChange={(e) => setImportOwnership(e.target.value as "shared" | "personal")} className="input-base text-sm w-full">
                <option value="shared">משותף</option><option value="personal">אישי</option>
              </select>
            </div>
            {importOwnership === "personal" && (
              <div>
                <label className="text-xs text-theme-muted block mb-1">של מי</label>
                <select value={importOwnerUserId} onChange={(e) => setImportOwnerUserId(e.target.value)} className="input-base text-sm">
                  {members.map((m) => <option key={m.id} value={m.id}>{m.display_name}</option>)}
                </select>
              </div>
            )}
            <button onClick={() => fileRef.current?.click()} disabled={parsing}
              className="col-span-2 sm:col-span-1 bg-accent-600 hover:bg-accent-500 text-white text-sm px-4 py-3 sm:py-2 rounded-xl sm:rounded-lg flex items-center justify-center gap-1.5">
              <Icon name="upload" className="w-3.5 h-3.5" /> {parsing ? "מנתח..." : "בחר קובץ"}
            </button>
          </div>
          <input ref={fileRef} type="file" accept=".xlsx,.xls" className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ""; }} />
          {parseError && <p className="text-red-400 text-xs">{parseError}</p>}
        </div>
      </div>
      {/* Review table */}
      {reviewing && (
        <div className="bg-slate-900 border border-accent-800 rounded-xl p-4 mb-5">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
            <h3 className="font-semibold text-theme">סקירה לפני ייבוא ({reviewing.length} שורות)</h3>
            <div className="flex gap-2">
              <button onClick={() => setReviewing(null)} className="text-xs px-3 py-2 sm:py-1.5 rounded-lg bg-slate-800 text-theme-muted hover:bg-slate-700">ביטול</button>
              <button onClick={confirmImport} className="text-xs px-3 py-2 sm:py-1.5 rounded-lg bg-accent-600 text-white hover:bg-accent-500">ייבא הכל</button>
            </div>
          </div>
          <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
            <table className="w-full min-w-[640px] text-xs">
              <thead>
                <tr className="border-b border-slate-700">
                  <th className="text-right py-2 px-1 text-theme-muted font-medium">תאריך</th>
                  <th className="text-right py-2 px-1 text-theme-muted font-medium">שם עסק</th>
                  <th className="text-right py-2 px-1 text-theme-muted font-medium">סכום</th>
                  <th className="text-right py-2 px-1 text-theme-muted font-medium">קטגוריה</th>
                  <th className="text-right py-2 px-1 text-theme-muted font-medium">סוג</th>
                  <th className="text-right py-2 px-1 text-theme-muted font-medium">שייכות</th>
                </tr>
              </thead>
              <tbody>
                {reviewing.map((row, idx) => (
                  <tr key={idx} className="border-b border-slate-800 hover:bg-slate-800/50">
                    <td className="py-1.5 px-1 text-theme-muted">{row.transaction_date}</td>
                    <td className="py-1.5 px-1 text-theme max-w-32 truncate">{row.business_name}</td>
                    <td className="py-1.5 px-1 text-red-400 font-medium">{row.amount_ils.toFixed(2)} ₪</td>
                    <td className="py-1.5 px-1">
                      <select value={row.category_id} onChange={(e) => updateRow(idx, { category_id: e.target.value })} className="input-base text-xs py-0.5 w-28">
                        <option value="">ללא סיווג</option>
                        {expenseCategories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                      </select>
                    </td>
                    <td className="py-1.5 px-1">
                      <select value={row.expense_type} onChange={(e) => updateRow(idx, { expense_type: e.target.value as any })} className="input-base text-xs py-0.5 w-24">
                        <option value="variable">משתנה</option><option value="fixed">קבועה</option><option value="one_time">חד פעמית</option>
                      </select>
                    </td>
                    <td className="py-1.5 px-1">
                      <select value={row.ownership_type} onChange={(e) => updateRow(idx, { ownership_type: e.target.value as any })} className="input-base text-xs py-0.5 w-24">
                        <option value="shared">משותף</option><option value="personal">אישי</option>
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      {/* View transactions by month */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <AppCalendar value={viewMonth + "-01"} onChange={(d) => setViewMonth(d.slice(0,7))} label="הצג חודש" />
      </div>
      {/* Import history */}
      <h3 className="text-sm font-semibold text-theme-muted mb-2">היסטוריית ייבוא</h3>
      {imports.length === 0 && <div className="text-sm text-theme-muted py-4 text-center">לא בוצע ייבוא עדיין.</div>}
      {imports.map((imp) => (
        <div key={imp.id} className="bg-slate-900 border border-slate-800 rounded-xl mb-2">
          <div className="flex items-center gap-2 sm:gap-3 ps-4 pe-3 py-3 cursor-pointer" onClick={() => setExpandedImport(expandedImport === imp.id ? null : imp.id)}>
            <Icon name="credit-card" className="w-4 h-4 text-accent-400 shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-theme truncate">{imp.file_name}</div>
              <div className="text-xs text-theme-muted">{imp.billing_month} · {imp.row_count} שורות · {imp.ownership_type === "shared" ? "משותף" : "אישי"}</div>
            </div>
            <button onClick={(e) => { e.stopPropagation(); deleteImport.mutate(imp.id); }} className="text-slate-600 hover:text-red-400 p-2 -my-1" aria-label="מחק ייבוא"><Icon name="trash" className="w-4 h-4" /></button>
            <Icon name={expandedImport === imp.id ? "chevron-up" : "chevron-down"} className="w-4 h-4 text-theme-muted" />
          </div>
          {expandedImport === imp.id && (
            <div className="border-t border-slate-800 px-4 pb-3 pt-2">
              {txRows.filter((t) => t.import_id === imp.id).map((tx) => (
                <div key={tx.id} className="flex items-center justify-between py-1.5 border-b border-slate-800 last:border-0">
                  <div className="text-xs text-theme-muted w-20 shrink-0">{tx.transaction_date}</div>
                  <div className="text-xs text-theme flex-1 px-2 truncate">{tx.business_name}</div>
                  <div className="hidden sm:block text-xs text-theme-muted px-2">{tx.categories?.name ?? "–"}</div>
                  <div className="text-xs text-red-400 font-medium shrink-0">{Number(tx.amount_ils).toLocaleString("he-IL")} ₪</div>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
// ─── Analytics Tab ──────────────────────────────────────────────────────────────
function AnalyticsTab() {
  const [months, setMonths] = useState(3);
  const { data: analytics, isLoading } = useFinanceAnalytics(months);
  if (isLoading) return <div className="text-center py-12 text-theme-muted">טוען נתונים...</div>;
  if (!analytics || analytics.byCategory.length === 0) return (
    <div className="text-center py-12 text-theme-muted">אין נתוני הוצאות לתקופה הנבחרת.</div>
  );
  const { byCategory, byMonth, total, fixed, variable, one_time } = analytics;
  return (
    <div className="space-y-6">
      {/* Period selector */}
      <div className="grid grid-cols-4 sm:flex gap-2">
        {[[1,"חודש אחרון"],[3,"3 חודשים"],[6,"חצי שנה"],[12,"שנה"]].map(([v,lbl]) => (
          <button key={v} onClick={() => setMonths(Number(v))}
            className={"px-2 sm:px-3 py-2.5 sm:py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors " +
              (months===v ? "bg-accent-600 text-white" : "bg-slate-900 border border-slate-800 text-theme-muted hover:text-theme")}>
            {lbl}
          </button>
        ))}
      </div>
      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          {l:"סה\"כ הוצאות",v:total,c:"text-red-400"},
          {l:"קבועות",v:fixed,c:"text-amber-400"},
          {l:"משתנות",v:variable,c:"text-blue-400"},
          {l:"חד פעמיות",v:one_time,c:"text-purple-400"},
        ].map(({l,v,c}) => (
          <div key={l} className="bg-slate-900 border border-slate-800 rounded-xl p-3 sm:p-4 min-w-0">
            <div className="text-xs text-theme-muted mb-1">{l}</div>
            <div className={`text-lg font-bold ${c}`}>{v.toLocaleString("he-IL")} ₪</div>
          </div>
        ))}
      </div>
      {/* Pie: by category */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
        <h3 className="text-sm font-semibold text-theme mb-4 flex items-center gap-2">
          <Icon name="pie-chart" className="w-4 h-4 text-accent-400" /> הוצאות לפי קטגוריה
        </h3>
        <div className="flex flex-col sm:flex-row gap-4">
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={byCategory.slice(0,10)} cx="50%" cy="50%" outerRadius="85%" dataKey="value" nameKey="name">
                {byCategory.slice(0,10).map((_: any, i: number) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
              </Pie>
              <Tooltip formatter={(v: any) => `${Number(v).toLocaleString("he-IL")} ₪`} contentStyle={TOOLTIP_STYLE} labelStyle={{ color: "var(--text-primary)" }} itemStyle={{ color: "var(--text-primary)" }} />
            </PieChart>
          </ResponsiveContainer>
          <div className="flex-1 space-y-1.5 max-h-60 overflow-y-auto">
            {byCategory.slice(0,10).map((cat: any, i: number) => (
              <div key={cat.name} className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: CHART_COLORS[i%CHART_COLORS.length] }} />
                <span className="text-xs text-theme flex-1 min-w-0 truncate">{cat.name}</span>
                <span className="text-xs text-theme-muted font-medium">{cat.value.toLocaleString("he-IL")} ₪</span>
                <span className="text-xs text-slate-600">({total>0 ? Math.round(cat.value/total*100) : 0}%)</span>
              </div>
            ))}
          </div>
        </div>
      </div>
      {/* Bar: by month */}
      {byMonth.length > 1 && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <h3 className="text-sm font-semibold text-theme mb-4 flex items-center gap-2">
            <Icon name="bar-chart" className="w-4 h-4 text-accent-400" /> הוצאות חודשיות
          </h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={byMonth} margin={{ top:4, right:4, bottom:4, left:0 }}>
              <XAxis dataKey="label" tick={AXIS_TICK} />
              <YAxis tick={AXIS_TICK} width={50} tickFormatter={(v)=>`${Math.round(v/1000)}K`} />
              <Tooltip formatter={(v: any)=>`${Number(v).toLocaleString("he-IL")} ₪`} contentStyle={TOOLTIP_STYLE} labelStyle={{ color: "var(--text-primary)" }} itemStyle={{ color: "var(--text-primary)" }} />
              <Legend wrapperStyle={{ fontSize:11, color: "var(--text-muted)" }} />
              <Bar dataKey="fixed" stackId="a" fill="#fbbf24" name="קבועות" />
              <Bar dataKey="variable" stackId="a" fill="#818cf8" name="משתנות" />
              <Bar dataKey="one_time" stackId="a" fill="#a78bfa" name="חד פעמיות" radius={[4,4,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
// ─── Main Finance Page ──────────────────────────────────────────────────────────
export default function Finance() {
  const { data: categories = [] } = useCategories();
  const { data: profile } = useProfile();
  const [activeTab, setActiveTab] = useState<"manual" | "credit" | "analytics">("manual");
  return (
    <div>
      <h2 className="text-2xl font-bold text-theme mb-4 sm:mb-6">כספים</h2>
      <div className="flex rounded-xl bg-slate-900 border border-slate-800 p-0.5 mb-5 sm:mb-6 w-full sm:w-fit">
        {([["manual","ידני","wallet"],["credit","אשראי","credit-card"],["analytics","ניתוח","bar-chart"]] as const).map(([v,lbl,icon]) => (
          <button key={v} onClick={() => setActiveTab(v)}
            className={"flex-1 sm:flex-none px-4 py-2.5 sm:py-2 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-1.5 " +
              (activeTab===v ? "bg-accent-700 text-white" : "text-theme-muted hover:text-theme")}>
            <Icon name={icon} className="w-3.5 h-3.5" /> {lbl}
          </button>
        ))}
      </div>
      {activeTab === "manual" && <ManualTab categories={categories} profile={profile} members={[]} />}
      {activeTab === "credit" && <CreditTab categories={categories} profile={profile} members={[]} />}
      {activeTab === "analytics" && <AnalyticsTab />}
    </div>
  );
}
