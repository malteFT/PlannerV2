"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { qk } from "@/lib/query/keys";
import type { Ingredient, IngredientWithBls } from "@/lib/db/types";
import type { IngredientFormValues } from "@/lib/validators";

const SELECT_INGREDIENT_WITH_BLS = `
  id,user_id,display_name,bls_code,default_unit,grams_per_piece,category,excluded,created_at,updated_at,
  bls:bls_food!inner(bls_code,name_de,kcal_per_100g,protein_per_100g,carbs_per_100g,fat_per_100g)
`;

export function useIngredients(search?: string) {
  return useQuery({
    queryKey: qk.ingredients(search),
    queryFn: async (): Promise<IngredientWithBls[]> => {
      const supabase = createSupabaseBrowserClient();
      let q = supabase
        .from("ingredient")
        .select(SELECT_INGREDIENT_WITH_BLS)
        .order("display_name", { ascending: true });
      if (search && search.trim()) {
        q = q.ilike("display_name", `%${search.trim()}%`);
      }
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as unknown as IngredientWithBls[];
    },
  });
}

export function useIngredient(id: string | undefined) {
  return useQuery({
    queryKey: qk.ingredient(id ?? ""),
    enabled: !!id,
    queryFn: async (): Promise<IngredientWithBls | null> => {
      const supabase = createSupabaseBrowserClient();
      const { data, error } = await supabase
        .from("ingredient")
        .select(SELECT_INGREDIENT_WITH_BLS)
        .eq("id", id!)
        .maybeSingle();
      if (error) throw error;
      return (data as unknown as IngredientWithBls) ?? null;
    },
  });
}

export function useIngredientUsage(id: string | undefined) {
  return useQuery({
    queryKey: qk.ingredientUsage(id ?? ""),
    enabled: !!id,
    queryFn: async () => {
      const supabase = createSupabaseBrowserClient();
      const { data, error } = await supabase
        .from("recipe_ingredient")
        .select("recipe:recipe!inner(id,name)")
        .eq("ingredient_id", id!);
      if (error) throw error;
      return (data ?? []).map((r) => r.recipe) as unknown as Array<{
        id: string;
        name: string;
      }>;
    },
  });
}

export function useCreateIngredient() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (values: IngredientFormValues): Promise<Ingredient> => {
      const supabase = createSupabaseBrowserClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Nicht angemeldet");
      const payload = {
        user_id: user.id,
        display_name: values.display_name,
        bls_code: values.bls_code,
        default_unit: values.default_unit,
        grams_per_piece:
          values.default_unit === "piece" ? values.grams_per_piece ?? null : null,
        category: values.category,
        excluded: values.excluded ?? false,
      };
      const { data, error } = await supabase
        .from("ingredient")
        .insert(payload)
        .select("*")
        .single();
      if (error) throw error;
      return data as Ingredient;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ingredients"] });
    },
  });
}

export function useUpdateIngredient(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (values: IngredientFormValues): Promise<Ingredient> => {
      const supabase = createSupabaseBrowserClient();
      const payload = {
        display_name: values.display_name,
        bls_code: values.bls_code,
        default_unit: values.default_unit,
        grams_per_piece:
          values.default_unit === "piece" ? values.grams_per_piece ?? null : null,
        category: values.category,
        excluded: values.excluded ?? false,
      };
      const { data, error } = await supabase
        .from("ingredient")
        .update(payload)
        .eq("id", id)
        .select("*")
        .single();
      if (error) throw error;
      return data as Ingredient;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ingredients"] });
      qc.invalidateQueries({ queryKey: qk.ingredient(id) });
      qc.invalidateQueries({ queryKey: ["recipes"] });
    },
  });
}

export function useDeleteIngredient() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string): Promise<void> => {
      const supabase = createSupabaseBrowserClient();
      const { error } = await supabase.from("ingredient").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ingredients"] });
    },
  });
}
