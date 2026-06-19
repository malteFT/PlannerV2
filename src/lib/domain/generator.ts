/**
 * Plan-Generator (framework-frei).
 *
 * Aufgabe: Für N Tage × M Mahlzeiten-Slots ein Rezept pro Slot wählen,
 * sodass:
 *   - Kein Doppel-Rezept am selben Tag
 *   - Wiederholungen über den ganzen Plan minimiert werden (penalty)
 *   - Excluded Zutaten nicht enthalten sind (hartes Filter)
 *   - Suppressed Rezepte ignoriert werden (hartes Filter)
 *   - Meal-Type passt zum Slot (hartes Filter)
 *   - Portionsfaktor so gewählt wird, dass das kcal-Slot-Ziel exakt
 *     getroffen wird (sofern das Rezept überhaupt einen sinnvollen Faktor
 *     in [0.3, 3.0] erlaubt; sonst nimmt der nächstbeste Kandidat)
 *
 * Heuristik, kein Solver. Deterministisch, sobald `random` deterministisch
 * ist — wir nehmen einen seedbaren PRNG (mulberry32) für Tests.
 */

import type {
  IngredientUnit,
  IngredientWithBls,
  MealSlot,
  RecipeIngredientWithIngredient,
  RecipeWithIngredients,
} from "@/lib/db/types";
import { macrosPerServing } from "@/lib/domain/nutrition";

// =========================================================================
// Public API
// =========================================================================

export type GeneratorInput = {
  dayCount: number;
  mealSlots: MealSlot[];
  /** Anteil pro Slot in % (Summe = 100). Reihenfolge entspricht mealSlots. */
  mealSlotPct: number[];
  targetKcalPerDay: number;
  /** Toleranz in % (z.B. 5 → ±5 %). Aktuell informativ; harte Treffer durch Skalierung. */
  tolerancePct: number;
  /** Rezepte, die der Generator wählen darf (bereits gefiltert: keine excluded ingredients, nicht suppressed). */
  recipes: RecipeWithIngredients[];
  /** Optionaler Seed für deterministisches Ranking-Tiebreaking. */
  seed?: number;
};

export type GeneratedMeal = {
  dayIndex: number;
  mealSlot: MealSlot;
  recipeId: string;
  servingFactor: number;
};

export type GenerateError =
  | { kind: "no_candidates"; mealSlot: MealSlot; dayIndex: number }
  | { kind: "empty_recipes" };

export type GenerateResult =
  | { ok: true; meals: GeneratedMeal[] }
  | { ok: false; error: GenerateError };

const MIN_FACTOR = 0.3;
const MAX_FACTOR = 3.0;
const REPEAT_PENALTY_WEIGHT = 200; // grob: 1 Wiederholung == 1 ganzer kcal-Slot daneben
const RANDOM_TIEBREAK = 0.001;     // mikroskopisch klein; nur um Ties zu mischen

// =========================================================================
// Hauptfunktion
// =========================================================================

