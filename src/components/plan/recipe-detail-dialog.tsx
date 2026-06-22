"use client";

import * as React from "react";
import Link from "next/link";
import { Pencil } from "lucide-react";

import { Button, buttonVariants } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { macrosForMeal, formatKcal, formatGrams } from "@/lib/domain/nutrition";
import {
  MEAL_SLOT_LABELS,
  UNIT_LABELS,
  type IngredientUnit,
  type MealSlot,
  type RecipeWithIngredients,
} from "@/lib/db/types";

export type RecipeDetailDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  recipe: RecipeWithIngredients;
  servingFactor: number;
  mealSlot: MealSlot;
};

/**
 * Hilfsfunktion: Mengen mit Einheit formatieren, ganze Zahlen ohne
 * Dezimalstellen anzeigen. Wird auch im Generator-Detail genutzt.
 */
export function formatScaledAmount(value: number, unit: IngredientUnit): string {
  const isWhole = Math.abs(value - Math.round(value)) < 1e-9;
  const num = isWhole ? value.toFixed(0) : value.toFixed(1);
  return `${num} ${UNIT_LABELS[unit]}`;
}

/**
 * Modal-Dialog für ein einzelnes Plan-Meal: Zubereitungs-Anleitung,
 * skalierte Zutatenliste, Makros. Wird auf der Plan-Seite UND auf der
 * Plan-Generator-Seite verwendet.
 */
export function RecipeDetailDialog(props: RecipeDetailDialogProps) {
  const { open, onOpenChange, recipe, servingFactor, mealSlot } = props;

  const macros = macrosForMeal(
    recipe.ingredients,
    recipe.base_servings,
    servingFactor,
  );

  const sortedIngredients = React.useMemo(
    () => [...recipe.ingredients].sort((a, b) => a.position - b.position),
    [recipe.ingredients],
  );

  const hasInstructions = recipe.instructions.trim().length > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle>{recipe.name}</DialogTitle>
          <DialogDescription>
            {MEAL_SLOT_LABELS[mealSlot]} · Faktor {servingFactor.toFixed(2)}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 overflow-auto pr-1">
          {/* Makros */}
          <div className="rounded-md border p-3 text-sm">
            <div className="font-medium">{formatKcal(macros.kcal)}</div>
            <div className="mt-1 text-muted-foreground">
              P {formatGrams(macros.protein)} · F {formatGrams(macros.fat)} · KH{" "}
              {formatGrams(macros.carbs)}
            </div>
          </div>

          {/* Zutaten */}
          <section>
            <h3 className="mb-2 text-sm font-medium">Zutaten</h3>
            <ul className="space-y-1.5 text-sm">
              {sortedIngredients.map((ri) => (
                <li key={ri.ingredient_id} className="flex flex-col">
                  <span>
                    <span className="tabular-nums text-muted-foreground">
                      {formatScaledAmount(ri.amount * servingFactor, ri.unit)}
                    </span>{" "}
                    <span>{ri.ingredient.display_name}</span>
                  </span>
                </li>
              ))}
            </ul>
          </section>

          {/* Zubereitung */}
          <section>
            <h3 className="mb-2 text-sm font-medium">Zubereitung</h3>
            {hasInstructions ? (
              <p className="whitespace-pre-wrap text-sm">
                {recipe.instructions}
              </p>
            ) : (
              <p className="text-sm italic text-muted-foreground">
                Keine Zubereitungsanleitung hinterlegt.
              </p>
            )}
          </section>
        </div>

        <DialogFooter>
          <Link
            href={`/recipes/${recipe.id}`}
            className={buttonVariants({ variant: "outline" })}
          >
            <Pencil className="mr-1 h-4 w-4" />
            Rezept bearbeiten
          </Link>
          <Button onClick={() => onOpenChange(false)}>Schließen</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
