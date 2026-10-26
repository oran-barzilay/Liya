import Icon from "./Icon";

/** Mobile-only floating "add" button, placed above the bottom tab bar. */
export default function Fab({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="md:hidden fixed fab-pos end-4 z-30 h-14 ps-4 pe-5 rounded-2xl bg-accent-600 active:bg-accent-700 text-white text-sm font-semibold shadow-lg shadow-black/40 flex items-center gap-2"
    >
      <Icon name="plus" className="w-5 h-5" />
      {label}
    </button>
  );
}
