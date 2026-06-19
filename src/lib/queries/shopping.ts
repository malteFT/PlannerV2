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
      unit: "g" | "ml" | "piece";
    }) => {
      const supabase = createSupabaseBrowserClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Nicht angemeldet");
      const { error } = await supabase
        .from("shopping_list_item")
        .upsert(
          {
            user_id: user.id,
            plan_id: input.planId,
            ingredient_id: input.ingredientId,
            required_amount: input.amount,
            to_buy_amount: input.amount,
            unit: input.unit,
            manual: true,
            checked: false,
          },
          { onConflict: "plan_id,ingredient_id" },
        );
      if (error) throw error;
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
