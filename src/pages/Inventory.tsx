import { useState } from "react";
import { useInventory } from "../hooks/useInventory";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Item = Record<string, any>;
function ItemModal({ item, onClose, onSave }: { item?: Item; onClose: () => void; onSave: (d: Item) => void }) {
  const [name, setName] = useState(item?.name ?? "");
  const [unit, setUnit] = useState(item?.unit ?? "pcs");
  const [qty, setQty] = useState(String(item?.quantity ?? 0));
  const [thr, setThr] = useState(String(item?.critical_threshold ?? 1));
  const [auto, setAuto] = useState<boolean>(item?.auto_restock_task ?? true);
  const [notes, setNotes] = useState(item?.notes ?? "");
  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <form
        onSubmit={e => {
          e.preventDefault();
          onSave({ ...(item?.id ? { id: item.id } : {}), name, unit, quantity: Number(qty), critical_threshold: Number(thr), auto_restock_task: auto, notes: notes || null });
          onClose();
        }}
        className="bg-slate-900 border border-slate-700 rounded-2xl p-5 w-full max-w-sm space-y-4"
      >
        <div className="flex items-center justify-between">
          <h3 className="font-semibold">{item ? "Edit" : "Add"} item</h3>
          <button type="button" onClick={onClose} className="text-slate-500 hover:text-white">x</button>
        </div>
        <div><label className="text-xs text-slate-400 block mb-1">Name *</label><input required value={name} onChange={e => setName(e.target.value)} className="input-base w-full" placeholder="Diapers" /></div>
        <div className="grid grid-cols-2 gap-3">
          <div><label className="text-xs text-slate-400 block mb-1">Quantity</label><input type="number" min="0" step="0.5" value={qty} onChange={e => setQty(e.target.value)} className="input-base w-full" /></div>
          <div><label className="text-xs text-slate-400 block mb-1">Unit</label><input value={unit} onChange={e => setUnit(e.target.value)} className="input-base w-full" /></div>
        </div>
        <div>
          <label className="text-xs text-slate-400 block mb-1">Low stock threshold</label>
          <input type="number" min="0" step="0.5" value={thr} onChange={e => setThr(e.target.value)} className="input-base w-full" />
          <p className="text-xs text-slate-500 mt-1">Auto Buy task fires below this.</p>
        </div>
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={auto} onChange={e => setAuto(e.target.checked)} />
          <span className="text-sm text-slate-300">Auto-create restock task</span>
        </label>
        <div><label className="text-xs text-slate-400 block mb-1">Notes</label><input value={notes} onChange={e => setNotes(e.target.value)} className="input-base w-full" placeholder="Optional" /></div>
        <button type="submit" className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-medium py-2 rounded-lg text-sm transition-colors">{item ? "Save" : "Add item"}</button>
      </form>
    </div>
  );
}
export default function Inventory() {
  const { data: items = [], upsertItem, deleteItem } = useInventory();
  const [modal, setModal] = useState<{ open: boolean; item?: Item }>({ open: false });
  const [search, setSearch] = useState("");
  const filtered = items.filter(i => i.name.toLowerCase().includes(search.toLowerCase()));
  const lowStock = filtered.filter(i => Number(i.quantity) < Number(i.critical_threshold));
  const normal = filtered.filter(i => Number(i.quantity) >= Number(i.critical_threshold));
  const Card = ({ item }: { item: Item }) => {
    const low = Number(item.quantity) < Number(item.critical_threshold);
    const pct = item.critical_threshold === 0 ? 100 : Math.min(100, Math.round((Number(item.quantity) / (Number(item.critical_threshold) * 3)) * 100));
    return (
      <div className={"bg-slate-900 border rounded-xl p-4 group " + (low ? "border-red-800" : "border-slate-800")}>
        <div className="flex items-start justify-between mb-2">
          <div>
            <div className="font-medium text-sm">{item.name}</div>
            {low && <span className="text-xs text-red-400">Low stock</span>}
          </div>
          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <button onClick={() => setModal({ open: true, item })} className="text-xs text-slate-500 hover:text-indigo-400 px-1">edit</button>
            <button onClick={() => { if (window.confirm("Delete?")) deleteItem.mutate(item.id); }} className="text-xs text-slate-500 hover:text-red-400 px-1">del</button>
          </div>
        </div>
        <div className="text-2xl font-bold">{item.quantity} <span className="text-sm font-normal text-slate-400">{item.unit}</span></div>
        <div className="text-xs text-slate-500 mt-0.5">Min: {item.critical_threshold} {item.unit}</div>
        <div className="mt-3 h-1.5 rounded-full bg-slate-800 overflow-hidden">
          <div className={"h-full rounded-full " + (low ? "bg-red-500" : pct < 50 ? "bg-amber-500" : "bg-emerald-500")} style={{ width: pct + "%" }} />
        </div>
        {item.notes && <p className="text-xs text-slate-500 mt-2">{item.notes}</p>}
      </div>
    );
  };
  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold">Inventory</h2>
          <p className="text-slate-400 text-sm mt-0.5">{items.length} items - {lowStock.length} low stock</p>
        </div>
        <button onClick={() => setModal({ open: true })} className="bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors">+ Add item</button>
      </div>
      <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search items..." className="input-base w-full max-w-xs mb-5" />
      {lowStock.length > 0 && (
        <div className="mb-6">
          <h3 className="text-xs font-semibold text-red-400 mb-3 uppercase tracking-wide">Low stock</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">{lowStock.map(i => <Card key={i.id} item={i} />)}</div>
        </div>
      )}
      {normal.length > 0 && (
        <div>
          <h3 className="text-xs font-semibold text-slate-400 mb-3 uppercase tracking-wide">In stock</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">{normal.map(i => <Card key={i.id} item={i} />)}</div>
        </div>
      )}
      {filtered.length === 0 && <div className="text-center py-16 text-slate-500">No items yet. Add your first!</div>}
      {modal.open && <ItemModal item={modal.item} onClose={() => setModal({ open: false })} onSave={data => upsertItem.mutate(data)} />}
    </div>
  );
}
