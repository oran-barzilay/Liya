import { useState } from "react";
import { useTransactions, useCategories } from "../hooks/useFinance";
import { useProfile } from "../hooks/useProfile";
import Icon from "../components/Icon";

type Row = Record<string, any>;

function AddTxModal({ categories, profile, onClose, onSave }: { categories: Row[]; profile: Row | null | undefined; onClose: () => void; onSave: (t: Row) => void }) {
  const [type, setType] = useState<"income" | "expense">("expense");
  const [amount, setAmount] = useState("");
  const [catId, setCatId] = useState("");
  const [isFixed, setIsFixed] = useState(false);
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState("");
  const [ownerId] = useState(profile?.id ?? "");
  const filteredCats = categories.filter((c) => c.transaction_type === type);

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSave({ transaction_type: type, amount: Number(amount), category_id: catId, is_fixed: isFixed, transaction_date: date, notes: notes || null, owner_user_id: ownerId });
          onClose();
        }}
        className="bg-slate-900 border border-slate-700 rounded-2xl p-5 w-full max-w-sm space-y-4"
      >
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-theme">תנועה חדשה</h3>
          <button type="button" onClick={onClose} className="text-theme-muted hover:text-theme"><Icon name="x" className="w-4 h-4" /></button>
        </div>
        <div className="flex rounded-lg bg-slate-800 p-0.5">
          {(["expense", "income"] as const).map((t) => (
            <button key={t} type="button" onClick={() => setType(t)} className={"flex-1 py-1.5 rounded-md text-xs font-medium transition-colors " + (type === t ? (t === "income" ? "bg-emerald-700 text-white" : "bg-red-700 text-white") : "text-theme-muted")}>
              {t === "income" ? "הכנסה" : "הוצאה"}
            </button>
          ))}
        </div>
        <div><label className="text-xs text-theme-muted block mb-1">סכום (₪) *</label><input type="number" required min="0" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} className="input-base w-full" placeholder="0.00" /></div>
        <div><label className="text-xs text-theme-muted block mb-1">קטגוריה *</label>
          <select required value={catId} onChange={(e) => setCatId(e.target.value)} className="input-base w-full">
            <option value="">בחר...</option>{filteredCats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div><label className="text-xs text-theme-muted block mb-1">תאריך</label><input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="input-base w-full" /></div>
        <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={isFixed} onChange={(e) => setIsFixed(e.target.checked)} /><span className="text-sm text-theme-muted">הוצאה קבועה / חוזרת</span></label>
        <div><label className="text-xs text-theme-muted block mb-1">הערות</label><input value={notes} onChange={(e) => setNotes(e.target.value)} className="input-base w-full" /></div>
        <button type="submit" className="w-full bg-accent-600 hover:bg-accent-500 text-white font-medium py-2 rounded-lg text-sm transition-colors">הוסף תנועה</button>
      </form>
    </div>
  );
}

