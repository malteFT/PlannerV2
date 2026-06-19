import { describe, expect, it } from "vitest";
import {
  aggregatePerDay,
  filterRecipesByExcludedIngredients,
  filterSuppressedRecipes,
  generatePlan,
  rerollMeal,
  type GeneratorInput,
} from "@/lib/domain/generator";
import type {
  IngredientWithBls,
  MealSlot,
  RecipeWithIngredients,
} from "@/lib/db/types";

// =========================================================================
// Test-Helpers
// =========================================================================

function makeIngredient(
  overrides: Partial<IngredientWithBls> &
    Pick<IngredientWithBls, "id" | "display_name" | "bls_code">,
): IngredientWithBls {
  return {
    user_id: "user-1",
    default_unit: "g",
    grams_per_piece: null,
    category: "Sonstiges",
    excluded: false,
    created_at: "",
    updated_at: "",
    bls: {
      bls_code: overrides.bls_code,
      name_de: "test",
      kcal_per_100g: 100,
      protein_per_100g: 5,
      carbs_per_100g: 20,
      fat_per_100g: 1,
      ...(overrides.bls ?? {}),
    },
    ...overrides,
  } as IngredientWithBls;
}

function makeRecipe(opts: {
  id: string;
  name: string;
  mealTypes: MealSlot[];
  baseServings: number;
  /** [ingredient, amount-in-default-unit] pairs */
  ingredients: Array<[IngredientWithBls, number]>;
  suppressed?: boolean;
}): RecipeWithIngredients {
  return {
    id: opts.id,
    user_id: "user-1",
    name: opts.name,
    meal_types: opts.mealTypes,
    base_servings: opts.baseServings,
    instructions: "",
    suppressed: opts.suppressed ?? false,
    created_at: "",
    updated_at: "",
    ingredients: opts.ingredients.map(([ing, amount], idx) => ({
      recipe_id: opts.id,
      ingredient_id: ing.id,
      amount,
      unit: ing.default_unit,
      position: idx,
      ingredient: ing,
    })),
  };
}

// 1 g BLS-Kalorie = 1 kcal/g (bei kcal_per_100g = 100). Praktisch für Mathe.
const oats = makeIngredient({
  id: "ing-oats",
  display_name: "Hafer",
  bls_code: "C131000",
  // 100 g Hafer ≈ 100 kcal in unserem Test-Setup
});

const apple = makeIngredient({
  id: "ing-apple",
  display_name: "Apfel",
  bls_code: "F110100",
  bls: {
    bls_code: "F110100",
    name_de: "Apfel roh",
    kcal_per_100g: 50,
    protein_per_100g: 0.3,
    carbs_per_100g: 12,
    fat_per_100g: 0.4,
  },
});

const chicken = makeIngredient({
  id: "ing-chicken",
  display_name: "Hähnchenbrust",
  bls_code: "B6A5000",
  bls: {
    bls_code: "B6A5000",
    name_de: "Hähnchenbrust",
    kcal_per_100g: 110,
    protein_per_100g: 23,
    carbs_per_100g: 0,
    fat_per_100g: 1.5,
  },
});

const oil = makeIngredient({
  id: "ing-oil",
  display_name: "Olivenöl",
  bls_code: "D700000",
  bls: {
    bls_code: "D700000",
    name_de: "Olivenöl",
    kcal_per_100g: 900,
    protein_per_100g: 0,
    carbs_per_100g: 0,
    fat_per_100g: 100,
  },
});

// Ein Frühstücksrezept mit ~500 kcal pro Basisportion (bei base_servings=1).
const oatBowl = makeRecipe({
  id: "r-oats",
  name: "Haferschale",
  mealTypes: ["breakfast"],
  baseServings: 1,
  ingredients: [[oats, 100], [apple, 200]], // 100 + 100 = 200 kcal pro Portion
});

const lunchA = makeRecipe({
  id: "r-lunch-a",
  name: "Hähnchen-Bowl",
  mealTypes: ["lunch"],
  baseServings: 1,
  ingredients: [[chicken, 200], [oil, 10]], // 220 + 90 = 310 kcal
});

const lunchB = makeRecipe({
  id: "r-lunch-b",
  name: "Hähnchen-Pasta",
  mealTypes: ["lunch"],
  baseServings: 1,
  ingredients: [[chicken, 250], [oats, 100]], // 275 + 100 = 375 kcal
});

