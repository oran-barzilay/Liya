import type { QueryClient } from "@tanstack/react-query";
import type { SupabaseClient } from "@supabase/supabase-js";
import { queryKeys } from "../queryKeys";
import type { UUID } from "../../types/domain";

/**
 * Binds realtime DB changes to query invalidation, keeping dashboard widgets fresh.
 */
export function bindHouseholdRealtime(
  supabase: SupabaseClient,
  queryClient: QueryClient,
  householdId: UUID
) {
  const channel = supabase
    .channel(`household-${householdId}`)
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "tasks", filter: `household_id=eq.${householdId}` },
      () => queryClient.invalidateQueries({ queryKey: queryKeys.tasks(householdId) })
    )
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "inventory",
        filter: `household_id=eq.${householdId}`,
      },
      () => {
        queryClient.invalidateQueries({ queryKey: queryKeys.inventory(householdId) });
      }
    )
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "appointments",
        filter: `household_id=eq.${householdId}`,
      },
      () => queryClient.invalidateQueries({ queryKey: queryKeys.appointments(householdId) })
    )
    .subscribe();

  return () => {
    void supabase.removeChannel(channel);
  };
}

