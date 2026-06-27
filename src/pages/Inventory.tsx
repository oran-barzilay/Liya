import { useState } from "react";
import { useInventory } from "../hooks/useInventory";
import Icon from "../components/Icon";

type Item = Record<string, any>;

function ItemModal({ item, onClose, onSave }: { item?: Item; onClose: () => void; onSave: (d: Item) => void }) {
  const [name, setName] = useState(item?.name ?? "");
  const [unit, setUnit] = useState(item?.unit ?? "יחידות");
  const [qty, setQty] = useState(String(item?.quantity ?? 0));
  const [thr, setThr] = useState(String(item?.critical_threshold ?? 1));
  const [auto, setAuto] = useState<boolean>(item?.auto_restock_task ?? true);
  const [notes, setNotes] = useState(item?.notes ?? "");

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSave({
            ...(item?.id ? { id: item.id } : {}),
            name,
            unit,
            quantity: Number(qty),
            critical_threshold: Number(thr),
            auto_restock_task: auto,
            notes: notes || null,
          });
          onClose();
        }}
        className="bg-slate-900 border border-slate-700 rounded-2xl p-5 w-full max-w-sm space-y-4"
      >
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-theme">{item ? "עריכת פריט" : "הוסף פריט"}</h3>
          <button type="button" onClick={onClose} className="text-theme-muted hover:text-theme">
            <Icon name="x" className="w-4 h-4" />
          </button>
        </div>
        <div>
          <label className="text-xs text-theme-muted block mb-1">שם *</label>
          <input required value={name} onChange={(e) => setName(e.target.value)} className="input-base w-full" placeholder="חיתולים" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-theme-muted block mb-1">כמות</label>
            <input type="number" min="0" step="0.5" value={qty} onChange={(e) => setQty(e.target.value)} className="input-base w-full" />
          </div>
          <div>
            <label className="text-xs text-theme-muted block mb-1">יחידה</label>
            <input value={unit} onChange={(e) => setUnit(e.target.value)} className="input-base w-full" />
          </div>
        </div>
        <div>
          <label className="text-xs text-theme-muted block mb-1">סף התראה</label>
          <input type="number" min="0" step="0.5" value={thr} onChange={(e) => setThr(e.target.value)} className="input-base w-full" />
          <p className="text-xs text-theme-muted mt-1 opacity-70">משימת רכישה תיווצר אוטומטית כשהכמות נמוכה מהסף.</p>
        </div>
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={auto} onChange={(e) => setAuto(e.target.checked)} />
          <span className="text-sm text-theme-muted">יצירת משימת רכישה אוטומטית</span>
        </label>
        <div>
          <label className="text-xs text-theme-muted block mb-1">הערות</label>
          <input value={notes} onChange={(e) => setNotes(e.target.value)} className="input-base w-full" placeholder="אופציונלי" />
        </div>
        <button type="submit" className="w-full bg-accent-600 hover:bg-accent-500 text-white font-medium py-2 rounded-lg text-sm transition-colors">
          {item ? "שמור" : "הוסף פריט"}
        </button>
      </form>
    </div>
  );
}

