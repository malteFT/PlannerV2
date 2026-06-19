/**
 * Zod-Schemas für Form-Validierung und API-Boundaries.
 *
 * Konvention: Wir nutzen NICHT `z.coerce.number()` — das macht den Input-Typ
 * `unknown` und kollidiert mit React-Hook-Form-Generics. Stattdessen halten
 * Forms ihre numerischen Felder schon als `number` im State (Konvertierung in
 * den onChange-Handlern der Inputs); das Schema validiert dann strikt.
 */
import { z } from "zod";
import {
  ALL_MEAL_SLOTS,
  ALL_UNITS,
  INGREDIENT_CATEGORIES,
  type IngredientCategory,
  type IngredientUnit,
  type MealSlot,
} from "@/lib/db/types";

const trimmedString = z.string().trim();

// Wir bauen die Enum-Schemas mit einer präzisen Tuple-Signatur, damit Zod den
// passenden Literal-Union-Output liefert (statt plain `string`).
const unitEnum = z.enum(
  ALL_UNITS as unknown as readonly [IngredientUnit, ...IngredientUnit[]],
);
const mealSlotEnum = z.enum(
  ALL_MEAL_SLOTS as unknown as readonly [MealSlot, ...MealSlot[]],
);
const categoryEnum = z.enum(
  INGREDIENT_CATEGORIES as unknown as readonly [
    IngredientCategory,
    ...IngredientCategory[],
  ],
);

// =========================================================================
// Zutat
// =========================================================================

export const ingredientFormSchema = z
  .object({
    display_name: trimmedString.min(1, "Name ist erforderlich").max(100),
    bls_code: trimmedString.min(1, "BLS-Eintrag wählen"),
    default_unit: unitEnum,
    grams_per_piece: z
      .union([z.number().positive(), z.nan()])
      .nullable()
      .optional(),
    category: categoryEnum,
    excluded: z.boolean(),
    /**
     * Synonyme zur Zutat. Werden in der Zutat-Suche im Rezept-Editor
     * zusätzlich zu display_name durchsucht.
     *
     * Im Form als kommagetrennter String eingegeben → wird vor dem
     * Submit zu einem getrimten, lowercase-normalisierten Array.
     */
    aliases: z
      .array(trimmedString.min(1).max(100, "Synonym ist zu lang"))
      .max(50, "Höchstens 50 Synonyme pro Zutat")
      .default([]),
  })
  .refine(
    (v) =>
      v.default_unit !== "piece" ||
      (typeof v.grams_per_piece === "number" &&
        Number.isFinite(v.grams_per_piece) &&
        v.grams_per_piece > 0),
    {
      message: "Bei Stück: Gramm pro Stück angeben (>0)",
      path: ["grams_per_piece"],
    },
  );

export type IngredientFormValues = z.infer<typeof ingredientFormSchema>;
export type IngredientFormInput = z.input<typeof ingredientFormSchema>;

// =========================================================================
// Rezept
// =========================================================================

export const recipeIngredientSchema = z.object({
  ingredient_id: trimmedString.min(1, "Zutat wählen"),
  amount: z.number().positive("Menge > 0"),
  unit: unitEnum,
});

export const recipeFormSchema = z.object({
  name: trimmedString.min(1, "Name ist erforderlich").max(120),
  meal_types: z.array(mealSlotEnum).min(1, "Mindestens eine Mahlzeit-Kategorie wählen"),
  base_servings: z.number().positive("Basisportionen > 0"),
  instructions: z.string(),
  suppressed: z.boolean(),
  ingredients: z
    .array(recipeIngredientSchema)
    .min(1, "Mindestens eine Zutat hinzufügen"),
});

export type RecipeFormValues = z.infer<typeof recipeFormSchema>;
export type RecipeFormInput = z.input<typeof recipeFormSchema>;

// =========================================================================
// Settings
// =========================================================================

export const userSettingsFormSchema = z
  .object({
    target_kcal_per_day: z
      .number()
      .int()
      .positive("Tagesziel kcal > 0")
      .max(10000),
    protein_pct: z.number().min(0).max(100),
    carbs_pct: z.number().min(0).max(100),
    fat_pct: z.number().min(0).max(100),
    meal_slots: z.array(mealSlotEnum).min(1, "Mindestens eine Mahlzeit"),
    meal_slot_pct: z.array(z.number().min(0).max(100)).min(1),
    tolerance_pct: z.number().min(0).max(50),
    excluded_ingredient_ids: z.array(z.string()),
  })
  .refine(
    (v) => Math.round((v.protein_pct + v.carbs_pct + v.fat_pct) * 100) === 10000,
    { message: "Makros müssen sich auf 100 % summieren", path: ["protein_pct"] },
  )
  .refine((v) => v.meal_slots.length === v.meal_slot_pct.length, {
    message: "Mahlzeiten und Anteile passen nicht zusammen",
    path: ["meal_slot_pct"],
  })
  .refine(
    (v) => Math.round(v.meal_slot_pct.reduce((s, x) => s + x, 0) * 100) === 10000,
    {
      message: "Anteile pro Mahlzeit müssen sich auf 100 % summieren",
      path: ["meal_slot_pct"],
    },
  );

export type UserSettingsFormValues = z.infer<typeof userSettingsFormSchema>;
export type UserSettingsFormInput = z.input<typeof userSettingsFormSchema>;
