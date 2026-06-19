"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { useCreateRecipe } from "@/lib/queries/recipes";
import { RecipeForm } from "@/components/recipe/recipe-form";
import type { RecipeFormValues } from "@/lib/validators";

export default function NewRecipePage() {
  const router = useRouter();
  const createRecipe = useCreateRecipe();

  const handleSubmit = React.useCallback(
    async (values: RecipeFormValues) => {
      await createRecipe.mutateAsync(values);
      toast.success("Rezept angelegt");
      router.push("/recipes");
    },
    [createRecipe, router],
  );

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">Neues Rezept</h1>
      <RecipeForm onSubmit={handleSubmit} submitLabel="Anlegen" />
    </div>
  );
}
