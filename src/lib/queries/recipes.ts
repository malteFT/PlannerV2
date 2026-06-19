"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { qk } from "@/lib/query/keys";
import type { MealSlot, RecipeWithIngredients } from "@/lib/db/types";
import type { RecipeFormValues } from "@/lib/validators";

const SELECT_RECIPE_WITH_INGREDIENTS = `
  id,user_id,name,meal_types,base_servings,instructions,suppressed,created_at,updated_at,
  ingredients:recipe_ingredient(
    recipe_id,ingredient_id,amount,unit,position,
    ingredient:ingredient!inner(
      id,user_id,display_name,bls_code,default_unit,grams_per_piece,category,excluded,created_at,updated_at,
      bls:bls_food!inner(bls_code,name_de,kcal_per_100g,protein_per_100g,carbs_per_100g,fat_per_100g)
    )
  )
`;

export type RecipeFilter = {
  query?: string;
  mealType?: MealSlot;
  includeSuppressed?: boolean;
};

export function useRecipes(filter?: RecipeFilter) {
  return useQuery({
    queryKey: qk.recipes(filter),
    queryFn: async (): Promise<RecipeWithIngredients[]> => {
      const supabase = createSupabaseBrowserClient();
      let q = supabase
        .from("recipe")
        .select(SELECT_RECIPE_WITH_INGREDIENTS)
        .order("name", { ascending: true });
      if (filter?.query?.trim()) {
        q = q.ilike("name", `%${filter.query.trim()}%`);
      }
      if (filter?.mealType) {
        q = q.contains("meal_types", [filter.mealType]);
      }
      if (!filter?.includeSuppressed) {
        q = q.eq("suppressed", false);
      }
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as unknown as RecipeWithIngredients[];
    },
  });
}

export function useRecipe(id: string | undefined) {
  return useQuery({
    queryKey: qk.recipe(id ?? ""),
    enabled: !!id,
    queryFn: async (): Promise<RecipeWithIngredients | null> => {
      const supabase = createSupabaseBrowserClient();
      const { data, error } = await supabase
        .from("recipe")
        .select(SELECT_RECIPE_WITH_INGREDIENTS)
        .eq("id", id!)
        .maybeSingle();
      if (error) throw error;
      return (data as unknown as RecipeWithIngredients) ?? null;
    },
  });
}

async function writeRecipeIngredients(
  recipeId: string,
  items: RecipeFormValues["ingredients"],
) {
  const supabase = createSupabaseBrowserClient();
  // Strategie: alle bestehenden zu diesem Rezept löschen, dann neu schreiben.
  // Robust und einfach; Junction ist schmal.
  const del = await supabase
    .from("recipe_ingredient")
    .delete()
    .eq("recipe_id", recipeId);
  if (del.error) throw del.error;
  if (items.length === 0) return;
  const rows = items.map((it, idx) => ({
    recipe_id: recipeId,
    ingredient_id: it.ingredient_id,
    amount: it.amount,
    unit: it.unit,
    position: idx,
  }));
  const ins = await supabase.from("recipe_ingredient").insert(rows);
  if (ins.error) throw ins.error;
}

export function useCreateRecipe() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (values: RecipeFormValues): Promise<string> => {
      const supabase = createSupabaseBrowserClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Nicht angemeldet");
      const { data, error } = await supabase
        .from("recipe")
        .insert({
          user_id: user.id,
          name: values.name,
          meal_types: values.meal_types,
          base_servings: values.base_servings,
          instructions: values.instructions ?? "",
          suppressed: values.suppressed ?? false,
        })
        .select("id")
        .single();
      if (error) throw error;
      const recipeId = (data as { id: string }).id;
      await writeRecipeIngredients(recipeId, values.ingredients);
      return recipeId;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["recipes"] });
    },
  });
}

export function useUpdateRecipe(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (values: RecipeFormValues) => {
      const supabase = createSupabaseBrowserClient();
      const { error } = await supabase
        .from("recipe")
        .update({
          name: values.name,
          meal_types: values.meal_types,
          base_servings: values.base_servings,
          instructions: values.instructions ?? "",
          suppressed: values.suppressed ?? false,
        })
        .eq("id", id);
      if (error) throw error;
      await writeRecipeIngredients(id, values.ingredients);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["recipes"] });
      qc.invalidateQueries({ queryKey: qk.recipe(id) });
    },
  });
}

export function useDeleteRecipe() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const supabase = createSupabaseBrowserClient();
      const { error } = await supabase.from("recipe").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["recipes"] });
    },
  });
}

export function useToggleSuppressed(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (suppressed: boolean) => {
      const supabase = createSupabaseBrowserClient();
      const { error } = await supabase
        .from("recipe")
        .update({ suppressed })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["recipes"] });
      qc.invalidateQueries({ queryKey: qk.recipe(id) });
    },
  });
}
