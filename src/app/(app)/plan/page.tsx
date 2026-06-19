"use client";

import * as React from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Dices, Replace, Trash2, Save, Pencil, Check, Calendar } from "lucide-react";

import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/layout/page-header";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

import {
  useActivePlan,
  useToggleMealCooked,
  useUpdatePlanMeal,
  useDeletePlanMeal,
  useArchivePlan,
} from "@/lib/queries/plans";
import { useRecipes } from "@/lib/queries/recipes";
import { useSettings } from "@/lib/queries/settings";

import {
  rerollMeal,
  filterRecipesByExcludedIngredients,
  filterSuppressedRecipes,
  type GeneratedMeal,
} from "@/lib/domain/generator";
import { macrosForMeal, macrosPerServing, formatKcal, formatGrams } from "@/lib/domain/nutrition";
import {
  MEAL_SLOT_LABELS,
  type MealSlot,
  type PlanMealWithRecipe,
  type PlanWithMeals,
  type RecipeWithIngredients,
  type UserSettings,
} from "@/lib/db/types";

// =========================================================================
// Page
// =========================================================================

export default function PlanPage() {
  const planQuery = useActivePlan();
  const recipesQuery = useRecipes();
  const settingsQuery = useSettings();
  const archive = useArchivePlan();

  const plan = planQuery.data ?? null;
  const [editMode, setEditMode] = React.useState(false);

  if (planQuery.isLoading) {
    return (
      <div className="space-y-6">
        <Header editMode={false} onToggleEdit={() => {}} canEdit={false} />
        <Card>
          <CardContent className="flex flex-wrap items-center gap-x-6 gap-y-2 py-4">
            <Skeleton className="h-10 w-32" />
            <Skeleton className="h-10 w-20" />
          </CardContent>
        </Card>
        <div className="space-y-4">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
      </div>
    );
  }

  if (!plan) {
    return (
      <div className="space-y-6">
        <Header editMode={false} onToggleEdit={() => {}} canEdit={false} />
        <Card>
          <CardContent className="flex flex-col items-center gap-4 py-12 text-center">
            <Calendar className="size-8 text-muted-foreground" />
            <p className="text-muted-foreground">Noch kein aktiver Plan.</p>
            <Link
              href="/plan/generate"
              className={buttonVariants({ variant: "default" })}
            >
              Plan generieren
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  const recipes = recipesQuery.data ?? [];
  const settings = settingsQuery.data ?? null;

  const dayAggregates = computeDayAggregates(plan);

  return (
    <div className="space-y-6">
      <Header
        editMode={editMode}
        onToggleEdit={() => setEditMode((v) => !v)}
        canEdit={true}
      />

      {/* Tagesziel-Snapshot aus dem Plan selbst */}
      <Card>
        <CardContent className="grid grid-cols-1 gap-4 py-4 md:grid-cols-2">
          <div>
            <p className="text-sm text-muted-foreground">Tagesziel</p>
            <p className="text-lg font-semibold">
              {formatKcal(plan.target_kcal_per_day)}
            </p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Tage</p>
            <p className="text-lg font-semibold">{plan.day_count}</p>
          </div>
        </CardContent>
      </Card>

      {/* Tageskarten */}
      <div className="space-y-4">
        {Array.from({ length: plan.day_count }, (_, dayIndex) => {
          const dayMeals = plan.meals.filter((m) => m.day_index === dayIndex);
          const agg = dayAggregates.find((d) => d.dayIndex === dayIndex);
          return (
            <DayCard
              key={dayIndex}
              dayIndex={dayIndex}
              dayLabel={plan.day_labels[dayIndex] ?? `Tag ${dayIndex + 1}`}
              targetKcal={plan.target_kcal_per_day}
              meals={dayMeals}
              aggregateKcal={agg?.kcal ?? 0}
              aggregateProtein={agg?.protein ?? 0}
              aggregateCarbs={agg?.carbs ?? 0}
              aggregateFat={agg?.fat ?? 0}
              plan={plan}
              recipes={recipes}
              settings={settings}
              editMode={editMode}
            />
          );
        })}
      </div>

      <div className="flex justify-end">
        <Button
          variant="default"
          disabled={archive.isPending}
          onClick={() => {
            if (
              !window.confirm(
                "Plan wirklich abschließen? Er wandert in die Historie.",
              )
            ) {
              return;
            }
            archive.mutate(plan.id, {
              onSuccess: () => toast.success("Plan archiviert."),
              onError: (e) =>
                toast.error(`Fehler: ${(e as Error).message ?? e}`),
            });
          }}
        >
          {archive.isPending ? "Archiviere…" : "Plan abschließen"}
        </Button>
      </div>
    </div>
  );
}

function Header({
  editMode,
  onToggleEdit,
  canEdit,
}: {
  editMode: boolean;
  onToggleEdit: () => void;
  canEdit: boolean;
}) {
  return (
    <PageHeader
      title="Plan"
      actions={
        <>
          {canEdit && (
            <Button
              variant={editMode ? "default" : "outline"}
              size="sm"
              onClick={onToggleEdit}
              aria-pressed={editMode}
            >
              {editMode ? (
                <>
                  <Check className="mr-1 h-4 w-4" />
                  Fertig
                </>
              ) : (
                <>
                  <Pencil className="mr-1 h-4 w-4" />
                  Bearbeiten
                </>
              )}
            </Button>
          )}
          <Link
            href="/plan/generate"
            className={buttonVariants({ variant: "outline" })}
          >
            Neuen Plan generieren
          </Link>
        </>
      }
    />
  );
}

// =========================================================================
// Day Card
// =========================================================================

type DayCardProps = {
  dayIndex: number;
  dayLabel: string;
  targetKcal: number;
  meals: PlanMealWithRecipe[];
  aggregateKcal: number;
  aggregateProtein: number;
  aggregateCarbs: number;
  aggregateFat: number;
  plan: PlanWithMeals;
  recipes: RecipeWithIngredients[];
  settings: UserSettings | null;
  editMode: boolean;
};

function DayCard(props: DayCardProps) {
  const {
    dayLabel,
    targetKcal,
    meals,
    aggregateKcal,
    aggregateProtein,
    aggregateCarbs,
    aggregateFat,
    plan,
    recipes,
    settings,
    editMode,
  } = props;

  const diff = aggregateKcal - targetKcal;

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="text-lg">{dayLabel}</CardTitle>
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <Badge variant="secondary">{formatKcal(aggregateKcal)}</Badge>
            <span className="text-muted-foreground">
              Ziel {formatKcal(targetKcal)} ({diff >= 0 ? "+" : ""}
              {Math.round(diff)} kcal)
            </span>
            <Separator orientation="vertical" className="h-4" />
            <span className="text-muted-foreground">
              P {formatGrams(aggregateProtein)} · KH {formatGrams(aggregateCarbs)} · F{" "}
              {formatGrams(aggregateFat)}
            </span>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {meals.map((meal) => (
          <MealRow
            key={meal.id}
            meal={meal}
            plan={plan}
            recipes={recipes}
            settings={settings}
            editMode={editMode}
          />
        ))}
        {meals.length === 0 && (
          <p className="text-sm text-muted-foreground">
            Keine Mahlzeiten an diesem Tag.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

// =========================================================================
// Meal Row
// =========================================================================

type MealRowProps = {
  meal: PlanMealWithRecipe;
  plan: PlanWithMeals;
  recipes: RecipeWithIngredients[];
  settings: UserSettings | null;
  editMode: boolean;
};

function MealRow({ meal, plan, recipes, settings, editMode }: MealRowProps) {
  const toggleCooked = useToggleMealCooked();
  const updateMeal = useUpdatePlanMeal();
  const deleteMeal = useDeletePlanMeal();

  const [factorOpen, setFactorOpen] = React.useState(false);
  const [factorDraft, setFactorDraft] = React.useState(
    String(Number(meal.serving_factor)),
  );
  const [swapOpen, setSwapOpen] = React.useState(false);

  // Sync Faktor-Eingabe wenn das Meal extern aktualisiert wird.
  React.useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setFactorDraft(String(Number(meal.serving_factor)));
  }, [meal.serving_factor]);

  const recipe = meal.recipe;
  const kcal = recipe
    ? macrosForMeal(
        recipe.ingredients,
        recipe.base_servings,
        Number(meal.serving_factor),
      ).kcal
    : 0;

  function handleSaveFactor() {
    const parsed = Number.parseFloat(factorDraft);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      toast.error("Ungültiger Faktor.");
      return;
    }
    const rounded = Math.round(parsed * 1000) / 1000;
    updateMeal.mutate(
      { mealId: meal.id, servingFactor: rounded },
      {
        onSuccess: () => {
          toast.success("Faktor aktualisiert.");
          setFactorOpen(false);
        },
        onError: (e) => toast.error(`Fehler: ${(e as Error).message ?? e}`),
      },
    );
  }

  function handleReroll() {
    if (!settings) {
      toast.error("Einstellungen noch nicht geladen.");
      return;
    }
    const filtered = filterRecipesByExcludedIngredients(
      filterSuppressedRecipes(recipes),
      settings.excluded_ingredient_ids,
    );
    if (filtered.length === 0) {
      toast.error("Keine passenden Rezepte verfügbar.");
      return;
    }
    const existing: GeneratedMeal[] = plan.meals
      .filter((m) => m.recipe_id !== null)
      .map((m) => ({
        dayIndex: m.day_index,
        mealSlot: m.meal_slot,
        recipeId: m.recipe_id as string,
        servingFactor: Number(m.serving_factor),
      }));

    const result = rerollMeal({
      dayCount: plan.day_count,
      mealSlots: plan.meal_slots,
      mealSlotPct: plan.meal_slot_pct,
      targetKcalPerDay: plan.target_kcal_per_day,
      tolerancePct: settings.tolerance_pct,
      recipes: filtered,
      existingMeals: existing,
      target: { dayIndex: meal.day_index, mealSlot: meal.meal_slot },
      excludeCurrentRecipe: true,
    });

    if (!result.ok) {
      toast.error("Kein Kandidat zum Würfeln gefunden.");
      return;
    }

    updateMeal.mutate(
      {
        mealId: meal.id,
        recipeId: result.meal.recipeId,
        servingFactor: result.meal.servingFactor,
      },
      {
        onSuccess: () => toast.success("Mahlzeit neu gewürfelt."),
        onError: (e) => toast.error(`Fehler: ${(e as Error).message ?? e}`),
      },
    );
  }

  function handleSwap(recipeId: string) {
    // Slot-kcal-Ziel berechnen, neuer Faktor analog Generator (clamp 0.3..3.0).
    const slotIdx = plan.meal_slots.indexOf(meal.meal_slot);
    const slotPct = plan.meal_slot_pct[slotIdx] ?? 0;
    const slotTargetKcal = (plan.target_kcal_per_day * slotPct) / 100;
    const newRecipe = recipes.find((r) => r.id === recipeId);
    let factor = 1;
    if (newRecipe) {
      const kcalPerServing = macrosPerServing(
        newRecipe.ingredients,
        newRecipe.base_servings,
      ).kcal;
      if (kcalPerServing > 0) {
        const ideal = slotTargetKcal / kcalPerServing;
        factor = Math.max(0.3, Math.min(3.0, ideal));
        factor = Math.round(factor * 1000) / 1000;
      }
    }
    updateMeal.mutate(
      { mealId: meal.id, recipeId, servingFactor: factor },
      {
        onSuccess: () => {
          toast.success("Rezept getauscht.");
          setSwapOpen(false);
        },
        onError: (e) => toast.error(`Fehler: ${(e as Error).message ?? e}`),
      },
    );
  }

  function handleDelete() {
    deleteMeal.mutate(meal.id, {
      onSuccess: () => toast.success("Mahlzeit gelöscht."),
      onError: (e) => toast.error(`Fehler: ${(e as Error).message ?? e}`),
    });
  }

  return (
    <div className={`rounded-md border p-3 transition-colors ${meal.cooked ? "is-done" : ""}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline">{MEAL_SLOT_LABELS[meal.meal_slot]}</Badge>
            {recipe ? (
              <span className="font-medium">{recipe.name}</span>
            ) : (
              <span className="italic text-muted-foreground">
                (Rezept gelöscht)
              </span>
            )}
          </div>
          <div className="mt-1 text-sm text-muted-foreground">
            Faktor {Number(meal.serving_factor).toFixed(2)} ·{" "}
            {recipe ? formatKcal(kcal) : "—"}
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <Label className="flex items-center gap-2 text-sm">
            <span>Gekocht</span>
            <Switch
              checked={meal.cooked}
              disabled={toggleCooked.isPending}
              onCheckedChange={(checked) =>
                toggleCooked.mutate(
                  { mealId: meal.id, cooked: checked },
                  {
                    onError: (e) =>
                      toast.error(`Fehler: ${(e as Error).message ?? e}`),
                  },
                )
              }
            />
          </Label>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {editMode && (
          <>
            <Button
              size="sm"
              variant="outline"
              onClick={handleReroll}
              disabled={updateMeal.isPending}
            >
              <Dices className="mr-1 h-4 w-4" />
              Würfeln
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setSwapOpen(true)}
            >
              <Replace className="mr-1 h-4 w-4" />
              Tauschen
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setFactorOpen((v) => !v)}
            >
              Faktor anpassen
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={handleDelete}
              disabled={deleteMeal.isPending}
            >
              <Trash2 className="mr-1 h-4 w-4" />
              Löschen
            </Button>
          </>
        )}
      </div>

      {editMode && factorOpen && (
        <div className="mt-3 flex items-end gap-2">
          <div className="flex flex-col gap-1">
            <Label htmlFor={`factor-${meal.id}`} className="text-xs">
              Portionsfaktor
            </Label>
            <Input
              id={`factor-${meal.id}`}
              type="number"
              step={0.1}
              min={0.1}
              value={factorDraft}
              onChange={(e) => setFactorDraft(e.target.value)}
              onBlur={handleSaveFactor}
              className="w-28"
            />
          </div>
          <Button
            size="sm"
            onClick={handleSaveFactor}
            disabled={updateMeal.isPending}
          >
            <Save className="mr-1 h-4 w-4" />
            OK
          </Button>
        </div>
      )}

      <SwapDialog
        open={swapOpen}
        onOpenChange={setSwapOpen}
        mealSlot={meal.meal_slot}
        currentRecipeId={meal.recipe_id}
        recipes={recipes}
        excludedIngredientIds={settings?.excluded_ingredient_ids ?? []}
        onPick={handleSwap}
      />
    </div>
  );
}

// =========================================================================
// Swap Dialog (Recipe Picker)
// =========================================================================

type SwapDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mealSlot: MealSlot;
  currentRecipeId: string | null;
  recipes: RecipeWithIngredients[];
  excludedIngredientIds: string[];
  onPick: (recipeId: string) => void;
};

function SwapDialog(props: SwapDialogProps) {
  const {
    open,
    onOpenChange,
    mealSlot,
    currentRecipeId,
    recipes,
    excludedIngredientIds,
    onPick,
  } = props;
  const [query, setQuery] = React.useState("");

  const eligible = React.useMemo(() => {
    const filtered = filterRecipesByExcludedIngredients(
      filterSuppressedRecipes(recipes),
      excludedIngredientIds,
    );
    return filtered
      .filter((r) => r.meal_types.includes(mealSlot))
      .filter((r) =>
        query.trim() === ""
          ? true
          : r.name.toLowerCase().includes(query.trim().toLowerCase()),
      );
  }, [recipes, excludedIngredientIds, mealSlot, query]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[80vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle>Rezept tauschen</DialogTitle>
          <DialogDescription>
            Mahlzeit: {MEAL_SLOT_LABELS[mealSlot]}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <Input
            placeholder="Suche…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <div className="max-h-[50vh] space-y-1 overflow-auto rounded-md border p-1">
            {eligible.length === 0 && (
              <p className="p-3 text-sm text-muted-foreground">
                Keine passenden Rezepte.
              </p>
            )}
            {eligible.map((r) => {
              const isCurrent = r.id === currentRecipeId;
              return (
                <button
                  key={r.id}
                  type="button"
                  disabled={isCurrent}
                  onClick={() => onPick(r.id)}
                  className="flex w-full items-center justify-between rounded px-2 py-2 text-left text-sm hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <span>{r.name}</span>
                  {isCurrent && (
                    <Badge variant="secondary" className="ml-2">
                      aktuell
                    </Badge>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Abbrechen
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// =========================================================================
// Helpers
// =========================================================================

type DayAgg = {
  dayIndex: number;
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
};

function computeDayAggregates(plan: PlanWithMeals): DayAgg[] {
  const map = new Map<number, DayAgg>();
  for (let i = 0; i < plan.day_count; i++) {
    map.set(i, { dayIndex: i, kcal: 0, protein: 0, carbs: 0, fat: 0 });
  }
  for (const m of plan.meals) {
    if (!m.recipe) continue;
    const macros = macrosForMeal(
      m.recipe.ingredients,
      m.recipe.base_servings,
      Number(m.serving_factor),
    );
    const day = map.get(m.day_index);
    if (!day) continue;
    day.kcal += macros.kcal;
    day.protein += macros.protein;
    day.carbs += macros.carbs;
    day.fat += macros.fat;
  }
  return Array.from(map.values()).sort((a, b) => a.dayIndex - b.dayIndex);
}
