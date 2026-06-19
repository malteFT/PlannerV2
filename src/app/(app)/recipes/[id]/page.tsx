"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import {
  useDeleteRecipe,
  useRecipe,
  useToggleSuppressed,
  useUpdateRecipe,
} from "@/lib/queries/recipes";
import { RecipeForm } from "@/components/recipe/recipe-form";
import type { RecipeFormValues } from "@/lib/validators";
import type { IngredientUnit } from "@/lib/db/types";

import { Button } from "@/components/ui/button";

type Props = {
  params: Promise<{ id: string }>;
};

export default function EditRecipePage({ params }: Props) {
  const router = useRouter();
  const { id } = React.use(params);

  const { data: recipe, isLoading } = useRecipe(id);
  const updateRecipe = useUpdateRecipe(id);
  const deleteRecipe = useDeleteRecipe();
  const toggleSuppressed = useToggleSuppressed(id);

  const defaultValues: RecipeFormValues | undefined = React.useMemo(() => {
    if (!recipe) return undefined;
    return {
      name: recipe.name,
      meal_types: recipe.meal_types,
      base_servings: recipe.base_servings,
      instructions: recipe.instructions ?? "",
      suppressed: recipe.suppressed,
      ingredients: [...recipe.ingredients]
        .sort((a, b) => a.position - b.position)
        .map((ri) => ({
          ingredient_id: ri.ingredient_id,
          amount: ri.amount,
          unit: ri.unit as IngredientUnit,
        })),
    };
  }, [recipe]);

  const handleSubmit = React.useCallback(
    async (values: RecipeFormValues) => {
      await updateRecipe.mutateAsync(values);
      toast.success("Rezept gespeichert");
      router.push("/recipes");
    },
    [updateRecipe, router],
  );

  const handleDelete = React.useCallback(async () => {
    if (!confirm("Rezept wirklich löschen?")) return;
    try {
      await deleteRecipe.mutateAsync(id);
      toast.success("Rezept gelöscht");
      router.push("/recipes");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Löschen fehlgeschlagen");
    }
  }, [deleteRecipe, id, router]);

  const handleToggleSuppressed = React.useCallback(async () => {
    if (!recipe) return;
    try {
      const next = !recipe.suppressed;
      await toggleSuppressed.mutateAsync(next);
      toast.success(
        next ? "Rezept wird nicht mehr vorgeschlagen" : "Rezept wieder aktiv",
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Aktion fehlgeschlagen");
    }
  }, [recipe, toggleSuppressed]);

  if (isLoading) {
    return <p className="text-sm text-muted-foreground">Lädt…</p>;
  }
  if (!recipe || !defaultValues) {
    return (
      <p className="text-sm text-muted-foreground">Rezept nicht gefunden.</p>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">
          Rezept bearbeiten
        </h1>
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={handleToggleSuppressed}
            disabled={toggleSuppressed.isPending}
          >
            {recipe.suppressed ? "Wieder vorschlagen" : "Nicht mehr vorschlagen"}
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={handleDelete}
            disabled={deleteRecipe.isPending}
          >
            Löschen
          </Button>
        </div>
      </div>

      <RecipeForm
        defaultValues={defaultValues}
        onSubmit={handleSubmit}
        submitLabel="Speichern"
      />
    </div>
  );
}
