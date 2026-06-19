"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { qk } from "@/lib/query/keys";
import type { UserSettings } from "@/lib/db/types";
import type { UserSettingsFormValues } from "@/lib/validators";

export function useSettings() {
  return useQuery({
    queryKey: qk.settings,
    queryFn: async (): Promise<UserSettings | null> => {
      const supabase = createSupabaseBrowserClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return null;
      const { data, error } = await supabase
        .from("user_settings")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();
      if (error) throw error;
      return (data as UserSettings) ?? null;
    },
  });
}

export function useUpdateSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (values: UserSettingsFormValues) => {
      const supabase = createSupabaseBrowserClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Nicht angemeldet");
      const { error } = await supabase
        .from("user_settings")
        .update({
          target_kcal_per_day: values.target_kcal_per_day,
          protein_pct: values.protein_pct,
          carbs_pct: values.carbs_pct,
          fat_pct: values.fat_pct,
          meal_slots: values.meal_slots,
          meal_slot_pct: values.meal_slot_pct,
          tolerance_pct: values.tolerance_pct,
          excluded_ingredient_ids: values.excluded_ingredient_ids,
        })
        .eq("user_id", user.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.settings });
    },
  });
}
