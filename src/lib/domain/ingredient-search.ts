/**
 * Suchhelfer für Zutaten: matcht ein Suchterm gegen display_name und aliases.
 * Case-insensitive, Substring.
 *
 * Verwendung: client-seitig im Rezept-Editor-Picker, wo wir die User-eigenen
 * Zutaten ohnehin geladen haben (useIngredients()).
 */

import type { Ingredient } from "@/lib/db/types";

export function ingredientMatchesQuery(
  ingredient: Pick<Ingredient, "display_name" | "aliases">,
  query: string,
): boolean {
  const q = query.trim().toLowerCase();
  if (q === "") return true;
  if (ingredient.display_name.toLowerCase().includes(q)) return true;
  for (const alias of ingredient.aliases ?? []) {
    if (alias.toLowerCase().includes(q)) return true;
  }
  return false;
}

/**
 * Ranking analog rankBlsResults (Prefix > Wort-Prefix > Substring).
 * Berücksichtigt Aliases — der beste Match aus name + aliases zählt.
 */
export function ingredientRelevanceBucket(
  ingredient: Pick<Ingredient, "display_name" | "aliases">,
  query: string,
): number {
  const q = query.trim().toLowerCase();
  if (q === "") return 2;

  const candidates = [
    ingredient.display_name,
    ...(ingredient.aliases ?? []),
  ];

  let best = 3; // 3 = no match
  for (const c of candidates) {
    const lower = c.toLowerCase();
    if (lower.startsWith(q)) {
      best = Math.min(best, 0);
      continue;
    }
    const tokens = lower.split(/[\s,/\-]+/).filter(Boolean);
    if (tokens.some((t) => t.startsWith(q))) {
      best = Math.min(best, 1);
      continue;
    }
    if (lower.includes(q)) {
      best = Math.min(best, 2);
    }
  }
  return best;
}