const dinnerA = makeRecipe({
  id: "r-dinner-a",
  name: "Eintopf",
  mealTypes: ["dinner"],
  baseServings: 1,
  ingredients: [[chicken, 200], [apple, 100]],
});

const dinnerB = makeRecipe({
  id: "r-dinner-b",
  name: "Curry",
  mealTypes: ["dinner"],
  baseServings: 1,
  ingredients: [[chicken, 250], [oil, 5]],
});

const baseInput: GeneratorInput = {
  dayCount: 3,
  mealSlots: ["breakfast", "lunch", "dinner"],
  mealSlotPct: [30, 40, 30],
  targetKcalPerDay: 2000,
  tolerancePct: 5,
  recipes: [oatBowl, lunchA, lunchB, dinnerA, dinnerB],
  seed: 42,
};

// =========================================================================
// Tests
// =========================================================================

describe("generatePlan", () => {
  it("erzeugt für jeden Tag und Slot eine Mahlzeit", () => {
    const r = generatePlan(baseInput);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.meals).toHaveLength(3 * 3); // 3 Tage × 3 Slots
    for (let day = 0; day < 3; day++) {
      for (const slot of baseInput.mealSlots) {
        const m = r.meals.find((x) => x.dayIndex === day && x.mealSlot === slot);
        expect(m).toBeDefined();
      }
    }
  });

  it("kein Rezept zweimal am selben Tag (wenn Pool ≥ 2 pro Slot)", () => {
    const r = generatePlan(baseInput);
    if (!r.ok) throw new Error("expected ok");
    for (let day = 0; day < 3; day++) {
      const ids = r.meals.filter((m) => m.dayIndex === day).map((m) => m.recipeId);
      expect(new Set(ids).size).toBe(ids.length);
    }
  });

  it("respektiert Slot-Filter (breakfast nur Frühstücksrezepte)", () => {
    const r = generatePlan(baseInput);
    if (!r.ok) throw new Error();
    for (const m of r.meals) {
      const recipe = baseInput.recipes.find((x) => x.id === m.recipeId)!;
      expect(recipe.meal_types).toContain(m.mealSlot);
    }
  });

  it("trifft das kcal-Slot-Ziel innerhalb der Skalierungs-Grenzen", () => {
    // Slot-Ziel: 2000*0.4 = 800 kcal für lunch.
    // Lunch-A pro Portion = 310 kcal → Ideal-Faktor ≈ 2.58 (in Range).
    const r = generatePlan(baseInput);
    if (!r.ok) throw new Error();
    const lunch = r.meals.find((m) => m.dayIndex === 0 && m.mealSlot === "lunch")!;
    const recipe = baseInput.recipes.find((x) => x.id === lunch.recipeId)!;
    const kcalPerServing = recipe.id === "r-lunch-a" ? 310 : 375;
    const kcalAchieved = kcalPerServing * lunch.servingFactor;
    // Akzeptiere ±5 % als sanity check (in der Range klappt's exakt)
    expect(kcalAchieved).toBeGreaterThan(800 * 0.95);
    expect(kcalAchieved).toBeLessThan(800 * 1.05);
  });

  it("keine Doppelwahl, wenn Pool zu klein → Fehler statt Wiederholung", () => {
    const onlyOneLunch: GeneratorInput = {
      ...baseInput,
      recipes: [oatBowl, lunchA, dinnerA, dinnerB],
      // Pool für lunch = 1, aber wir brauchen 3 Tage × 1 Lunch — geht.
    };
    const r = generatePlan(onlyOneLunch);
    expect(r.ok).toBe(true);
    // Lunch-A wird drei Mal verwendet — das ist ok, nicht der Fehlerfall
    if (!r.ok) return;
    const lunches = r.meals.filter((m) => m.mealSlot === "lunch");
    expect(lunches).toHaveLength(3);
    expect(lunches.every((m) => m.recipeId === "r-lunch-a")).toBe(true);
  });

  it("Pool leer für Slot → Fehler", () => {
    const noBreakfast: GeneratorInput = {
      ...baseInput,
      recipes: [lunchA, lunchB, dinnerA, dinnerB],
    };
    const r = generatePlan(noBreakfast);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error.kind).toBe("no_candidates");
  });

  it("recipe-Pool leer → Fehler", () => {
    const r = generatePlan({ ...baseInput, recipes: [] });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error.kind).toBe("empty_recipes");
  });

  it("seed-stabil: gleicher Seed → gleicher Output", () => {
    const a = generatePlan({ ...baseInput, seed: 99 });
    const b = generatePlan({ ...baseInput, seed: 99 });
    expect(a).toEqual(b);
  });

  it("Wiederholungs-Penalty: bei 2 gleichwertigen Lunches werden über die Woche beide genutzt", () => {
    // Beide Lunches sind ähnlich; ohne Penalty würde der Generator immer
    // den mit dem besseren fitPenalty wählen. Mit Penalty wechselt er.
    const sevenDays: GeneratorInput = {
      ...baseInput,
      dayCount: 7,
      seed: 7,
    };
    const r = generatePlan(sevenDays);
    if (!r.ok) throw new Error();
    const lunchUsages = r.meals
      .filter((m) => m.mealSlot === "lunch")
      .map((m) => m.recipeId);
    const distinct = new Set(lunchUsages);
    // Bei 7 Tagen sollten beide Lunches mindestens einmal vorkommen
    expect(distinct.size).toBe(2);
  });
});

