import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../lib/supabase";
import { queryKeys } from "../state/queryKeys";
import { useProfile } from "./useProfile";

type HouseholdSettings = {
  household_id: string;
  assistant_model: string;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
};

export function useHouseholdSettings() {
  const { data: profile } = useProfile();
  const hid = profile?.household_id ?? "";
  const qc = useQueryClient();

  const query = useQuery<HouseholdSettings | null>({
    queryKey: queryKeys.householdSettings(hid),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("household_settings")
        .select("household_id, assistant_model, updated_by, created_at, updated_at")
        .eq("household_id", hid)
        .maybeSingle();
      if (error) {
        if ((error as { code?: string }).code === "42P01") {
          return null;
        }
        throw error;
      }
      return data;
    },
    enabled: !!hid,
  });

  const setAssistantModelForHousehold = useMutation({
    mutationFn: async (assistantModel: string) => {
      if (!hid) throw new Error("לא נמצא מזהה בית לשמירת ההגדרה.");
      const payload = {
        household_id: hid,
        assistant_model: assistantModel.trim(),
        updated_by: profile?.id ?? null,
      };
      const { data, error } = await supabase
        .from("household_settings")
        .upsert(payload, { onConflict: "household_id" })
        .select("household_id, assistant_model, updated_by, created_at, updated_at")
        .single();
      if (error) {
        if ((error as { code?: string }).code === "42P01") {
          throw new Error("חסרה טבלת household_settings. יש להריץ migration חדשה.");
        }
        throw error;
      }
      return data as HouseholdSettings;
    },
    onSuccess: () => {
      if (!hid) return;
      qc.invalidateQueries({ queryKey: queryKeys.householdSettings(hid) });
    },
  });

  return {
    ...query,
    setAssistantModelForHousehold,
  };
}


