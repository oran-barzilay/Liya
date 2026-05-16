import { useState } from "react";
import { useChildren, useBabyLogs, useAppointments } from "../hooks/useBaby";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = Record<string, any>;

const LOG_ICONS: Record<string, string> = {
  feeding: "🍼",
  diaper_change: "👶",
  sleep: "😴",
  note: "📝",
};

function QuickLogButtons({ childId, onAdd }: { childId: string; onAdd: (l: Row) => void }) {
  const now = new Date().toISOString();
  return (
    <div className="flex gap-2 flex-wrap">
      {[
        { type: "feeding", label: "Feeding", amount: 120, unit: "ml" },
        { type: "diaper_change", label: "Diaper" },
        { type: "sleep", label: "Sleep" },
      ].map((item) => (
        <button
          key={item.type}
          onClick={() =>
            onAdd({
              child_id: childId,
              log_type: item.type,
              event_at: now,
              amount: item.amount ?? null,
              unit: item.unit ?? null,
              notes: null,
            })
          }
          className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl px-3 py-2 text-sm font-medium transition-colors"
        >
          <span>{LOG_ICONS[item.type]}</span>
          {item.label}
        </button>
      ))}
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
      <form
        onSubmit={e => { e.preventDefault(); onSave({ title, starts_at: startsAt, child_id: childId || null, provider_name: provider || null, location: loc || null, status: "scheduled" }); onClose(); }}
        className="bg-slate-900 border border-slate-700 rounded-2xl p-5 w-full max-w-sm space-y-4"
      >
        <div className="flex items-center justify-between">
          <h3 className="font-semibold">New Appointment</h3>
          <button type="button" onClick={onClose} className="text-slate-500 hover:text-white">✕</button>
        </div>
        <div><label className="text-xs text-slate-400 block mb-1">Title *</label><input required value={title} onChange={e => setTitle(e.target.value)} className="input-base w-full" placeholder="Dr. visit" /></div>
        <div><label className="text-xs text-slate-400 block mb-1">Date & time *</label><input type="datetime-local" required value={startsAt} onChange={e => setStartsAt(e.target.value)} className="input-base w-full" /></div>
        {children.length > 0 && (
          <div><label className="text-xs text-slate-400 block mb-1">Child</label>
            <select value={childId} onChange={e => setChildId(e.target.value)} className="input-base w-full">
              <option value="">— General —</option>
              {children.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
        )}
        <div><label className="text-xs text-slate-400 block mb-1">Doctor / provider</label><input value={provider} onChange={e => setProvider(e.target.value)} className="input-base w-full" placeholder="Dr. Cohen" /></div>
        <div><label className="text-xs text-slate-400 block mb-1">Location</label><input value={loc} onChange={e => setLoc(e.target.value)} className="input-base w-full" placeholder="Clinic address" /></div>
        <button type="submit" className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-medium py-2 rounded-lg text-sm transition-colors">Save appointment</button>
      </form>
    </div>
  );
}

export default function Baby() {
  const { data: children = [] } = useChildren();
  const [activeChild, setActiveChild] = useState<string>("");
  const cid = activeChild || children[0]?.id;
  const { data: logs = [], addLog } = useBabyLogs(cid);
  const { data: appointments = [], upsertAppointment } = useAppointments();
  const [tab, setTab] = useState<"logs" | "appointments">("logs");
  const [apptModal, setApptModal] = useState(false);

  const todayLogs = logs.filter(l => l.event_at?.slice(0, 10) === new Date().toISOString().slice(0, 10));
  const feedings = todayLogs.filter(l => l.log_type === "feeding");
  const diapers = todayLogs.filter(l => l.log_type === "diaper_change");

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold">Baby & Child</h2>
        {tab === "appointments" && (
          <button onClick={() => setApptModal(true)} className="bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors">+ Appointment</button>
        )}
      </div>

      {children.length > 1 && (
        <div className="flex gap-2 mb-4">
          {children.map(c => (
            <button key={c.id} onClick={() => setActiveChild(c.id)} className={"px-3 py-1.5 rounded-lg text-sm font-medium transition-colors " + (cid === c.id ? "bg-indigo-600 text-white" : "bg-slate-800 text-slate-300 hover:bg-slate-700")}>{c.name}</button>
          ))}
        </div>
      )}

      <div className="flex rounded-lg bg-slate-900 border border-slate-800 p-0.5 w-fit mb-5">
        {(["logs", "appointments"] as const).map(t => (
          <button key={t} onClick={() => setTab(t)} className={"px-4 py-1.5 rounded-md text-xs font-medium capitalize transition-colors " + (tab === t ? "bg-indigo-700 text-white" : "text-slate-400 hover:text-white")}>
            {t === "logs" ? "📋 Today's Logs" : "🏥 Appointments"}
          </button>
        ))}
      </div>

      {tab === "logs" && (
        <div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 text-center"><div className="text-2xl font-bold">{feedings.length}</div><div className="text-xs text-slate-400 mt-1">Feedings today</div>{feedings.length > 0 && <div className="text-xs text-indigo-400 mt-0.5">{feedings.reduce((s, f) => s + (f.amount ?? 0), 0)} ml total</div>}</div>
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 text-center"><div className="text-2xl font-bold">{diapers.length}</div><div className="text-xs text-slate-400 mt-1">Diaper changes</div></div>
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 text-center"><div className="text-2xl font-bold">{todayLogs.length}</div><div className="text-xs text-slate-400 mt-1">Total events</div></div>
          </div>

          {cid && <QuickLogButtons childId={cid} onAdd={data => addLog.mutate(data)} />}

          <div className="mt-5 space-y-2">
            {logs.slice(0, 40).map(log => (
              <div key={log.id} className="flex items-center gap-3 bg-slate-900 border border-slate-800 rounded-xl px-4 py-3">
                <span className="text-lg">{LOG_ICONS[log.log_type] ?? "📝"}</span>
                <div className="flex-1">
                  <div className="text-sm font-medium capitalize">{log.log_type.replace("_", " ")}</div>
                  {log.amount && <div className="text-xs text-slate-400">{log.amount} {log.unit}</div>}
                  {log.notes && <div className="text-xs text-slate-500">{log.notes}</div>}
                </div>
                <span className="text-xs text-slate-500">
                  {new Date(log.event_at).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}
                </span>
              </div>
            ))}
            {logs.length === 0 && <div className="text-center py-10 text-slate-500">No logs yet. Use the quick buttons above.</div>}
          </div>
        </div>
      )}

      {tab === "appointments" && (
        <div className="space-y-3">
          {appointments.map(appt => (
            <div key={appt.id} className="bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 flex items-start gap-4">
              <div className="text-center shrink-0">
                <div className="text-sm font-bold text-indigo-400">{new Date(appt.starts_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</div>
                <div className="text-xs text-slate-500">{new Date(appt.starts_at).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}</div>
              </div>
              <div className="flex-1">
                <div className="font-medium text-sm">{appt.title}</div>
                {appt.provider_name && <div className="text-xs text-slate-400 mt-0.5">{appt.provider_name}</div>}
                {appt.location && <div className="text-xs text-slate-500">{appt.location}</div>}
              </div>
              <span className={"text-xs px-2 py-0.5 rounded-full " + (appt.status === "completed" ? "bg-emerald-900 text-emerald-300" : "bg-slate-800 text-slate-400")}>{appt.status}</span>
            </div>
          ))}
          {appointments.length === 0 && <div className="text-center py-10 text-slate-500">No upcoming appointments.</div>}
        </div>
      )}

      {apptModal && <AddApptModal children={children} onClose={() => setApptModal(false)} onSave={data => upsertAppointment.mutate(data)} />}
    </div>
  );
}