export default function Inventory() {
  const { data: items = [], upsertItem, deleteItem } = useInventory();
  const [modal, setModal] = useState<{ open: boolean; item?: Item }>({ open: false });
  const [pendingDelete, setPendingDelete] = useState<Item | null>(null);
  const [search, setSearch] = useState("");

  const filtered = items.filter((i) => i.name.toLowerCase().includes(search.toLowerCase()));
  const lowStock = filtered.filter((i) => Number(i.quantity) < Number(i.critical_threshold));
  const normal = filtered.filter((i) => Number(i.quantity) >= Number(i.critical_threshold));

  const Card = ({ item }: { item: Item }) => {
    const low = Number(item.quantity) < Number(item.critical_threshold);
    const pct =
      item.critical_threshold === 0
        ? 100
        : Math.min(100, Math.round((Number(item.quantity) / (Number(item.critical_threshold) * 3)) * 100));

    return (
      <div className={"bg-slate-900 border rounded-xl p-4 group " + (low ? "border-red-800" : "border-slate-800")}>
        <div className="flex items-start justify-between mb-2">
          <div>
            <div className="font-medium text-sm text-theme">{item.name}</div>
            {low && <span className="text-xs text-red-400">מלאי נמוך</span>}
          </div>
          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <button onClick={() => setModal({ open: true, item })} className="text-theme-muted hover:text-accent-400 px-1">
              <Icon name="edit" className="w-3.5 h-3.5" />
            </button>
            <button onClick={() => setPendingDelete(item)} className="text-theme-muted hover:text-red-400 px-1">
              <Icon name="trash" className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
        <div className="text-2xl font-bold text-theme">
          {item.quantity} <span className="text-sm font-normal text-theme-muted">{item.unit}</span>
        </div>
        <div className="text-xs text-theme-muted mt-0.5 opacity-70">
          מינ': {item.critical_threshold} {item.unit}
        </div>
        <div className="mt-3 h-1.5 rounded-full bg-slate-800 overflow-hidden">
          <div className={"h-full rounded-full " + (low ? "bg-red-500" : pct < 50 ? "bg-amber-500" : "bg-emerald-500")} style={{ width: pct + "%" }} />
        </div>
        {item.notes && <p className="text-xs text-theme-muted mt-2 opacity-70">{item.notes}</p>}
      </div>
    );
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-theme">מלאי</h2>
          <p className="text-theme-muted text-sm mt-0.5">
            {items.length} פריטים · {lowStock.length} מלאי נמוך
          </p>
        </div>
        <button onClick={() => setModal({ open: true })} className="bg-accent-600 hover:bg-accent-500 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors flex items-center gap-1.5">
          <Icon name="plus" className="w-3.5 h-3.5" /> הוסף פריט
        </button>
      </div>

      <div className="relative max-w-xs mb-5">
        <Icon name="search" className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-theme-muted pointer-events-none" />
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="חפש פריטים..." className="input-base w-full pr-9" />
      </div>

      {lowStock.length > 0 && (
        <div className="mb-6">
          <h3 className="text-xs font-semibold text-red-400 mb-3 uppercase tracking-wide flex items-center gap-1.5">
            <Icon name="alert" className="w-3.5 h-3.5" /> מלאי נמוך
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">{lowStock.map((i) => <Card key={i.id} item={i} />)}</div>
        </div>
      )}

      {normal.length > 0 && (
        <div>
          <h3 className="text-xs font-semibold text-theme-muted mb-3 uppercase tracking-wide flex items-center gap-1.5">
            <Icon name="package" className="w-3.5 h-3.5" /> במלאי
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">{normal.map((i) => <Card key={i.id} item={i} />)}</div>
        </div>
      )}

      {filtered.length === 0 && <div className="text-center py-16 text-theme-muted">אין פריטים עדיין. הוסף את הראשון.</div>}
      {modal.open && <ItemModal item={modal.item} onClose={() => setModal({ open: false })} onSave={(data) => upsertItem.mutate(data)} />}

      {pendingDelete && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-2xl border border-slate-700 bg-slate-900 p-5">
            <div className="flex items-center gap-2 mb-1">
              <Icon name="warning" className="w-5 h-5 text-red-400" />
              <h3 className="text-base font-semibold text-theme">למחוק פריט זה?</h3>
            </div>
            <p className="text-sm text-theme-muted mt-1">הפעולה אינה ניתנת לביטול.</p>
            <div className="flex justify-end gap-2 mt-4">
              <button onClick={() => setPendingDelete(null)} className="px-3 py-2 rounded-lg text-sm bg-slate-800 text-theme-muted hover:bg-slate-700">
                ביטול
              </button>
              <button
                onClick={() => {
                  deleteItem.mutate(pendingDelete.id);
                  setPendingDelete(null);
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