export function generatePlan(input: GeneratorInput): GenerateResult {
  const rand = mulberry32(input.seed ?? 1);

  if (input.recipes.length === 0) {
    return { ok: false, error: { kind: "empty_recipes" } };
  }

  // Pre-compute kcal pro Basisportion pro Rezept (1×).
  const kcalPerServingByRecipe = new Map<string, number>();
  for (const r of input.recipes) {
    const macros = macrosPerServing(
      r.ingredients as RecipeIngredientWithIngredient[],
      r.base_servings,
    );
    kcalPerServingByRecipe.set(r.id, macros.kcal);
  }

  // Pool je Slot.
  const poolBySlot = new Map<MealSlot, RecipeWithIngredients[]>();
  for (const slot of input.mealSlots) {
    poolBySlot.set(
      slot,
      input.recipes.filter((r) => r.meal_types.includes(slot)),
    );
  }

  const usageCount = new Map<string, number>(); // wie oft wurde Rezept im Plan schon gewählt?
  const meals: GeneratedMeal[] = [];

  for (let day = 0; day < input.dayCount; day++) {
    const usedToday = new Set<string>();

    for (let slotIdx = 0; slotIdx < input.mealSlots.length; slotIdx++) {
      const slot = input.mealSlots[slotIdx];
      const slotPct = input.mealSlotPct[slotIdx] ?? 0;
      const slotTargetKcal = (input.targetKcalPerDay * slotPct) / 100;

      const pool = poolBySlot.get(slot) ?? [];
      const candidates = pool.filter((r) => !usedToday.has(r.id));
      if (candidates.length === 0) {
        return { ok: false, error: { kind: "no_candidates", mealSlot: slot, dayIndex: day } };
      }

      // Score: niedrig = besser.
      // Komponente 1: |factor - 1| — wie weit muss skaliert werden, um kcal-Ziel zu treffen?
      // Komponente 2: usageCount × REPEAT_PENALTY_WEIGHT — Wiederholungen abstrafen.
      // Komponente 3: Kleines Random-Element für Ties.
      let bestRecipe: RecipeWithIngredients | null = null;
      let bestScore = Infinity;
      let bestFactor = 1;

      for (const r of candidates) {
        const kcalPerServing = kcalPerServingByRecipe.get(r.id) ?? 0;
        if (kcalPerServing <= 0) continue; // unbrauchbares Rezept (keine Nährwerte)

        const idealFactor = slotTargetKcal / kcalPerServing;
        const clampedFactor = Math.max(MIN_FACTOR, Math.min(MAX_FACTOR, idealFactor));

        // Wenn der Idealfaktor außerhalb der erlaubten Range liegt, treffen wir
        // das Ziel nicht exakt — das fließt in den Score.
        const fitPenalty = Math.abs(clampedFactor - 1);
        const repeatPenalty = (usageCount.get(r.id) ?? 0) * REPEAT_PENALTY_WEIGHT;
        const tiebreak = rand() * RANDOM_TIEBREAK;
        const score = fitPenalty + repeatPenalty + tiebreak;

        if (score < bestScore) {
          bestScore = score;
          bestRecipe = r;
          bestFactor = clampedFactor;
        }
      }

      if (!bestRecipe) {
        return { ok: false, error: { kind: "no_candidates", mealSlot: slot, dayIndex: day } };
      }

      meals.push({
        dayIndex: day,
        mealSlot: slot,
        recipeId: bestRecipe.id,
        servingFactor: roundFactor(bestFactor),
      });
      usedToday.add(bestRecipe.id);
      usageCount.set(bestRecipe.id, (usageCount.get(bestRecipe.id) ?? 0) + 1);
    }
  }

  return { ok: true, meals };
}

// =========================================================================
// Reroll: einen einzelnen Slot neu würfeln
// =========================================================================

export type RerollInput = GeneratorInput & {
  existingMeals: GeneratedMeal[];
  target: { dayIndex: number; mealSlot: MealSlot };
  /** Wenn true, darf das aktuell zugeordnete Rezept nicht wiedergewählt werden. */
  excludeCurrentRecipe?: boolean;
};

export type RerollResult =
  | { ok: true; meal: GeneratedMeal }
  | { ok: false; error: GenerateError };

