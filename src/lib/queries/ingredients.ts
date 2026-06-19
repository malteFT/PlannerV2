"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { qk } from "@/lib/query/keys";
import type { Ingredient, IngredientWithBls } from "@/lib/db/types";
import type { IngredientFormValues } from "@/lib/validators";

const SELECT_INGREDIENT_WITH_BLS = `
  id,user_id,display_name,bls_code,default_unit,grams_per_piece,category,excluded,aliases,created_at,updated_at,
  bls:bls_food!inner(bls_code,name_de,kcal_per_100g,protein_per_100g,carbs_per_100g,fat_per_100g)
`;

export function useIngredients(search?: string) {
  return useQuery({
    queryKey: qk.ingredients(search),
    queryFn: async (): Promise<IngredientWithBls[]> => {
      const supabase = createSupabaseBrowserClient();
      // Wir holen IMMER alle (User-eigenen) Zutaten und filtern client-seitig
      // — das ist konsistent mit der Picker-Suche (display_name + aliases)
      // und einfacher als ein Multi-Spalten-OR mit ilike auf Array-Items.
      // Bei Single-User mit ~50-200 Zutaten ist das Datenvolumen unkritisch.
      const { data, error } = await supabase
        .from("ingredient")
        .select(SELECT_INGREDIENT_WITH_BLS)
        .order("display_name", { ascending: true });
      if (error) throw error;
      const all = (data ?? []) as unknown as IngredientWithBls[];
      const term = search?.trim().toLowerCase();
      if (!term) return all;
      return all.filter((i) => {
        if (i.display_name.toLowerCase().includes(term)) return true;
        for (const a of i.aliases ?? []) {
          if (a.toLowerCase().includes(term)) return true;
        }
        return false;
      });
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
        aliases: normalizeAliases(values.aliases ?? []),
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
        aliases: normalizeAliases(values.aliases ?? []),
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

/**
 * Normalisiert Aliase: trim, leere entfernen, Duplikate (case-insensitive)
 * entfernen, Reihenfolge erhalten.
 */
export function normalizeAliases(input: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of input) {
    const trimmed = raw.trim();
    if (!trimmed) continue;
    const key = trimmed.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(trimmed);
  }
  return out;
}
