import { useState } from "react";
import { useChildren, useBabyLogs, useAppointments } from "../hooks/useBaby";
import { supabase } from "../lib/supabase";
import { useProfile } from "../hooks/useProfile";
import { useQueryClient } from "@tanstack/react-query";
type Row = Record<string, any>;
const LOG_ICONS: Record<string, string> = { feeding: "🍼", diaper_change: "👶", sleep: "😴", note: "📝" };
const LOG_LABELS: Record<string, string> = { feeding: "האכלה", diaper_change: "החלפת חיתול", sleep: "שינה", note: "הערה" };
function AddChildModal({ householdId, onClose, onDone }: { householdId: string; onClose: () => void; onDone: () => void }) {
  const [name, setName] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [loading, setLoading] = useState(false);
  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <form onSubmit={async e => { e.preventDefault(); setLoading(true); await supabase.from("children").insert({ household_id: householdId, name, birth_date: birthDate }); onDone(); onClose(); setLoading(false); }}
        className="bg-slate-900 border border-slate-700 rounded-2xl p-5 w-full max-w-xs space-y-4">
        <div className="flex items-center justify-between"><h3 className="font-semibold">הוסף תינוק/ת</h3><button type="button" onClick={onClose} className="text-slate-500 hover:text-white">✕</button></div>
        <div><label className="text-xs text-slate-400 block mb-1">שם *</label><input required value={name} onChange={e => setName(e.target.value)} className="input-base w-full" placeholder="לילה" /></div>
        <div><label className="text-xs text-slate-400 block mb-1">תאריך לידה *</label><input type="date" required value={birthDate} onChange={e => setBirthDate(e.target.value)} className="input-base w-full" /></div>
        <button type="submit" disabled={loading} className="w-full bg-accent-600 hover:bg-accent-500 text-white font-medium py-2 rounded-lg text-sm transition-colors">הוסף</button>
      </form>
    </div>
  );
}
function AddApptModal({ children, onClose, onSave }: { children: Row[]; onClose: () => void; onSave: (a: Row) => void }) {
  const [title, setTitle] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [childId, setChildId] = useState(children[0]?.id ?? "");
  const [provider, setProvider] = useState("");
  const [loc, setLoc] = useState("");
  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <form onSubmit={e => { e.preventDefault(); onSave({ title, starts_at: startsAt, child_id: childId || null, provider_name: provider || null, location: loc || null, status: "scheduled" }); onClose(); }}
        className="bg-slate-900 border border-slate-700 rounded-2xl p-5 w-full max-w-sm space-y-4">
        <div className="flex items-center justify-between"><h3 className="font-semibold">תור חדש</h3><button type="button" onClick={onClose} className="text-slate-500 hover:text-white">✕</button></div>
        <div><label className="text-xs text-slate-400 block mb-1">כותרת *</label><input required value={title} onChange={e => setTitle(e.target.value)} className="input-base w-full" placeholder="ביקור רופא" /></div>
        <div><label className="text-xs text-slate-400 block mb-1">תאריך ושעה *</label><input type="datetime-local" required value={startsAt} onChange={e => setStartsAt(e.target.value)} className="input-base w-full" /></div>
        {children.length > 0 && (
          <div><label className="text-xs text-slate-400 block mb-1">תינוק/ת</label>
            <select value={childId} onChange={e => setChildId(e.target.value)} className="input-base w-full">
              <option value="">— כללי —</option>
              {children.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
        )}
        <div><label className="text-xs text-slate-400 block mb-1">רופא / מטפל</label><input value={provider} onChange={e => setProvider(e.target.value)} className="input-base w-full" placeholder="ד״ר כהן" /></div>
        <div><label className="text-xs text-slate-400 block mb-1">מיקום</label><input value={loc} onChange={e => setLoc(e.target.value)} className="input-base w-full" placeholder="כתובת הקליניקה" /></div>
        <button type="submit" className="w-full bg-accent-600 hover:bg-accent-500 text-white font-medium py-2 rounded-lg text-sm transition-colors">שמור תור</button>
      </form>
    </div>
  );
}
export default function Baby() {
  const { data: children = [], refetch: refetchChildren } = useChildren();
  const { data: profile } = useProfile();
  const qc = useQueryClient();
  const [activeChild, setActiveChild] = useState<string>("");
  const cid = activeChild || children[0]?.id;
  const activeChildData = children.find(c => c.id === cid);
  const { data: logs = [], addLog } = useBabyLogs(cid);
  const { data: appointments = [], upsertAppointment } = useAppointments();
  const [tab, setTab] = useState<"logs" | "appointments">("logs");
  const [apptModal, setApptModal] = useState(false);
  const [addChildModal, setAddChildModal] = useState(false);
  const today = new Date().toISOString().slice(0, 10);
  const todayLogs = logs.filter(l => l.event_at?.slice(0, 10) === today);
  const feedings = todayLogs.filter(l => l.log_type === "feeding");
  const diapers = todayLogs.filter(l => l.log_type === "diaper_change");
  const quickLog = (type: string, extras: Row = {}) => {
    if (!cid) return;
    addLog.mutate({ child_id: cid, log_type: type, event_at: new Date().toISOString(), ...extras });
  };
  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold">תינוקות</h2>
          {activeChildData && <p className="text-accent-400 font-medium mt-0.5">{activeChildData.name}</p>}
        </div>
        <div className="flex gap-2">
          {tab === "appointments" && <button onClick={() => setApptModal(true)} className="bg-accent-600 hover:bg-accent-500 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors">+ תור</button>}
          <button onClick={() => setAddChildModal(true)} className="bg-slate-700 hover:bg-slate-600 text-white text-sm font-medium px-3 py-2 rounded-lg transition-colors">+ תינוק/ת</button>
        </div>
      </div>
      {children.length === 0 && (
        <div className="text-center py-16 text-slate-500">
          <div className="text-4xl mb-3">👶</div>
          <p className="mb-4">עדיין לא הוספת תינוק/ת</p>
          <button onClick={() => setAddChildModal(true)} className="bg-accent-600 hover:bg-accent-500 text-white text-sm font-medium px-4 py-2 rounded-lg">הוסף תינוק/ת</button>
        </div>
      )}
      {children.length > 1 && (
        <div className="flex gap-2 mb-4">
          {children.map(c => (
            <button key={c.id} onClick={() => setActiveChild(c.id)}
              className={"px-3 py-1.5 rounded-lg text-sm font-medium transition-colors " + (cid === c.id ? "bg-accent-600 text-white" : "bg-slate-800 text-slate-300 hover:bg-slate-700")}>
              {c.name}
            </button>
          ))}
        </div>
      )}
      {children.length > 0 && (
        <>
          <div className="flex rounded-lg bg-slate-900 border border-slate-800 p-0.5 w-fit mb-5">
            {(["logs", "appointments"] as const).map(t => (
              <button key={t} onClick={() => setTab(t)} className={"px-4 py-1.5 rounded-md text-xs font-medium transition-colors " + (tab === t ? "bg-accent-700 text-white" : "text-slate-400 hover:text-white")}>
                {t === "logs" ? "📋 יומן היום" : "🏥 תורים"}
              </button>
            ))}
          </div>
          {tab === "logs" && (
            <div>
              <div className="grid grid-cols-3 gap-3 mb-6">
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 text-center"><div className="text-2xl font-bold">{feedings.length}</div><div className="text-xs text-slate-400 mt-1">האכלות היום</div>{feedings.length > 0 && <div className="text-xs text-accent-400 mt-0.5">{feedings.reduce((s, f) => s + (f.amount ?? 0), 0)} מ״ל</div>}</div>
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 text-center"><div className="text-2xl font-bold">{diapers.length}</div><div className="text-xs text-slate-400 mt-1">החלפות חיתול</div></div>
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 text-center"><div className="text-2xl font-bold">{todayLogs.length}</div><div className="text-xs text-slate-400 mt-1">אירועים סה״כ</div></div>
              </div>
              <div className="flex gap-2 flex-wrap mb-5">
                <button onClick={() => quickLog("feeding", { amount: 120, unit: "מ״ל" })} className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl px-3 py-2 text-sm font-medium transition-colors">🍼 האכלה</button>
                <button onClick={() => quickLog("diaper_change")} className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl px-3 py-2 text-sm font-medium transition-colors">👶 חיתול</button>
                <button onClick={() => quickLog("sleep")} className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl px-3 py-2 text-sm font-medium transition-colors">😴 שינה</button>
              </div>
              <div className="space-y-2">
                {logs.slice(0, 40).map(log => (
                  <div key={log.id} className="flex items-center gap-3 bg-slate-900 border border-slate-800 rounded-xl px-4 py-3">
                    <span className="text-lg">{LOG_ICONS[log.log_type] ?? "📝"}</span>
                    <div className="flex-1">
                      <div className="text-sm font-medium">{LOG_LABELS[log.log_type] ?? log.log_type}</div>
                      {log.amount && <div className="text-xs text-slate-400">{log.amount} {log.unit}</div>}
                      {log.notes && <div className="text-xs text-slate-500">{log.notes}</div>}
                    </div>
                    <span className="text-xs text-slate-500">{new Date(log.event_at).toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" })}</span>
                  </div>
                ))}
                {logs.length === 0 && <div className="text-center py-10 text-slate-500">אין רשומות עדיין. השתמש בכפתורים למעלה.</div>}
              </div>
            </div>
          )}
          {tab === "appointments" && (
            <div className="space-y-3">
              {appointments.map(appt => (
                <div key={appt.id} className="bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 flex items-start gap-4">
                  <div className="text-center shrink-0">
                    <div className="text-sm font-bold text-accent-400">{new Date(appt.starts_at).toLocaleDateString("he-IL", { month: "short", day: "numeric" })}</div>
                    <div className="text-xs text-slate-500">{new Date(appt.starts_at).toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" })}</div>
                  </div>
                  <div className="flex-1">
                    <div className="font-medium text-sm">{appt.title}</div>
                    {appt.provider_name && <div className="text-xs text-slate-400 mt-0.5">{appt.provider_name}</div>}
                    {appt.location && <div className="text-xs text-slate-500">{appt.location}</div>}
                  </div>
                  <span className={"text-xs px-2 py-0.5 rounded-full " + (appt.status === "completed" ? "bg-emerald-900 text-emerald-300" : "bg-slate-800 text-slate-400")}>
                    {appt.status === "scheduled" ? "מתוזמן" : appt.status === "completed" ? "הושלם" : "בוטל"}
                  </span>
                </div>
              ))}
              {appointments.length === 0 && <div className="text-center py-10 text-slate-500">אין תורים קרובים.</div>}
            </div>
          )}
        </>
      )}
      {apptModal && <AddApptModal children={children} onClose={() => setApptModal(false)} onSave={data => upsertAppointment.mutate(data)} />}
      {addChildModal && profile?.household_id && (
        <AddChildModal householdId={profile.household_id} onClose={() => setAddChildModal(false)}
          onDone={() => { refetchChildren(); qc.invalidateQueries({ queryKey: ["children"] }); }} />
      )}
    </div>
  );
}
