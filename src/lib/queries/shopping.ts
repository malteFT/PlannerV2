"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import type { ShoppingListItemWithIngredient } from "@/lib/db/types";

export const shoppingKeys = {
  byPlan: (planId: string | undefined) =>
    ["shopping", "by-plan", planId ?? ""] as const,
};

const SELECT_SHOPPING_WITH_INGREDIENT = `
  id,user_id,plan_id,ingredient_id,required_amount,to_buy_amount,unit,checked,checked_at,manual,created_at,
  ingredient:ingredient!inner(
    id,user_id,display_name,bls_code,default_unit,grams_per_piece,category,excluded,created_at,updated_at,
    bls:bls_food!inner(bls_code,name_de,kcal_per_100g,protein_per_100g,carbs_per_100g,fat_per_100g)
  )
`;

export function useShoppingList(planId: string | undefined) {
  return useQuery({
    queryKey: shoppingKeys.byPlan(planId),
    enabled: !!planId,
    queryFn: async (): Promise<ShoppingListItemWithIngredient[]> => {
      const supabase = createSupabaseBrowserClient();
      const { data, error } = await supabase
        .from("shopping_list_item")
        .select(SELECT_SHOPPING_WITH_INGREDIENT)
        .eq("plan_id", planId!)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as ShoppingListItemWithIngredient[];
    },
  });
}

export function useCheckShoppingItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (itemId: string) => {
      const supabase = createSupabaseBrowserClient();
      const { error } = await supabase.rpc("check_shopping_item", {
        p_item_id: itemId,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["shopping"] });
      qc.invalidateQueries({ queryKey: ["inventory"] });
    },
  });
}

export function useUncheckShoppingItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (itemId: string) => {
      const supabase = createSupabaseBrowserClient();
      const { error } = await supabase.rpc("uncheck_shopping_item", {
        p_item_id: itemId,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["shopping"] });
      qc.invalidateQueries({ queryKey: ["inventory"] });
    },
  });
}

export function useAddManualShoppingItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      planId: string;
      ingredientId: string;
      amount: number;
    }) => {
      const supabase = createSupabaseBrowserClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Nicht angemeldet");

      // Unit wird immer aus ingredient.default_unit gelesen — keine User-Wahl,
      // damit pro Zutat genau eine Einheit in der Liste steht.
      const ingResp = await supabase
        .from("ingredient")
        .select("default_unit")
        .eq("id", input.ingredientId)
        .single();
      if (ingResp.error) throw ingResp.error;
      const unit = ingResp.data.default_unit as "g" | "ml" | "piece";

      // Vorrat (für to_buy-Berechnung)
      const invResp = await supabase
        .from("inventory_item")
        .select("amount")
        .eq("user_id", user.id)
        .eq("ingredient_id", input.ingredientId)
        .maybeSingle();
      if (invResp.error) throw invResp.error;
      const inventoryAmount = invResp.data?.amount ?? 0;

      // Bestehenden Eintrag suchen
      const existing = await supabase
        .from("shopping_list_item")
        .select("id, required_amount, manual, checked")
        .eq("plan_id", input.planId)
        .eq("ingredient_id", input.ingredientId)
        .maybeSingle();
      if (existing.error) throw existing.error;

      if (existing.data) {
        // Aufaddieren (anstatt überschreiben)
        const newRequired = (existing.data.required_amount ?? 0) + input.amount;
        const newToBuy = Math.max(0, newRequired - inventoryAmount);
        const { error } = await supabase
          .from("shopping_list_item")
          .update({
            required_amount: newRequired,
            to_buy_amount: newToBuy,
            unit,
            manual: existing.data.manual,
          })
          .eq("id", existing.data.id);
        if (error) throw error;
      } else {
        const newToBuy = Math.max(0, input.amount - inventoryAmount);
        const { error } = await supabase.from("shopping_list_item").insert({
          user_id: user.id,
          plan_id: input.planId,
          ingredient_id: input.ingredientId,
          required_amount: input.amount,
          to_buy_amount: newToBuy,
          unit,
          manual: true,
          checked: false,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["shopping"] });
    },
  });
}

export function useDeleteShoppingItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (itemId: string) => {
      const supabase = createSupabaseBrowserClient();
      const { error } = await supabase
        .from("shopping_list_item")
        .delete()
        .eq("id", itemId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["shopping"] });
    },
  });
}
