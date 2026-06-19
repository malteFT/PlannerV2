/**
 * Reine Domain-Logik für Nährwert-, Mengen- und Einheiten-Berechnung.
 *
 * Framework-frei und ohne Supabase-Abhängigkeiten — testbar in Isolation.
 */

import type {
  IngredientUnit,
  IngredientWithBls,
  RecipeIngredientWithIngredient,
} from "@/lib/db/types";

export type Macros = {
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
};

export const ZERO_MACROS: Macros = {
  kcal: 0,
  protein: 0,
  carbs: 0,
  fat: 0,
};

/**
 * Konvertiert eine Menge in Gramm — die einzige sinnvolle Basis für
 * Nährwertberechnung gegen den BLS (kcal pro 100 g).
 *
 * Annahmen:
 *   - "g": Wert direkt
 *   - "ml": Annahme Dichte = 1 (Wasser-äquivalent). MVP-Vereinfachung.
 *   - "piece": amount × ingredient.grams_per_piece. Wenn nicht gesetzt → 0.
 */
export function toGrams(
  amount: number,
  unit: IngredientUnit,
  ingredient: Pick<IngredientWithBls, "grams_per_piece">,
): number {
  if (!Number.isFinite(amount) || amount <= 0) return 0;
  if (unit === "g") return amount;
  if (unit === "ml") return amount;
  if (unit === "piece") {
    const g = ingredient.grams_per_piece ?? 0;
    return amount * g;
  }
  return 0;
}

/**
 * Nährwerte für eine konkrete Menge einer Zutat berechnen.
 */
export function macrosForIngredientAmount(
  amount: number,
  unit: IngredientUnit,
  ingredient: IngredientWithBls,
): Macros {
  const grams = toGrams(amount, unit, ingredient);
  if (grams <= 0) return { ...ZERO_MACROS };
  const factor = grams / 100;
  return {
    kcal: ingredient.bls.kcal_per_100g * factor,
    protein: ingredient.bls.protein_per_100g * factor,
    carbs: ingredient.bls.carbs_per_100g * factor,
    fat: ingredient.bls.fat_per_100g * factor,
  };
}

/**
 * Summe der Nährwerte für ein komplettes Rezept (pro Basisportion).
 *
 * baseServings ist die Bezugsportionen-Zahl — wir geben pro Portion
 * zurück, also Summe / baseServings.
 */
export function macrosPerServing(
  ingredients: RecipeIngredientWithIngredient[],
  baseServings: number,
): Macros {
  if (baseServings <= 0) return { ...ZERO_MACROS };
  const total = ingredients.reduce<Macros>((acc, ri) => {
    const m = macrosForIngredientAmount(ri.amount, ri.unit, ri.ingredient);
    return {
      kcal: acc.kcal + m.kcal,
      protein: acc.protein + m.protein,
      carbs: acc.carbs + m.carbs,
      fat: acc.fat + m.fat,
    };
  }, { ...ZERO_MACROS });
  return {
    kcal: total.kcal / baseServings,
    protein: total.protein / baseServings,
    carbs: total.carbs / baseServings,
    fat: total.fat / baseServings,
  };
}

/**
 * Skalierte Nährwerte einer Mahlzeit (Portionsfaktor).
 */
export function macrosForMeal(
  ingredients: RecipeIngredientWithIngredient[],
  baseServings: number,
  servingFactor: number,
): Macros {
  const perServing = macrosPerServing(ingredients, baseServings);
  return {
    kcal: perServing.kcal * servingFactor,
    protein: perServing.protein * servingFactor,
    carbs: perServing.carbs * servingFactor,
    fat: perServing.fat * servingFactor,
  };
}

/**
 * Hilfs-Formatter für die UI.
 */
export function formatKcal(v: number): string {
  return `${Math.round(v)} kcal`;
}

export function formatGrams(v: number): string {
  return `${v.toFixed(1)} g`;
}
