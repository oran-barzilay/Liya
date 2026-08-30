import { useState } from "react";
import { useInventory } from "../hooks/useInventory";
import { useInventoryCategories } from "../hooks/useInventoryCategories";
import Icon from "../components/Icon";
type Item = Record<string, any>;
type Category = Record<string, any>;
const QUICK_CATEGORIES = ["פארם", "שתיה", "תבלינים", "פחמימות"] as const;

function normalizeItemName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}

function getStockState(item: Item): "low" | "threshold" | "ok" {
  const qty = Number(item.quantity);
  const threshold = Number(item.critical_threshold);
  if (qty < threshold) return "low";
  if (qty === threshold) return "threshold";
  return "ok";
}

function ItemModal({ item, defaultCategoryId, categories, existingNames, onClose, onSave }: {
  item?: Item;
  defaultCategoryId?: string | null;
  categories: Category[];
  existingNames: Set<string>;
  onClose: () => void;
  onSave: (d: Item) => void;
}) {
  const [name, setName] = useState(item?.name ?? "");
  const [unit, setUnit] = useState(item?.unit ?? "יחידות");
  const [qty, setQty] = useState(String(item?.quantity ?? 0));
  const [thr, setThr] = useState(String(item?.critical_threshold ?? 1));
  const [auto, setAuto] = useState<boolean>(item?.auto_restock_task ?? true);
  const [catId, setCatId] = useState(item?.category_id ?? defaultCategoryId ?? "");
  const [notes, setNotes] = useState(item?.notes ?? "");
  const [dupError, setDupError] = useState("");
  const normalizedName = normalizeItemName(name);
  const canSave = !!normalizedName && !existingNames.has(normalizedName);
  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <form onSubmit={(e) => {
        e.preventDefault();
        if (!canSave) {
          setDupError("כבר קיים פריט בשם הזה.");
          return;
        }
        onSave({ ...(item?.id ? { id: item.id } : {}), name, unit, quantity: Number(qty), critical_threshold: Number(thr), auto_restock_task: auto, category_id: catId || null, notes: notes || null });
        onClose();
      }} className="bg-slate-900 border border-slate-700 rounded-2xl p-5 w-full max-w-sm space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-theme">{item?.id ? "עריכת פריט" : "הוסף פריט"}</h3>
          <button type="button" onClick={onClose} className="text-theme-muted hover:text-theme"><Icon name="x" className="w-4 h-4" /></button>
        </div>
        <div>
          <label className="text-xs text-theme-muted block mb-1">שם *</label>
          <input
            required
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              if (dupError) setDupError("");
            }}
            className="input-base w-full"
            placeholder="חיתולים"
          />
          {dupError && <p className="text-xs text-red-400 mt-1">{dupError}</p>}
          {!dupError && normalizedName && existingNames.has(normalizedName) && (
            <p className="text-xs text-red-400 mt-1">כבר קיים פריט בשם הזה.</p>
          )}
        </div>
        <div>
          <label className="text-xs text-theme-muted block mb-1">קטגוריה</label>
          <select value={catId} onChange={(e)=>setCatId(e.target.value)} className="input-base w-full">
            <option value="">ללא קטגוריה</option>
            {categories.map((c)=><option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div><label className="text-xs text-theme-muted block mb-1">כמות</label>
            <input type="number" min="0" step="0.5" value={qty} onChange={(e)=>setQty(e.target.value)} className="input-base w-full" /></div>
          <div><label className="text-xs text-theme-muted block mb-1">יחידה</label>
            <input value={unit} onChange={(e)=>setUnit(e.target.value)} className="input-base w-full" /></div>
        </div>
        <div>
          <label className="text-xs text-theme-muted block mb-1">סף התראה</label>
          <input type="number" min="0" step="0.5" value={thr} onChange={(e)=>setThr(e.target.value)} className="input-base w-full" />
          <p className="text-xs text-theme-muted mt-1 opacity-70">משימת רכישה תיווצר כשהכמות נמוכה מהסף.</p>
        </div>
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={auto} onChange={(e)=>setAuto(e.target.checked)} />
          <span className="text-sm text-theme-muted">יצירת משימת רכישה אוטומטית</span>
        </label>
        <div><label className="text-xs text-theme-muted block mb-1">הערות</label>
          <input value={notes} onChange={(e)=>setNotes(e.target.value)} className="input-base w-full" placeholder="אופציונלי" /></div>
        <button
          type="submit"
          disabled={!canSave}
          className="w-full bg-accent-600 hover:bg-accent-500 disabled:opacity-50 text-white font-medium py-2 rounded-lg text-sm"
        >
          {item?.id ? "שמור" : "הוסף פריט"}
        </button>
      </form>
    </div>
  );
}
function ItemRow({ item, onEdit, onDelete, onUpdate, categoryName }: {
  item: Item; onEdit: (i: Item) => void; onDelete: (i: Item) => void; onUpdate: (i: Item) => void;
  categoryName?: string;
}) {
  const [editingQty, setEditingQty] = useState(false);
  const [localQty, setLocalQty] = useState(Number(item.quantity));
  const low = Number(item.quantity) < Number(item.critical_threshold);
  const pct = item.critical_threshold === 0 ? 100 : Math.min(100, Math.round((Number(item.quantity) / (Number(item.critical_threshold) * 3)) * 100));
  const changeQty = (newQty: number) => {
    const clamped = Math.max(0, newQty);
    setLocalQty(clamped);
    onUpdate({ ...item, quantity: clamped });
  };
  return (
    <div className={"flex items-center gap-2 px-3 py-2 border-b border-slate-800 hover:bg-slate-800/30 transition-colors " + (low ? "bg-red-950/10" : "")}>
      {/* Name */}
      <div className="flex-1 min-w-0">
        <span className={"text-sm font-medium " + (low ? "text-red-300" : "text-theme")}>{item.name}</span>
        {low && <span className="text-xs text-red-400 mr-1.5">מלאי נמוך</span>}
      </div>
      {/* Category badge – shown only in flat view */}
      {categoryName !== undefined && (
        <span className="hidden sm:inline-flex items-center text-xs px-2 py-0.5 rounded-full bg-slate-800 text-theme-muted border border-slate-700 shrink-0 max-w-[8rem] truncate">
          {categoryName}
        </span>
      )}
      {/* Quantity controls */}
      <div className="flex items-center gap-1">
        <button onClick={() => changeQty(localQty - 1)}
          className="w-6 h-6 rounded bg-slate-800 hover:bg-slate-700 flex items-center justify-center text-theme-muted hover:text-theme transition-colors">
          <Icon name="minus" className="w-3 h-3" />
        </button>
        {editingQty ? (
          <input
            type="number" value={localQty} min="0" step="0.5"
            onChange={(e) => setLocalQty(Number(e.target.value))}
            onBlur={() => { changeQty(localQty); setEditingQty(false); }}
            onKeyDown={(e) => { if (e.key === "Enter") { changeQty(localQty); setEditingQty(false); } }}
            className="input-base w-16 text-center text-sm py-0.5 px-1"
            autoFocus
          />
        ) : (
          <button onClick={() => setEditingQty(true)}
            className="text-sm font-medium min-w-14 text-center hover:bg-slate-800 rounded py-0.5 px-1 text-theme">
            {Number(item.quantity)} {item.unit}
          </button>
        )}
        <button onClick={() => changeQty(localQty + 1)}
          className="w-6 h-6 rounded bg-slate-800 hover:bg-slate-700 flex items-center justify-center text-theme-muted hover:text-theme transition-colors">
          <Icon name="plus" className="w-3 h-3" />
        </button>
      </div>
      {/* Threshold */}
      <span className="text-xs text-theme-muted hidden sm:block w-20 text-center">מינ': {item.critical_threshold} {item.unit}</span>
      {/* Progress dot */}
      <div className={"w-2 h-2 rounded-full shrink-0 " + (low ? "bg-red-500" : pct < 50 ? "bg-amber-500" : "bg-emerald-500")} />
      {/* Actions */}
      <button onClick={() => onEdit(item)} className="text-theme-muted hover:text-accent-400 transition-colors p-0.5"><Icon name="edit" className="w-3.5 h-3.5" /></button>
      <button onClick={() => onDelete(item)} className="text-theme-muted hover:text-red-400 transition-colors p-0.5"><Icon name="trash" className="w-3.5 h-3.5" /></button>
    </div>
  );
}
function InlineAddTrigger({
  categoryId,
  onOpen,
}: {
  categoryId: string | null;
  onOpen: (categoryId: string | null) => void;
}) {
  return (
    <div className="px-3 py-2 border-t border-slate-800 bg-slate-900/50 flex justify-end">
      <button
        type="button"
        onClick={() => onOpen(categoryId)}
        className="bg-accent-600 hover:bg-accent-500 text-white text-xs px-2.5 py-1.5 rounded-lg flex items-center gap-1"
        title="הוסף פריט"
      >
        <Icon name="plus" className="w-3.5 h-3.5" />
        הוספה
      </button>
    </div>
  );
}
export default function Inventory() {
  const { data: items = [], upsertItem, deleteItem } = useInventory();
  const { data: categories = [], addCategory, deleteCategory } = useInventoryCategories();
  const [modal, setModal] = useState<{ open: boolean; item?: Item; defaultCategoryId?: string | null }>({ open: false });
  const [pendingDelete, setPendingDelete] = useState<Item | null>(null);
  const [pendingDeleteCat, setPendingDeleteCat] = useState<Category | null>(null);
  const [search, setSearch] = useState("");
  const [showCatMgmt, setShowCatMgmt] = useState(false);
  const [newCatName, setNewCatName] = useState("");
  const [collapsedCats, setCollapsedCats] = useState<Set<string>>(new Set());
  const [stockFilter, setStockFilter] = useState<"all" | "low" | "threshold">("all");
  const [sortMode, setSortMode] = useState<"name" | "low_first" | "threshold_first">("name");
  const [viewMode, setViewMode] = useState<"grouped" | "flat">("grouped");
  const [saveError, setSaveError] = useState("");

  const normalizedSearch = search.trim().toLowerCase();
  const editingItemId = modal.item?.id;
  const existingNames = new Set(
    items
      .filter((i) => !editingItemId || i.id !== editingItemId)
      .map((i) => normalizeItemName(String(i.name ?? "")))
  );

  const applyStockFilter = (item: Item) => {
    const state = getStockState(item);
    if (stockFilter === "all") return true;
    if (stockFilter === "low") return state === "low";
    return state === "threshold";
  };

  const sortItems = (a: Item, b: Item) => {
    if (sortMode === "name") {
      return String(a.name ?? "").localeCompare(String(b.name ?? ""), "he");
    }
    if (sortMode === "low_first") {
      const rank = { low: 0, threshold: 1, ok: 2 } as const;
      const diff = rank[getStockState(a)] - rank[getStockState(b)];
      return diff !== 0 ? diff : String(a.name ?? "").localeCompare(String(b.name ?? ""), "he");
    }
    const rank = { threshold: 0, low: 1, ok: 2 } as const;
    const diff = rank[getStockState(a)] - rank[getStockState(b)];
    return diff !== 0 ? diff : String(a.name ?? "").localeCompare(String(b.name ?? ""), "he");
  };

  const filtered = items
    .filter((i) => String(i.name ?? "").toLowerCase().includes(normalizedSearch))
    .filter(applyStockFilter)
    .sort(sortItems);

  const lowStock = items.filter((i) => getStockState(i) === "low");

  // Group items by category
  const grouped: { cat: Category | null; items: Item[] }[] = [];
  categories.forEach((cat) => {
    const catItems = filtered.filter((i) => i.category_id === cat.id);
    if (catItems.length > 0) grouped.push({ cat, items: catItems });
  });
  const uncategorized = filtered.filter((i) => !i.category_id);
  if (uncategorized.length > 0) grouped.push({ cat: null, items: uncategorized });
  const isSearchActive = normalizedSearch.length > 0;
  const toggleCollapse = (catId: string) => {
    setCollapsedCats((prev) => {
      const next = new Set(prev);
      if (next.has(catId)) next.delete(catId); else next.add(catId);
      return next;
    });
  };
  const saveItem = (data: Item) => {
    setSaveError("");
    upsertItem.mutate(data, {
      onError: (err: unknown) => {
        const msg = err && typeof err === "object" && "message" in err ? String((err as { message?: string }).message) : "שגיאה בשמירת פריט";
        if (msg.toLowerCase().includes("duplicate") || msg.includes("unique")) {
          setSaveError("לא ניתן לשמור פריט פעמיים. השם כבר קיים.");
          return;
        }
        setSaveError(msg);
      },
    });
  };
  const addQuickCategories = () => {
    const existing = new Set(categories.map((c) => String(c.name ?? "").trim()));
    QUICK_CATEGORIES.forEach((name) => {
      if (!existing.has(name)) addCategory.mutate(name);
    });
  };

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2 mb-5">
        <div>
          <h2 className="text-2xl font-bold text-theme">קניות ומלאי</h2>
          <p className="text-theme-muted text-sm mt-0.5">
            {items.length} מוצרים במעקב · <span className="text-red-400">{lowStock.length} חסרים לקנייה</span>
          </p>
        </div>
        <div className="flex flex-wrap gap-2 w-full sm:w-auto">
          <button
            onClick={() => setViewMode((prev) => prev === "grouped" ? "flat" : "grouped")}
            className="text-sm font-medium px-3 py-2 rounded-lg bg-slate-900 border border-slate-800 text-theme-muted hover:text-theme flex items-center gap-1.5"
          >
            <Icon name={viewMode === "grouped" ? "layers" : "grid"} className="w-3.5 h-3.5" />
            {viewMode === "grouped" ? "תצוגה מלאה" : "לפי קטגוריות"}
          </button>
          <button onClick={() => setShowCatMgmt(!showCatMgmt)}
            className={"text-sm font-medium px-3 py-2 rounded-lg transition-colors flex items-center gap-1.5 " +
              (showCatMgmt ? "bg-accent-700 text-white" : "bg-slate-900 border border-slate-800 text-theme-muted hover:text-theme")}>
            <Icon name="tag" className="w-3.5 h-3.5" /> קטגוריות
          </button>
          <button onClick={() => setModal({ open: true })}
            className="w-full sm:w-auto bg-accent-600 hover:bg-accent-500 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors flex items-center justify-center gap-1.5">
            <Icon name="plus" className="w-3.5 h-3.5" /> הוסף מוצר
          </button>
        </div>
      </div>
      <div className="mb-5 rounded-2xl border border-slate-800 bg-slate-900 px-4 py-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h3 className="text-sm font-semibold text-theme">רשימת הקניות של הבית</h3>
          <p className="text-xs text-theme-muted mt-1">כאן מרכזים חוסרים ומוצרים לקנייה, כדי לא להעמיס על מסך המשימות הרגיל.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setStockFilter("low")}
            className={"px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border " +
              (stockFilter === "low"
                ? "bg-red-700 border-red-600 text-white"
                : "bg-slate-800 border-slate-700 text-theme-muted hover:text-theme")}
          >
            לקניות עכשיו
          </button>
          <button
            type="button"
            onClick={() => setStockFilter("all")}
            className={"px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border " +
              (stockFilter === "all"
                ? "bg-accent-700 border-accent-600 text-white"
                : "bg-slate-800 border-slate-700 text-theme-muted hover:text-theme")}
          >
            כל המוצרים
          </button>
        </div>
      </div>


      {/* Category management */}
      {showCatMgmt && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 mb-5">
          <h3 className="text-sm font-semibold text-theme mb-3 flex items-center gap-2">
            <Icon name="tag" className="w-4 h-4 text-accent-400" /> ניהול קטגוריות
          </h3>
          <div className="flex flex-wrap gap-2 mb-3">
            {categories.map((cat) => (
              <div key={cat.id} className="flex items-center gap-1.5 bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5">
                <span className="text-sm text-theme">{cat.name}</span>
                {!cat.is_system && (
                  <button onClick={() => setPendingDeleteCat(cat)} className="text-slate-600 hover:text-red-400 ml-1">
                    <Icon name="x" className="w-3 h-3" />
                  </button>
                )}
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <input value={newCatName} onChange={(e) => setNewCatName(e.target.value)}
              placeholder="שם קטגוריה חדשה" className="input-base flex-1 text-sm" />
            <button disabled={!newCatName.trim()}
              onClick={() => { addCategory.mutate(newCatName.trim()); setNewCatName(""); }}
              className="bg-accent-600 hover:bg-accent-500 disabled:opacity-40 text-white text-sm px-3 py-2 rounded-lg flex items-center gap-1.5">
              <Icon name="plus" className="w-3.5 h-3.5" /> הוסף
            </button>
            <button
              type="button"
              onClick={addQuickCategories}
              className="bg-slate-800 hover:bg-slate-700 text-theme text-sm px-3 py-2 rounded-lg"
            >
              הוספת ברירת מחדל
            </button>
          </div>
          <p className="text-xs text-theme-muted mt-2 opacity-75">ברירת מחדל: {QUICK_CATEGORIES.join(" · ")}</p>
        </div>
      )}
      <div className="flex flex-wrap gap-2 mb-5">
        <div className="relative min-w-0 flex-1 sm:max-w-sm">
          <Icon name="search" className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-theme-muted pointer-events-none" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="חפש פריטים..." className="input-base w-full pr-9" />
        </div>
        <select value={stockFilter} onChange={(e) => setStockFilter(e.target.value as "all" | "low" | "threshold")} className="input-base text-sm flex-1 sm:flex-none">
          <option value="all">כל הפריטים</option>
          <option value="low">מלאי נמוך</option>
          <option value="threshold">על הסף</option>
        </select>
        <select value={sortMode} onChange={(e) => setSortMode(e.target.value as "name" | "low_first" | "threshold_first")} className="input-base text-sm flex-1 sm:flex-none">
          <option value="name">מיון לפי שם</option>
          <option value="low_first">נמוך קודם</option>
          <option value="threshold_first">על הסף קודם</option>
        </select>
      </div>
      {saveError && (
        <div className="mb-4 text-xs text-red-300 bg-red-950/40 border border-red-800 rounded-lg px-3 py-2">{saveError}</div>
      )}
      {filtered.length === 0 && <div className="text-center py-16 text-theme-muted">אין פריטים עדיין. הוסף את הראשון.</div>}
      {viewMode === "grouped" && grouped.map(({ cat, items: groupItems }) => {
        const catKey = cat?.id ?? "__uncategorized__";
        const forceOpen = isSearchActive && groupItems.length > 0;
        const collapsed = forceOpen ? false : collapsedCats.has(catKey);
        const groupLow = groupItems.filter((i) => getStockState(i) === "low").length;
        const groupThreshold = groupItems.filter((i) => getStockState(i) === "threshold").length;
        return (
          <div key={catKey} className="mb-3">
            <button
              onClick={() => toggleCollapse(catKey)}
              className="w-full flex items-center gap-2 px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl hover:bg-slate-800/50 transition-colors">
              <Icon name={collapsed ? "chevron-left" : "chevron-down"} className="w-4 h-4 text-theme-muted" />
              <span className="text-sm font-semibold text-theme">{cat?.name ?? "ללא קטגוריה"}</span>
              <span className="text-xs text-theme-muted">({groupItems.length} פריטים)</span>
              {groupLow > 0 && <span className="text-xs text-red-400 mr-1">{groupLow} מלאי נמוך</span>}
              {groupThreshold > 0 && <span className="text-xs text-amber-400">{groupThreshold} על הסף</span>}
            </button>
            {!collapsed && (
              <div className="border border-t-0 border-slate-800 rounded-b-xl overflow-hidden">
                {groupItems.map((item) => (
                  <ItemRow key={item.id} item={item}
                    onEdit={(i) => setModal({ open: true, item: i })}
                    onDelete={(i) => setPendingDelete(i)}
                    onUpdate={(updated) => upsertItem.mutate(updated)} />
                ))}
                <InlineAddTrigger
                  categoryId={cat?.id ?? null}
                  onOpen={(categoryId) => setModal({ open: true, defaultCategoryId: categoryId })}
                />
              </div>
            )}
          </div>
        );
      })}
      {viewMode === "flat" && filtered.length > 0 && (
        <div className="border border-slate-800 rounded-xl overflow-hidden">
          {/* Header row */}
          <div className="flex items-center gap-2 px-3 py-2 bg-slate-900 border-b border-slate-800 text-xs text-theme-muted font-semibold select-none">
            <span className="flex-1">שם פריט</span>
            <span className="hidden md:block w-32 text-center">קטגוריה</span>
            <span className="w-24 sm:w-32 text-center">כמות</span>
            <span className="hidden sm:block w-20 text-center">סף</span>
            <span className="w-2" />
            <span className="w-12" />
          </div>
          {filtered.map((item) => {
            const cat = categories.find((c) => c.id === item.category_id);
            return (
              <ItemRow
                key={item.id}
                item={item}
                categoryName={cat?.name ?? "ללא קטגוריה"}
                onEdit={(i) => setModal({ open: true, item: i })}
                onDelete={(i) => setPendingDelete(i)}
                onUpdate={(updated) => upsertItem.mutate(updated)}
              />
            );
          })}
        </div>
      )}
      {modal.open && (
        <ItemModal
          item={modal.item}
          defaultCategoryId={modal.defaultCategoryId}
          categories={categories}
          existingNames={existingNames}
          onClose={() => setModal({ open: false })}
          onSave={saveItem}
        />
      )}
      {/* Delete item confirm */}
      {pendingDelete && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-2xl border border-slate-700 bg-slate-900 p-5">
            <div className="flex items-center gap-2 mb-1"><Icon name="warning" className="w-5 h-5 text-red-400" /><h3 className="text-base font-semibold text-theme">למחוק פריט זה?</h3></div>
            <p className="text-sm text-theme-muted mt-1">הפעולה אינה ניתנת לביטול.</p>
            <div className="flex justify-end gap-2 mt-4">
              <button onClick={() => setPendingDelete(null)} className="px-3 py-2 rounded-lg text-sm bg-slate-800 text-theme-muted hover:bg-slate-700">ביטול</button>
              <button onClick={() => { deleteItem.mutate(pendingDelete.id); setPendingDelete(null); }} className="px-3 py-2 rounded-lg text-sm bg-red-600 text-white hover:bg-red-500">מחיקה</button>
            </div>
          </div>
        </div>
      )}
      {/* Delete category confirm */}
      {pendingDeleteCat && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-2xl border border-slate-700 bg-slate-900 p-5">
            <div className="flex items-center gap-2 mb-1"><Icon name="warning" className="w-5 h-5 text-red-400" /><h3 className="text-base font-semibold text-theme">למחוק קטגוריה "{pendingDeleteCat.name}"?</h3></div>
            <p className="text-sm text-theme-muted mt-1">הפריטים בקטגוריה זו לא יימחקו, אלא יופרדו ממנה.</p>
            <div className="flex justify-end gap-2 mt-4">
              <button onClick={() => setPendingDeleteCat(null)} className="px-3 py-2 rounded-lg text-sm bg-slate-800 text-theme-muted hover:bg-slate-700">ביטול</button>
              <button onClick={() => { deleteCategory.mutate(pendingDeleteCat.id); setPendingDeleteCat(null); }} className="px-3 py-2 rounded-lg text-sm bg-red-600 text-white hover:bg-red-500">מחיקה</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
