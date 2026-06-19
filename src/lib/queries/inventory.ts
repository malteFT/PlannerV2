"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import type { InventoryItemWithIngredient } from "@/lib/db/types";

export const inventoryKeys = {
  list: ["inventory", "list"] as const,
};

const SELECT_INVENTORY = `
  user_id,ingredient_id,amount,updated_at,
  ingredient:ingredient!inner(
    id,user_id,display_name,bls_code,default_unit,grams_per_piece,category,excluded,created_at,updated_at,
    bls:bls_food!inner(bls_code,name_de,kcal_per_100g,protein_per_100g,carbs_per_100g,fat_per_100g)
  )
`;

export function useInventory() {
  return useQuery({
    queryKey: inventoryKeys.list,
    queryFn: async (): Promise<InventoryItemWithIngredient[]> => {
      const supabase = createSupabaseBrowserClient();
      const { data, error } = await supabase
        .from("inventory_item")
        .select(SELECT_INVENTORY)
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as InventoryItemWithIngredient[];
    },
  });
}

export function useUpsertInventory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { ingredientId: string; amount: number }) => {
      const supabase = createSupabaseBrowserClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Nicht angemeldet");
      const { error } = await supabase
        .from("inventory_item")
        .upsert(
          {
            user_id: user.id,
            ingredient_id: input.ingredientId,
            amount: Math.max(0, input.amount),
          },
          { onConflict: "user_id,ingredient_id" },
        );
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["inventory"] });
    },
  });
}

export function useDeleteInventoryItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (ingredientId: string) => {
      const supabase = createSupabaseBrowserClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Nicht angemeldet");
      const { error } = await supabase
        .from("inventory_item")
        .delete()
        .eq("user_id", user.id)
        .eq("ingredient_id", ingredientId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["inventory"] });
    },
  });
}
