"use client";

import { useQuery } from "@tanstack/react-query";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { qk } from "@/lib/query/keys";
import type { BlsFood } from "@/lib/db/types";

/**
 * Sucht im BLS nach `term` (Trigram-fuzzy + ilike). Limit 20.
 * Ergebnis ist debounced extern zu nutzen (z.B. via useDeferredValue oder
 * setTimeout).
 */
export function useBlsSearch(term: string) {
  const trimmed = term.trim();
  return useQuery({
    queryKey: qk.blsSearch(trimmed),
    enabled: trimmed.length >= 2,
    staleTime: 60_000,
    queryFn: async (): Promise<BlsFood[]> => {
      const supabase = createSupabaseBrowserClient();
      // Wir nutzen `ilike '%term%'` — Trigram-Index hilft bei längeren
      // Eingaben; der Postgres-Planner entscheidet das.
      const { data, error } = await supabase
        .from("bls_food")
        .select("bls_code,name_de,kcal_per_100g,protein_per_100g,carbs_per_100g,fat_per_100g")
        .ilike("name_de", `%${trimmed}%`)
        .order("name_de", { ascending: true })
        .limit(20);
      if (error) throw error;
      return data ?? [];
    },
  });
}
