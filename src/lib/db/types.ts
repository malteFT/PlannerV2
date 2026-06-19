/**
 * Datenbank-Typen — handgepflegt parallel zur Migration.
 *
 * Diese Typen entsprechen exakt den DB-Tabellen aus
 * `supabase/migrations/0001_init.sql` und `0002_stammdaten.sql`.
 * Bei Schema-Änderungen sind beide Stellen synchron zu halten.
 *
 * (Alternativ: `supabase gen types typescript` — wir generieren später,
 * wenn die Schemata stabil sind.)
 */

export type IngredientUnit = "g" | "ml" | "piece";
export type MealSlot = "breakfast" | "lunch" | "dinner" | "snack";

export const ALL_MEAL_SLOTS: readonly MealSlot[] = [
  "breakfast",
  "lunch",
  "dinner",
  "snack",
] as const;

export const MEAL_SLOT_LABELS: Record<MealSlot, string> = {
  breakfast: "Frühstück",
  lunch: "Mittag",
  dinner: "Abend",
  snack: "Snack",
};

export const ALL_UNITS: readonly IngredientUnit[] = ["g", "ml", "piece"] as const;

export const UNIT_LABELS: Record<IngredientUnit, string> = {
  g: "g",
  ml: "ml",
  piece: "Stück",
};

/**
 * Vordefinierte Kategorien für Zutaten — werden für die
 * Einkaufsliste-Gruppierung verwendet.
 */
export const INGREDIENT_CATEGORIES = [
  "Obst & Gemüse",
  "Fleisch & Fisch",
  "Milchprodukte & Eier",
  "Backwaren & Getreide",
  "Nudeln, Reis & Hülsenfrüchte",
  "Konserven & Soßen",
  "Tiefkühl",
  "Öl, Essig & Gewürze",
  "Süßwaren & Snacks",
  "Getränke",
  "Sonstiges",
] as const;

export type IngredientCategory = (typeof INGREDIENT_CATEGORIES)[number];

// =========================================================================
// BLS
// =========================================================================

export type BlsFood = {
  bls_code: string;
  name_de: string;
  kcal_per_100g: number;
  protein_per_100g: number;
  carbs_per_100g: number;
  fat_per_100g: number;
};

// =========================================================================
// Zutat
// =========================================================================

export type Ingredient = {
  id: string;
  user_id: string;
  display_name: string;
  bls_code: string;
  default_unit: IngredientUnit;
  grams_per_piece: number | null;
  category: string;
  excluded: boolean;
  created_at: string;
  updated_at: string;
};

export type IngredientWithBls = Ingredient & {
  bls: BlsFood;
};

// =========================================================================
// Rezept
// =========================================================================

export type Recipe = {
  id: string;
  user_id: string;
  name: string;
  meal_types: MealSlot[];
  base_servings: number;
  instructions: string;
  suppressed: boolean;
  created_at: string;
  updated_at: string;
};

export type RecipeIngredient = {
  recipe_id: string;
  ingredient_id: string;
  amount: number;
  unit: IngredientUnit;
  position: number;
};

export type RecipeIngredientWithIngredient = RecipeIngredient & {
  ingredient: IngredientWithBls;
};

export type RecipeWithIngredients = Recipe & {
  ingredients: RecipeIngredientWithIngredient[];
};

// =========================================================================
// Settings
// =========================================================================

export type UserSettings = {
  user_id: string;
  target_kcal_per_day: number;
  protein_pct: number;
  carbs_pct: number;
  fat_pct: number;
  meal_slots: MealSlot[];
  meal_slot_pct: number[];
  tolerance_pct: number;
  excluded_ingredient_ids: string[];
  updated_at: string;
};
