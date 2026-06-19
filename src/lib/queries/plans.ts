"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import type { MealSlot, Plan, PlanWithMeals, UserSettings } from "@/lib/db/types";
import type { GeneratedMeal } from "@/lib/domain/generator";

// =========================================================================
// Query-Keys
// =========================================================================

export const planKeys = {
  active: ["plan", "active"] as const,
  list: (status?: string) => ["plan", "list", status ?? "all"] as const,
  detail: (id: string) => ["plan", "detail", id] as const,
};

const SELECT_PLAN_WITH_MEALS = `
  id,user_id,name,day_count,day_labels,status,
  meal_slots,meal_slot_pct,target_kcal_per_day,protein_pct,carbs_pct,fat_pct,
  created_at,activated_at,archived_at,
  meals:plan_meal(
    id,plan_id,day_index,meal_slot,recipe_id,serving_factor,cooked,cooked_at,created_at,
    recipe:recipe(
      id,user_id,name,meal_types,base_servings,instructions,suppressed,created_at,updated_at,
      ingredients:recipe_ingredient(
        recipe_id,ingredient_id,amount,unit,position,
        ingredient:ingredient!inner(
          id,user_id,display_name,bls_code,default_unit,grams_per_piece,category,excluded,created_at,updated_at,
          bls:bls_food!inner(bls_code,name_de,kcal_per_100g,protein_per_100g,carbs_per_100g,fat_per_100g)
        )
      )
    )
  )
`;

// =========================================================================
// Aktiven Plan abfragen
// =========================================================================

export function useActivePlan() {
  return useQuery({
    queryKey: planKeys.active,
    queryFn: async (): Promise<PlanWithMeals | null> => {
      const supabase = createSupabaseBrowserClient();
      const { data, error } = await supabase
        .from("plan")
        .select(SELECT_PLAN_WITH_MEALS)
        .eq("status", "active")
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;
      return sortMealsInPlace(data as unknown as PlanWithMeals);
    },
  });
}

export function usePlan(id: string | undefined) {
  return useQuery({
    queryKey: planKeys.detail(id ?? ""),
    enabled: !!id,
    queryFn: async (): Promise<PlanWithMeals | null> => {
      const supabase = createSupabaseBrowserClient();
      const { data, error } = await supabase
        .from("plan")
        .select(SELECT_PLAN_WITH_MEALS)
        .eq("id", id!)
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;
      return sortMealsInPlace(data as unknown as PlanWithMeals);
    },
  });
}

export function useArchivedPlans() {
  return useQuery({
    queryKey: planKeys.list("archived"),
    queryFn: async (): Promise<Plan[]> => {
      const supabase = createSupabaseBrowserClient();
      const { data, error } = await supabase
        .from("plan")
        .select(
          "id,user_id,name,day_count,day_labels,status,meal_slots,meal_slot_pct,target_kcal_per_day,protein_pct,carbs_pct,fat_pct,created_at,activated_at,archived_at",
        )
        .eq("status", "archived")
        .order("archived_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Plan[];
    },
  });
}

function sortMealsInPlace(plan: PlanWithMeals): PlanWithMeals {
  plan.meals.sort((a, b) => {
    if (a.day_index !== b.day_index) return a.day_index - b.day_index;
    return mealSlotOrder(a.meal_slot) - mealSlotOrder(b.meal_slot);
  });
  return plan;
}

function mealSlotOrder(s: MealSlot): number {
  return ["breakfast", "lunch", "dinner", "snack"].indexOf(s);
}

// =========================================================================
// Plan erstellen (als Draft) inkl. Mahlzeiten
// =========================================================================

export type CreatePlanInput = {
  name?: string | null;
  dayLabels: string[];
  settings: UserSettings;
  meals: GeneratedMeal[];
};

export function useCreatePlanDraft() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreatePlanInput): Promise<string> => {
      const supabase = createSupabaseBrowserClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Nicht angemeldet");

      const { data: planRow, error: planErr } = await supabase
        .from("plan")
        .insert({
          user_id: user.id,
          name: input.name ?? null,
          day_count: input.dayLabels.length,
          day_labels: input.dayLabels,
          status: "draft",
          meal_slots: input.settings.meal_slots,
          meal_slot_pct: input.settings.meal_slot_pct,
          target_kcal_per_day: input.settings.target_kcal_per_day,
          protein_pct: input.settings.protein_pct,
          carbs_pct: input.settings.carbs_pct,
          fat_pct: input.settings.fat_pct,
        })
        .select("id")
        .single();
      if (planErr) throw planErr;

      const planId = (planRow as { id: string }).id;

      if (input.meals.length > 0) {
        const rows = input.meals.map((m) => ({
          plan_id: planId,
          day_index: m.dayIndex,
          meal_slot: m.mealSlot,
          recipe_id: m.recipeId,
          serving_factor: m.servingFactor,
        }));
        const { error: mealErr } = await supabase.from("plan_meal").insert(rows);
        if (mealErr) throw mealErr;
      }

      return planId;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["plan"] });
    },
  });
}

// =========================================================================
// Plan-Mahlzeit aktualisieren / löschen (Draft + Active)
// =========================================================================

export function useUpdatePlanMeal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      mealId: string;
      recipeId?: string | null;
      servingFactor?: number;
    }) => {
      const supabase = createSupabaseBrowserClient();
      const update: Record<string, unknown> = {};
      if (input.recipeId !== undefined) update.recipe_id = input.recipeId;
      if (input.servingFactor !== undefined)
        update.serving_factor = input.servingFactor;
      const { error } = await supabase
        .from("plan_meal")
        .update(update)
        .eq("id", input.mealId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["plan"] });
    },
  });
}

export function useToggleMealCooked() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { mealId: string; cooked: boolean }) => {
      const supabase = createSupabaseBrowserClient();
      // RPC: setzt cooked-Flag und passt den Vorrat an (subtrahiert/addiert
      // Mengen × serving_factor / base_servings).
      const { error } = await supabase.rpc("mark_meal_cooked", {
        p_meal_id: input.mealId,
        p_cooked: input.cooked,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["plan"] });
      qc.invalidateQueries({ queryKey: ["inventory"] });
    },
  });
}

export function useDeletePlanMeal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (mealId: string) => {
      const supabase = createSupabaseBrowserClient();
      const { error } = await supabase.from("plan_meal").delete().eq("id", mealId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["plan"] });
    },
  });
}

// =========================================================================
// Plan aktivieren / archivieren / verwerfen
// =========================================================================

export function useActivatePlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (planId: string) => {
      const supabase = createSupabaseBrowserClient();
      // RPC: archiviert alten aktiven Plan, aktiviert Draft, erzeugt
      // Einkaufsliste-Snapshot (Bedarf - Vorrat). Atomar.
      const { error } = await supabase.rpc("activate_plan", {
        p_plan_id: planId,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["plan"] });
      qc.invalidateQueries({ queryKey: ["shopping"] });
    },
  });
}

export function useDiscardPlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (planId: string) => {
      const supabase = createSupabaseBrowserClient();
      const { error } = await supabase.from("plan").delete().eq("id", planId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["plan"] });
    },
  });
}

export function useArchivePlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (planId: string) => {
      const supabase = createSupabaseBrowserClient();
      const { error } = await supabase
        .from("plan")
        .update({ status: "archived", archived_at: new Date().toISOString() })
        .eq("id", planId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["plan"] });
    },
  });
}
