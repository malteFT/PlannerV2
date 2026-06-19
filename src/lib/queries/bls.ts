"use client";

import { useQuery } from "@tanstack/react-query";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { qk } from "@/lib/query/keys";
import type { BlsFood } from "@/lib/db/types";

/**
 * Sucht im BLS nach `term` (Substring-Match auf name_de) und sortiert die
 * Treffer so, dass:
 *   1. Prefix-Treffer (Name beginnt mit Term) zuerst
 *   2. Wort-Prefix-Treffer (irgendein Wort beginnt mit Term)
 *   3. Reine Substring-Treffer
 * Innerhalb jeder Gruppe alphabetisch.
 *
 * Wir holen bis zu 100 Datenbank-Treffer und sortieren clientseitig.
 * Bei 14k BLS-Einträgen mit Trigram-Index reicht das problemlos.
 */
const FETCH_LIMIT = 100;
const DISPLAY_LIMIT = 25;

export function useBlsSearch(term: string) {
  const trimmed = term.trim();
  return useQuery({
    queryKey: qk.blsSearch(trimmed),
    enabled: trimmed.length >= 2,
    staleTime: 60_000,
    queryFn: async (): Promise<BlsFood[]> => {
      const supabase = createSupabaseBrowserClient();
      const { data, error } = await supabase
        .from("bls_food")
        .select(
          "bls_code,name_de,kcal_per_100g,protein_per_100g,carbs_per_100g,fat_per_100g",
        )
        .ilike("name_de", `%${trimmed}%`)
        .limit(FETCH_LIMIT);
      if (error) throw error;
      return rankBlsResults(data ?? [], trimmed).slice(0, DISPLAY_LIMIT);
    },
  });
}

/**
 * 0 = Prefix-Treffer (Name beginnt mit term)
 * 1 = Wort-Prefix-Treffer (irgendein Token im Namen beginnt mit term)
 * 2 = sonst (Substring)
 */
function relevanceBucket(name: string, term: string): number {
  const lower = name.toLowerCase();
  const t = term.toLowerCase();
  if (lower.startsWith(t)) return 0;
  // Trennzeichen, an denen wir Wörter splitten:
  // Whitespace, Komma, Bindestrich, Schrägstrich.
  const tokens = lower.split(/[\s,/\-]+/).filter(Boolean);
  if (tokens.some((tok) => tok.startsWith(t))) return 1;
  return 2;
}

export function rankBlsResults(rows: BlsFood[], term: string): BlsFood[] {
  return [...rows].sort((a, b) => {
    const ba = relevanceBucket(a.name_de, term);
    const bb = relevanceBucket(b.name_de, term);
    if (ba !== bb) return ba - bb;
    return a.name_de.localeCompare(b.name_de, "de");
  });
}