export function rerollMeal(input: RerollInput): RerollResult {
  const rand = mulberry32((input.seed ?? 1) + input.target.dayIndex * 31 +
    slotIndex(input.mealSlots, input.target.mealSlot));

  if (input.recipes.length === 0) {
    return { ok: false, error: { kind: "empty_recipes" } };
  }

  const kcalPerServingByRecipe = new Map<string, number>();
  for (const r of input.recipes) {
    const macros = macrosPerServing(
      r.ingredients as RecipeIngredientWithIngredient[],
      r.base_servings,
    );
    kcalPerServingByRecipe.set(r.id, macros.kcal);
  }

  const slotIdx = input.mealSlots.indexOf(input.target.mealSlot);
  const slotPct = input.mealSlotPct[slotIdx] ?? 0;
  const slotTargetKcal = (input.targetKcalPerDay * slotPct) / 100;

  // Heutige Mahlzeiten → ausschließen
  const usedToday = new Set(
    input.existingMeals
      .filter((m) => m.dayIndex === input.target.dayIndex && m.mealSlot !== input.target.mealSlot)
      .map((m) => m.recipeId),
  );

  // Aktuelles Rezept ausschließen, wenn gewünscht
  const currentMeal = input.existingMeals.find(
    (m) => m.dayIndex === input.target.dayIndex && m.mealSlot === input.target.mealSlot,
  );
  if (input.excludeCurrentRecipe && currentMeal) {
    usedToday.add(currentMeal.recipeId);
  }

  // Wiederholungs-Counts aus existierenden Meals (ohne den aktuellen Slot)
  const usageCount = new Map<string, number>();
  for (const m of input.existingMeals) {
    if (m.dayIndex === input.target.dayIndex && m.mealSlot === input.target.mealSlot) continue;
    usageCount.set(m.recipeId, (usageCount.get(m.recipeId) ?? 0) + 1);
  }

  const pool = input.recipes.filter((r) => r.meal_types.includes(input.target.mealSlot));
  const candidates = pool.filter((r) => !usedToday.has(r.id));
  if (candidates.length === 0) {
    return {
      ok: false,
      error: { kind: "no_candidates", mealSlot: input.target.mealSlot, dayIndex: input.target.dayIndex },
    };
  }

  let bestRecipe: RecipeWithIngredients | null = null;
  let bestScore = Infinity;
  let bestFactor = 1;
  for (const r of candidates) {
    const kcalPerServing = kcalPerServingByRecipe.get(r.id) ?? 0;
    if (kcalPerServing <= 0) continue;
    const idealFactor = slotTargetKcal / kcalPerServing;
    const clampedFactor = Math.max(MIN_FACTOR, Math.min(MAX_FACTOR, idealFactor));
    const fitPenalty = Math.abs(clampedFactor - 1);
    const repeatPenalty = (usageCount.get(r.id) ?? 0) * REPEAT_PENALTY_WEIGHT;
    const tiebreak = rand() * RANDOM_TIEBREAK;
    const score = fitPenalty + repeatPenalty + tiebreak;
    if (score < bestScore) {
      bestScore = score;
      bestRecipe = r;
      bestFactor = clampedFactor;
    }
  }

  if (!bestRecipe) {
    return {
      ok: false,
      error: { kind: "no_candidates", mealSlot: input.target.mealSlot, dayIndex: input.target.dayIndex },
    };
  }

  return {
    ok: true,
    meal: {
      dayIndex: input.target.dayIndex,
      mealSlot: input.target.mealSlot,
      recipeId: bestRecipe.id,
      servingFactor: roundFactor(bestFactor),
    },
  };
}

// =========================================================================
// Helpers
// =========================================================================

function slotIndex(slots: MealSlot[], target: MealSlot): number {
  const i = slots.indexOf(target);
  return i < 0 ? 0 : i;
}

/** 3 Nachkommastellen — passend zur DB-Spalte `numeric(6,3)`. */
function roundFactor(f: number): number {
  return Math.round(f * 1000) / 1000;
}

/** Seedbarer PRNG. Für deterministische Tests. */
function mulberry32(seed: number) {
  let a = seed | 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Filter: Rezepte die mindestens eine excluded ingredient enthalten, ausschließen. */
export function filterRecipesByExcludedIngredients(
  recipes: RecipeWithIngredients[],
  excludedIngredientIds: string[],
): RecipeWithIngredients[] {
  if (excludedIngredientIds.length === 0) return recipes.slice();
  const set = new Set(excludedIngredientIds);
  return recipes.filter((r) => !r.ingredients.some((ri) => set.has(ri.ingredient_id)));
}

/** Filter für suppressed-Rezepte. */
export function filterSuppressedRecipes(
  recipes: RecipeWithIngredients[],
): RecipeWithIngredients[] {
  return recipes.filter((r) => !r.suppressed);
}

// =========================================================================
// Helpers für UI: Tagesweise Aggregation
// =========================================================================

export type DayAggregate = {
  dayIndex: number;
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
};

export function aggregatePerDay(
  meals: GeneratedMeal[],
  recipes: RecipeWithIngredients[],
): DayAggregate[] {
  const recipeMap = new Map(recipes.map((r) => [r.id, r] as const));
  const byDay = new Map<number, DayAggregate>();
  for (const m of meals) {
    const r = recipeMap.get(m.recipeId);
    if (!r) continue;
    const macros = macrosPerServing(
      r.ingredients as RecipeIngredientWithIngredient[],
      r.base_servings,
    );
    const day =
      byDay.get(m.dayIndex) ??
      { dayIndex: m.dayIndex, kcal: 0, protein: 0, carbs: 0, fat: 0 };
    day.kcal += macros.kcal * m.servingFactor;
    day.protein += macros.protein * m.servingFactor;
    day.carbs += macros.carbs * m.servingFactor;
    day.fat += macros.fat * m.servingFactor;
    byDay.set(m.dayIndex, day);
  }
  return Array.from(byDay.values()).sort((a, b) => a.dayIndex - b.dayIndex);
}

// Re-Export für Convenience
export type { MealSlot, IngredientUnit };