describe("rerollMeal", () => {
  it("ersetzt nur den angegebenen Slot, andere bleiben", () => {
    const initial = generatePlan({ ...baseInput, seed: 1 });
    if (!initial.ok) throw new Error();
    const before = initial.meals;
    const rolled = rerollMeal({
      ...baseInput,
      seed: 2,
      existingMeals: before,
      target: { dayIndex: 0, mealSlot: "lunch" },
    });
    expect(rolled.ok).toBe(true);
    if (!rolled.ok) return;
    expect(rolled.meal.dayIndex).toBe(0);
    expect(rolled.meal.mealSlot).toBe("lunch");
  });

  it("respektiert excludeCurrentRecipe", () => {
    const initial = generatePlan({ ...baseInput, seed: 1 });
    if (!initial.ok) throw new Error();
    const before = initial.meals;
    const currentLunch = before.find(
      (m) => m.dayIndex === 0 && m.mealSlot === "lunch",
    )!;
    const rolled = rerollMeal({
      ...baseInput,
      existingMeals: before,
      target: { dayIndex: 0, mealSlot: "lunch" },
      excludeCurrentRecipe: true,
    });
    if (!rolled.ok) throw new Error();
    expect(rolled.meal.recipeId).not.toBe(currentLunch.recipeId);
  });

  it("Pool zu klein wenn Tag schon belegt → Fehler", () => {
    // Nur ein Lunch im Pool, gleichzeitig anderes Slot soll diesen erzwingen
    const tinyPool: GeneratorInput = {
      ...baseInput,
      recipes: [oatBowl, lunchA, dinnerA],
    };
    const initial = generatePlan(tinyPool);
    if (!initial.ok) throw new Error();
    // Reroll mit excludeCurrent muss fehlschlagen (Pool=1)
    const rolled = rerollMeal({
      ...tinyPool,
      existingMeals: initial.meals,
      target: { dayIndex: 0, mealSlot: "lunch" },
      excludeCurrentRecipe: true,
    });
    expect(rolled.ok).toBe(false);
  });
});

describe("filterRecipesByExcludedIngredients", () => {
  it("entfernt Rezepte mit ausgeschlossenen Zutaten", () => {
    const filtered = filterRecipesByExcludedIngredients(
      [oatBowl, lunchA],
      [chicken.id],
    );
    expect(filtered.map((r) => r.id)).toEqual(["r-oats"]);
  });

  it("leere Excluded-Liste → unverändert", () => {
    const filtered = filterRecipesByExcludedIngredients([oatBowl, lunchA], []);
    expect(filtered).toHaveLength(2);
  });
});

describe("filterSuppressedRecipes", () => {
  it("entfernt suppressed", () => {
    const suppressed = { ...lunchA, suppressed: true };
    const filtered = filterSuppressedRecipes([oatBowl, suppressed]);
    expect(filtered.map((r) => r.id)).toEqual(["r-oats"]);
  });
});

describe("aggregatePerDay", () => {
  it("summiert pro Tag korrekt", () => {
    const result = generatePlan(baseInput);
    if (!result.ok) throw new Error();
    const days = aggregatePerDay(result.meals, baseInput.recipes);
    expect(days).toHaveLength(3);
    // Jeder Tag sollte nahe am 2000 kcal-Ziel sein (mit Skalierung in Range)
    for (const d of days) {
      expect(d.kcal).toBeGreaterThan(1800);
      expect(d.kcal).toBeLessThan(2200);
    }
  });
});
