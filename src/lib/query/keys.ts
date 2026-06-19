/**
 * Zentral definierte Query-Keys, damit Invalidations konsistent bleiben.
 */
export const qk = {
  ingredients: (search?: string) =>
    ["ingredients", { search: search ?? "" }] as const,
  ingredient: (id: string) => ["ingredient", id] as const,
  ingredientUsage: (id: string) => ["ingredient", id, "usage"] as const,

  recipes: (filter?: { mealType?: string; query?: string; includeSuppressed?: boolean }) =>
    ["recipes", filter ?? {}] as const,
  recipe: (id: string) => ["recipe", id] as const,

  settings: ["user_settings"] as const,

  blsSearch: (term: string) => ["bls", "search", term] as const,
};
