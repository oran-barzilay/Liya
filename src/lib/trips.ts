// Trip planning domain helpers: types, date math, and day-by-day grouping.

export type TripItemKind = "flight" | "hotel" | "car" | "transport" | "activity" | "food" | "note" | "other";
export type TripItemStatus = "planned" | "booked" | "done";

export interface Trip {
  id: string;
  household_id: string;
  name: string;
  destination: string | null;
  start_date: string;
  end_date: string;
  currency: string;
  notes: string | null;
}

export interface TripItem {
  id: string;
  trip_id: string;
  kind: TripItemKind;
  title: string;
  start_date: string;
  end_date: string | null;
  time_text: string | null;
  price: number | null;
  details: string | null;
  free_cancel_until: string | null;
  booking_ref: string | null;
  link: string | null;
  status: TripItemStatus;
  todo: string | null;
  is_optional: boolean;
  sort_order: number;
}

export const KIND_META: Record<TripItemKind, { label: string; icon: "plane" | "bed" | "car" | "map-pin" | "star" | "clipboard" | "link" }> = {
  flight:    { label: "טיסה",    icon: "plane" },
  hotel:     { label: "לינה",    icon: "bed" },
  car:       { label: "רכב",     icon: "car" },
  transport: { label: "תחבורה",  icon: "map-pin" },
  activity:  { label: "פעילות",  icon: "star" },
  food:      { label: "אוכל",    icon: "star" },
  note:      { label: "הערה",    icon: "clipboard" },
  other:     { label: "אחר",     icon: "link" },
};

export const STATUS_LABEL: Record<TripItemStatus, string> = {
  planned: "מתוכנן",
  booked: "הוזמן",
  done: "בוצע",
};

const DAY_MS = 86_400_000;
const toUtc = (iso: string) => Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10));

export function addDays(iso: string, days: number): string {
  return new Date(toUtc(iso) + days * DAY_MS).toISOString().slice(0, 10);
}

export function daysBetween(fromIso: string, toIso: string): number {
  return Math.round((toUtc(toIso) - toUtc(fromIso)) / DAY_MS);
}

export function dateRange(startIso: string, endIso: string): string[] {
  const n = Math.max(0, daysBetween(startIso, endIso));
  return Array.from({ length: n + 1 }, (_, i) => addDays(startIso, i));
}

/** "שבת 03.04" */
export function formatDayLabel(iso: string): { weekday: string; date: string } {
  const d = new Date(toUtc(iso));
  return {
    weekday: d.toLocaleDateString("he-IL", { weekday: "long", timeZone: "UTC" }),
    date: `${iso.slice(8, 10)}.${iso.slice(5, 7)}`,
  };
}

export function formatShortDate(iso: string | null | undefined): string {
  return iso ? `${iso.slice(8, 10)}.${iso.slice(5, 7)}` : "";
}

export function formatMoney(value: number, currency: string): string {
  const symbol = currency === "USD" ? "$" : currency === "ILS" ? "₪" : currency === "EUR" ? "€" : `${currency} `;
  return symbol + Math.round(value).toLocaleString("he-IL");
}

export function nightsOf(item: Pick<TripItem, "start_date" | "end_date">): number {
  return item.end_date ? Math.max(1, daysBetween(item.start_date, item.end_date)) : 1;
}

export interface TripDay {
  date: string;
  index: number;
  /** Items that start on this day (bookings, notes, planned activities) */
  items: TripItem[];
  /** Optional activity ideas for this day */
  options: TripItem[];
  /** Hotel you sleep in tonight (continuing stay, not checked in today) */
  stayingAt: { item: TripItem; night: number; nights: number } | null;
  /** Hotels checked out today */
  checkouts: TripItem[];
}

const KIND_ORDER: TripItemKind[] = ["flight", "transport", "car", "hotel", "activity", "food", "note", "other"];

function compareItems(a: TripItem, b: TripItem): number {
  const ta = a.time_text ?? "99";
  const tb = b.time_text ?? "99";
  if (ta !== tb) return ta.localeCompare(tb);
  const ka = KIND_ORDER.indexOf(a.kind);
  const kb = KIND_ORDER.indexOf(b.kind);
  if (ka !== kb) return ka - kb;
  return a.sort_order - b.sort_order;
}

export function buildTripDays(trip: Pick<Trip, "start_date" | "end_date">, items: TripItem[]): TripDay[] {
  return dateRange(trip.start_date, trip.end_date).map((date, index) => {
    const starting = items.filter((i) => i.start_date === date);
    const hotels = items.filter((i) => i.kind === "hotel" && !i.is_optional);
    const continuing = hotels.find((h) => h.start_date < date && h.end_date && date < h.end_date);
    return {
      date,
      index,
      items: starting.filter((i) => !i.is_optional).sort(compareItems),
      options: starting.filter((i) => i.is_optional).sort(compareItems),
      stayingAt: continuing
        ? { item: continuing, night: daysBetween(continuing.start_date, date) + 1, nights: nightsOf(continuing) }
        : null,
      checkouts: hotels.filter((h) => h.end_date === date),
    };
  });
}

export interface TripSummary {
  bookedTotal: number;
  plannedTotal: number;
  optionsCount: number;
  todos: TripItem[];
  /** Free-cancellation deadlines from today onward, soonest first */
  deadlines: TripItem[];
}

export function summarizeTrip(items: TripItem[], todayIso: string): TripSummary {
  const committed = items.filter((i) => !i.is_optional);
  const sum = (list: TripItem[]) => list.reduce((s, i) => s + (Number(i.price) || 0), 0);
  return {
    bookedTotal: sum(committed.filter((i) => i.status !== "planned")),
    plannedTotal: sum(committed),
    optionsCount: items.filter((i) => i.is_optional).length,
    todos: committed.filter((i) => i.todo?.trim()),
    deadlines: committed
      .filter((i) => i.free_cancel_until && i.free_cancel_until >= todayIso)
      .sort((a, b) => a.free_cancel_until!.localeCompare(b.free_cancel_until!)),
  };
}
