import { useUiStore } from "./state/stores/uiStore";
import { hasSupabaseEnv } from "./lib/supabase";

function App() {
  const { selectedDate, taskBoardView, showCompletedTasks, setTaskBoardView } =
    useUiStore();

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <section className="mx-auto max-w-4xl px-6 py-12">
        <h1 className="text-3xl font-bold">Family ERP</h1>
        <p className="mt-2 text-slate-300">
          Architecture baseline is ready. Next step is wiring module-specific pages.
        </p>

        <div className="mt-6 rounded-xl border border-slate-800 bg-slate-900 p-4">
          <h2 className="text-lg font-semibold">Runtime Status</h2>
          <ul className="mt-3 space-y-2 text-sm text-slate-300">
            <li>Selected date: {selectedDate}</li>
            <li>Board view: {taskBoardView}</li>
            <li>Show completed tasks: {showCompletedTasks ? "yes" : "no"}</li>
            <li>Supabase env configured: {hasSupabaseEnv ? "yes" : "no"}</li>
          </ul>

          <div className="mt-4 flex gap-2">
            <button
              className="rounded bg-indigo-600 px-3 py-1.5 text-sm font-medium hover:bg-indigo-500"
              onClick={() => setTaskBoardView("kanban")}
            >
              Kanban
            </button>
            <button
              className="rounded bg-indigo-600 px-3 py-1.5 text-sm font-medium hover:bg-indigo-500"
              onClick={() => setTaskBoardView("list")}
            >
              List
            </button>
            <button
              className="rounded bg-indigo-600 px-3 py-1.5 text-sm font-medium hover:bg-indigo-500"
              onClick={() => setTaskBoardView("timeline")}
            >
              Timeline
            </button>
          </div>
        </div>
      </section>
    </main>
  );
}

export default App;

