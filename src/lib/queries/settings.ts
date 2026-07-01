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

/**
 * Template-Sync-Status: Vergleicht die vom User zuletzt importierte
 * Template-Version (in user_settings) mit der aktuellen max-Version der
 * Template-Tabellen. Wenn die Templates neuer sind, kann später ein
 * Import-Flow angeboten werden.
 *
 * Für den ersten Wurf zeigen wir nur eine Info-Card in den Settings —
 * kein tatsächlicher Import-Button.
 */
export type TemplateSyncStatus = {
  ingredientBehind: boolean;
  recipeBehind: boolean;
  userIngredientVersion: number;
  userRecipeVersion: number;
  latestIngredientVersion: number;
  latestRecipeVersion: number;
};

export function useTemplateSyncStatus() {
  return useQuery({
    queryKey: [...qk.settings, "template-sync"] as const,
    queryFn: async (): Promise<TemplateSyncStatus | null> => {
      const supabase = createSupabaseBrowserClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return null;

      const [settingsResp, ingResp, recResp] = await Promise.all([
        supabase
          .from("user_settings")
          .select(
            "template_snapshot_ingredient_version, template_snapshot_recipe_version",
          )
          .eq("user_id", user.id)
          .maybeSingle(),
        supabase
          .from("template_ingredient")
          .select("version")
          .order("version", { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase
          .from("template_recipe")
          .select("version")
          .order("version", { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);

      // Fehler beim Lesen sollen die Settings-Page nicht sprengen —
      // wir behandeln fehlende Werte defensiv als "kein Sync nötig".
      const userIng =
        (settingsResp.data?.template_snapshot_ingredient_version as
          | number
          | undefined) ?? 0;
      const userRec =
        (settingsResp.data?.template_snapshot_recipe_version as
          | number
          | undefined) ?? 0;
      const latestIng = (ingResp.data?.version as number | undefined) ?? 0;
      const latestRec = (recResp.data?.version as number | undefined) ?? 0;

      return {
        ingredientBehind: latestIng > userIng,
        recipeBehind: latestRec > userRec,
        userIngredientVersion: userIng,
        userRecipeVersion: userRec,
        latestIngredientVersion: latestIng,
        latestRecipeVersion: latestRec,
      };
    },
  });
}