export default function Finance() {
  const currentMonth = new Date().toISOString().slice(0, 7);
  const [month, setMonth] = useState(currentMonth);
  const { data: txs = [], addTransaction, deleteTransaction, totals } = useTransactions(month);
  const { data: categories = [] } = useCategories();
  const { data: profile } = useProfile();
  const [modal, setModal] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [filterOwner, setFilterOwner] = useState<"all" | string>("all");
  const balance = totals.income - totals.expenses;
  const filtered = filterOwner === "all" ? txs : txs.filter((t) => t.owner_user_id === filterOwner);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-theme">כספים</h2>
          <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="input-base text-sm mt-1" />
        </div>
        <button onClick={() => setModal(true)} className="bg-accent-600 hover:bg-accent-500 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors flex items-center gap-1.5">
          <Icon name="plus" className="w-3.5 h-3.5" /> הוסף תנועה
        </button>
      </div>
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-emerald-950/40 border border-emerald-800 rounded-xl p-4">
          <div className="text-xs text-emerald-400 font-medium uppercase tracking-wide mb-1">הכנסות</div>
          <div className="text-2xl font-bold text-emerald-300">₪{totals.income.toLocaleString("he-IL")}</div>
        </div>
        <div className="bg-red-950/40 border border-red-800 rounded-xl p-4">
          <div className="text-xs text-red-400 font-medium uppercase tracking-wide mb-1">הוצאות</div>
          <div className="text-2xl font-bold text-red-300">₪{totals.expenses.toLocaleString("he-IL")}</div>
        </div>
        <div className={"rounded-xl border p-4 " + (balance >= 0 ? "bg-emerald-950/40 border-emerald-800" : "bg-red-950/40 border-red-800")}>
          <div className="text-xs text-theme-muted font-medium uppercase tracking-wide mb-1">מאזן</div>
          <div className={"text-2xl font-bold " + (balance >= 0 ? "text-emerald-300" : "text-red-300")}>{balance >= 0 ? "+" : ""}₪{balance.toLocaleString("he-IL")}</div>
        </div>
      </div>
      <div className="flex items-center gap-2 mb-4">
        {["all", profile?.id].filter(Boolean).map((id) => (
          <button key={id} onClick={() => setFilterOwner(id as string)} className={"px-3 py-1.5 rounded-lg text-xs font-medium transition-colors " + (filterOwner === id ? "bg-slate-700 text-theme" : "bg-slate-900 border border-slate-800 text-theme-muted hover:text-theme")}>
            {id === "all" ? "הכל" : profile?.display_name ?? "אני"}
          </button>
        ))}
      </div>
      <div className="space-y-2">
        {filtered.map((tx) => (
          <div key={tx.id} className="flex items-center gap-3 bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 group">
            <div className={"w-2 h-2 rounded-full shrink-0 " + (tx.transaction_type === "income" ? "bg-emerald-500" : "bg-red-500")} />
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-theme">{tx.categories?.name ?? "ללא קטגוריה"}</div>
              {tx.notes && <div className="text-xs text-theme-muted truncate opacity-70">{tx.notes}</div>}
            </div>
            {tx.is_fixed && <span className="text-xs bg-slate-800 text-theme-muted px-2 py-0.5 rounded-full hidden sm:block">קבועה</span>}
            <span className="text-xs text-theme-muted hidden sm:block">{tx.transaction_date}</span>
            <span className={"font-semibold text-sm " + (tx.transaction_type === "income" ? "text-emerald-400" : "text-red-400")}>{tx.transaction_type === "income" ? "+" : "-"}₪{Number(tx.amount).toLocaleString("he-IL")}</span>
            <button onClick={() => setPendingDeleteId(tx.id)} className="text-slate-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity">
              <Icon name="trash" className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
        {filtered.length === 0 && <div className="text-center py-12 text-theme-muted">אין תנועות החודש. הוסף את הראשונה!</div>}
      </div>
      {modal && <AddTxModal categories={categories} profile={profile} onClose={() => setModal(false)} onSave={(data) => addTransaction.mutate(data)} />}

      {pendingDeleteId && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-2xl border border-slate-700 bg-slate-900 p-5">
            <div className="flex items-center gap-2 mb-1">
              <Icon name="warning" className="w-5 h-5 text-red-400" />
              <h3 className="text-base font-semibold text-theme">למחוק תנועה זו?</h3>
            </div>
            <p className="text-sm text-theme-muted mt-1">הפעולה אינה ניתנת לביטול.</p>
            <div className="flex justify-end gap-2 mt-4">
              <button onClick={() => setPendingDeleteId(null)} className="px-3 py-2 rounded-lg text-sm bg-slate-800 text-theme-muted hover:bg-slate-700">ביטול</button>
              <button
                onClick={() => {
                  deleteTransaction.mutate(pendingDeleteId);
                  setPendingDeleteId(null);
                }}
                className="px-3 py-2 rounded-lg text-sm bg-red-600 text-white hover:bg-red-500"
              >
                מחיקה
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
