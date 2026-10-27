import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../lib/supabase";
import { useProfile } from "./useProfile";
import type { Trip, TripItem } from "../lib/trips";

export function useTrips() {
  const { data: profile } = useProfile();
  const hid = profile?.household_id ?? "";
  const qc = useQueryClient();

  const query = useQuery<Trip[]>({
    queryKey: ["trips", hid],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("trips")
        .select("*")
        .eq("household_id", hid)
        .order("start_date", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!hid,
  });

  // All items across trips, for the list's totals / to-do counts
  const allItems = useQuery<TripItem[]>({
    queryKey: ["trip_items", hid, "all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("trip_items")
        .select("id, trip_id, kind, title, start_date, end_date, price, status, todo, is_optional, free_cancel_until, sort_order")
        .eq("household_id", hid);
      if (error) throw error;
      return (data ?? []) as TripItem[];
    },
    enabled: !!hid,
  });

  const createTrip = useMutation({
    mutationFn: async (trip: Pick<Trip, "name" | "start_date" | "end_date"> & Partial<Trip>) => {
      const { data, error } = await supabase
        .from("trips")
        .insert({ currency: "USD", ...trip, household_id: hid, created_by: profile?.id })
        .select()
        .single();
      if (error) throw error;
      return data as Trip;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["trips", hid] }),
  });

  const deleteTrip = useMutation({
    mutationFn: async (tripId: string) => {
      const { error } = await supabase.from("trips").delete().eq("id", tripId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["trips", hid] });
      qc.invalidateQueries({ queryKey: ["trip_items", hid] });
    },
  });

  return { ...query, allItems: allItems.data ?? [], createTrip, deleteTrip };
}

export function useTrip(tripId: string | undefined) {
  const { data: profile } = useProfile();
  const hid = profile?.household_id ?? "";
  const qc = useQueryClient();
  const itemsKey = ["trip_items", hid, tripId] as const;

  const trip = useQuery<Trip | null>({
    queryKey: ["trips", hid, tripId],
    queryFn: async () => {
      const { data, error } = await supabase.from("trips").select("*").eq("id", tripId!).maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!hid && !!tripId,
  });

  const items = useQuery<TripItem[]>({
    queryKey: itemsKey,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("trip_items")
        .select("*")
        .eq("trip_id", tripId!)
        .order("start_date", { ascending: true })
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return (data ?? []).map((i) => ({ ...i, price: i.price == null ? null : Number(i.price) })) as TripItem[];
    },
    enabled: !!hid && !!tripId,
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["trip_items", hid] });
    qc.invalidateQueries({ queryKey: ["trips", hid] });
  };

  const updateTrip = useMutation({
    mutationFn: async (patch: Partial<Trip>) => {
      const { error } = await supabase.from("trips").update(patch).eq("id", tripId!);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const upsertItem = useMutation({
    mutationFn: async (item: Partial<TripItem> & { title: string; start_date: string }) => {
      const row = { ...item, trip_id: tripId, household_id: hid };
      const { error } = item.id
        ? await supabase.from("trip_items").update(row).eq("id", item.id)
        : await supabase.from("trip_items").insert({ ...row, sort_order: (items.data?.length ?? 0) + 1 });
      if (error) throw error;
    },
    // Optimistic update so toggles like "add to plan" feel instant
    onMutate: async (item) => {
      if (!item.id) return;
      await qc.cancelQueries({ queryKey: itemsKey });
      const prev = qc.getQueryData<TripItem[]>(itemsKey);
      qc.setQueryData<TripItem[]>(itemsKey, (old) => old?.map((i) => (i.id === item.id ? { ...i, ...item } : i)));
      return { prev };
    },
    onError: (_e, _v, ctx) => ctx?.prev && qc.setQueryData(itemsKey, ctx.prev),
    onSettled: invalidate,
  });

  const deleteItem = useMutation({
    mutationFn: async (itemId: string) => {
      const { error } = await supabase.from("trip_items").delete().eq("id", itemId);
      if (error) throw error;
    },
    onMutate: async (itemId) => {
      await qc.cancelQueries({ queryKey: itemsKey });
      const prev = qc.getQueryData<TripItem[]>(itemsKey);
      qc.setQueryData<TripItem[]>(itemsKey, (old) => old?.filter((i) => i.id !== itemId));
      return { prev };
    },
    onError: (_e, _v, ctx) => ctx?.prev && qc.setQueryData(itemsKey, ctx.prev),
    onSettled: invalidate,
  });

  return { trip: trip.data, isLoading: trip.isLoading || items.isLoading, items: items.data ?? [], updateTrip, upsertItem, deleteItem };
}
