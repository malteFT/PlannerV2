"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Dices, Replace } from "lucide-react";
import { toast } from "sonner";

import {
  MEAL_SLOT_LABELS,
  type MealSlot,
  type RecipeWithIngredients,
  type UserSettings,
} from "@/lib/db/types";
import {
  aggregatePerDay,
  filterRecipesByExcludedIngredients,
  filterSuppressedRecipes,
  generatePlan,
  rerollMeal,
  type GeneratedMeal,
  type GenerateError,
} from "@/lib/domain/generator";
import { formatGrams, formatKcal, macrosForMeal, macrosPerServing, type Macros } from "@/lib/domain/nutrition";

import { useSettings } from "@/lib/queries/settings";
import { useRecipes } from "@/lib/queries/recipes";
import {
  useActivatePlan,
  useActivePlan,
  useCreatePlanDraft,
} from "@/lib/queries/plans";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageHeader } from "@/components/layout/page-header";
import { MealSlotChip } from "@/components/plan/meal-slot-chip";
import { RecipeDetailDialog } from "@/components/plan/recipe-detail-dialog";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

// =========================================================================
// Day-Label-Presets
// =========================================================================

type LabelPreset = "numeric" | "weekday";

const WEEKDAYS_DE = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"] as const;

function buildDayLabels(preset: LabelPreset, count: number): string[] {
  if (preset === "weekday") {
    return Array.from({ length: count }, (_, i) => WEEKDAYS_DE[i % 7]);
  }
  return Array.from({ length: count }, (_, i) => `Tag ${i + 1}`);
}

function generateErrorMessage(err: GenerateError): string {
  if (err.kind === "empty_recipes") {
    return "Keine Rezepte verfügbar. Bitte zuerst Rezepte anlegen.";
  }
  return `Keine passenden Rezepte für ${MEAL_SLOT_LABELS[err.mealSlot]} an Tag ${err.dayIndex + 1}.`;
}

/**
 * Erzeugt einen frischen Seed pro Reroll/Generate-Klick.
 * Außerhalb der Komponente, damit der React-Compiler Math.random nicht
 * im Render-Pfad sieht.
 */
function makeRerollSeed(): number {
  return Math.floor(Math.random() * 1e9);
}

// =========================================================================
// Page
// =========================================================================

export default function PlanGeneratePage() {
  const router = useRouter();

  const { data: settings, isLoading: settingsLoading } = useSettings();
  const { data: allRecipes = [], isLoading: recipesLoading } = useRecipes({
    includeSuppressed: false,
  });
  const { data: activePlan } = useActivePlan();

  const createDraft = useCreatePlanDraft();
  const activatePlan = useActivatePlan();

  // ---------- Konfiguration ----------
  const [dayCount, setDayCount] = React.useState<number>(7);
  const [labelPreset, setLabelPreset] = React.useState<LabelPreset>("numeric");

  // ---------- Generator-Ergebnis (im Component-State) ----------
  const [meals, setMeals] = React.useState<GeneratedMeal[] | null>(null);
  const [seed, setSeed] = React.useState<number>(0);
  // Snapshot des gefilterten Rezept-Pools zum Zeitpunkt der Generierung —
  // damit Rerolls/Tausch konsistent gegen denselben Pool laufen.
  const [recipePool, setRecipePool] = React.useState<RecipeWithIngredients[]>([]);
  const [planSettings, setPlanSettings] = React.useState<UserSettings | null>(null);
  const [planDayLabels, setPlanDayLabels] = React.useState<string[]>([]);

  // ---------- Confirm-Dialog für aktiven Plan ----------
  const [confirmActivateOpen, setConfirmActivateOpen] = React.useState(false);

  // ---------- Manueller Tausch-Dialog ----------
  const [swapTarget, setSwapTarget] = React.useState<
    | { dayIndex: number; mealSlot: MealSlot }
    | null
  >(null);

  const recipesById = React.useMemo(() => {
    const m = new Map<string, RecipeWithIngredients>();
    for (const r of recipePool) m.set(r.id, r);
    return m;
  }, [recipePool]);

  // ---------- Aktion: Plan generieren ----------
  function handleGenerate() {
    if (!settings) {
      toast.error("Bitte zuerst Settings einrichten");
      return;
    }
    if (allRecipes.length === 0) {
      toast.error("Bitte zuerst Rezepte anlegen");
      return;
    }
    const filtered = filterRecipesByExcludedIngredients(
      filterSuppressedRecipes(allRecipes),
      settings.excluded_ingredient_ids,
    );
    if (filtered.length === 0) {
      toast.error("Nach Filterung sind keine Rezepte mehr übrig.");
      return;
    }

    const newSeed = Math.floor(Math.random() * 1e9);
    const result = generatePlan({
      dayCount,
      mealSlots: settings.meal_slots,
      mealSlotPct: settings.meal_slot_pct,
      targetKcalPerDay: settings.target_kcal_per_day,
      tolerancePct: settings.tolerance_pct,
      recipes: filtered,
      seed: newSeed,
    });

    if (!result.ok) {
      toast.error(generateErrorMessage(result.error));
      return;
    }

    setMeals(result.meals);
    setSeed(newSeed);
    setRecipePool(filtered);
    setPlanSettings(settings);
    setPlanDayLabels(buildDayLabels(labelPreset, dayCount));
    toast.success("Plan generiert");
  }

  // ---------- Aktion: einzelne Mahlzeit würfeln ----------
  function handleReroll(dayIndex: number, slot: MealSlot) {
    if (!meals || !planSettings) return;
    // Pro Klick neuer Seed, sonst landet jeder Klick in derselben deterministischen
    // Rangfolge und der User würde nur zwischen 2 Rezepten wechseln.
    const rerollSeed = makeRerollSeed();
    const result = rerollMeal({
      dayCount: planDayLabels.length,
      mealSlots: planSettings.meal_slots,
      mealSlotPct: planSettings.meal_slot_pct,
      targetKcalPerDay: planSettings.target_kcal_per_day,
      tolerancePct: planSettings.tolerance_pct,
      recipes: recipePool,
      seed: rerollSeed,
      existingMeals: meals,
      target: { dayIndex, mealSlot: slot },
      excludeCurrentRecipe: true,
    });
    if (!result.ok) {
      toast.error(generateErrorMessage(result.error));
      return;
    }
    setMeals((prev) =>
      (prev ?? []).map((m) =>
        m.dayIndex === dayIndex && m.mealSlot === slot ? result.meal : m,
      ),
    );
  }

  // ---------- Aktion: manuelles Tauschen ----------
  function handleSwap(dayIndex: number, slot: MealSlot, recipeId: string) {
    if (!planSettings) return;
    // Faktor passend zum Slot-kcal-Ziel berechnen (analog zum Generator),
    // damit die Tagesziel-Anzeige nach Tausch sinnvoll bleibt.
    const recipe = recipePool.find((r) => r.id === recipeId);
    const slotIdx = planSettings.meal_slots.indexOf(slot);
    const slotPct = planSettings.meal_slot_pct[slotIdx] ?? 0;
    const slotTargetKcal = (planSettings.target_kcal_per_day * slotPct) / 100;
    let factor = 1;
    if (recipe) {
      const kcalPerServing = macrosPerServing(
        recipe.ingredients,
        recipe.base_servings,
      ).kcal;
      if (kcalPerServing > 0) {
        const ideal = slotTargetKcal / kcalPerServing;
        factor = Math.max(0.3, Math.min(3.0, ideal));
        factor = Math.round(factor * 1000) / 1000;
      }
    }
    setMeals((prev) =>
      (prev ?? []).map((m) =>
        m.dayIndex === dayIndex && m.mealSlot === slot
          ? { ...m, recipeId, servingFactor: factor }
          : m,
      ),
    );
    setSwapTarget(null);
  }

  // ---------- Aktion: verwerfen ----------
  function handleDiscard() {
    setMeals(null);
    setRecipePool([]);
    setPlanSettings(null);
    setPlanDayLabels([]);
    router.push("/plan");
  }

  // ---------- Aktion: Plan festlegen ----------
  async function persistPlan() {
    if (!meals || !planSettings) return;
    try {
      const planId = await createDraft.mutateAsync({
        name: null,
        dayLabels: planDayLabels,
        settings: planSettings,
        meals,
      });
      await activatePlan.mutateAsync(planId);
      toast.success("Plan ist aktiv");
      router.push("/plan");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Speichern fehlgeschlagen";
      toast.error(msg);
    }
  }

  function handleActivateClick() {
    if (!meals) return;
    if (activePlan) {
      setConfirmActivateOpen(true);
    } else {
      void persistPlan();
    }
  }

  // ---------- Aggregation pro Tag (live) ----------
  const dayAggregates = React.useMemo(() => {
    if (!meals) return [];
    return aggregatePerDay(meals, recipePool);
  }, [meals, recipePool]);

  const targetKcal = planSettings?.target_kcal_per_day ?? 0;

  const isBusy = createDraft.isPending || activatePlan.isPending;
  const isDataLoading = settingsLoading || recipesLoading;

  // =========================================================================
  // Render
  // =========================================================================

  return (
    <div className="space-y-6">
      {/* Header */}
      <PageHeader
        title="Plan generieren"
        actions={
          <Button variant="ghost" size="icon-sm" render={<Link href="/plan" />} aria-label="Zurück">
            <ArrowLeft />
          </Button>
        }
      />

      {/* Konfiguration */}
      <Card>
        <CardHeader>
          <CardTitle>Konfiguration</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="day_count">Anzahl Tage</Label>
              <Input
                id="day_count"
                type="number"
                min={1}
                max={31}
                value={Number.isFinite(dayCount) ? String(dayCount) : ""}
                onChange={(e) => {
                  const raw = e.target.value;
                  if (raw === "") {
                    setDayCount(0);
                    return;
                  }
                  const n = Number(raw);
                  if (!Number.isFinite(n)) return;
                  setDayCount(Math.max(1, Math.min(31, Math.floor(n))));
                }}
                className="w-32"
              />
            </div>

            <div className="flex flex-col gap-2">
              <Label>Tages-Beschriftung</Label>
              <Select
                value={labelPreset}
                onValueChange={(v) => setLabelPreset(v as LabelPreset)}
              >
                <SelectTrigger className="w-64">
                  <SelectValue>
                    {(v) =>
                      v === "numeric" ? "Tag 1, Tag 2, …" : "Mo, Di, Mi, …"
                    }
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="numeric">Tag 1, Tag 2, …</SelectItem>
                  <SelectItem value="weekday">Mo, Di, Mi, …</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="pt-2">
            <Button
              onClick={handleGenerate}
              disabled={isDataLoading || dayCount < 1}
            >
              Plan generieren
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Preview */}
      {meals && planSettings && (
        <div className="space-y-4">
          {Array.from({ length: planDayLabels.length }, (_, dayIndex) => {
            const aggregate = dayAggregates.find(
              (a) => a.dayIndex === dayIndex,
            ) ?? { dayIndex, kcal: 0, protein: 0, carbs: 0, fat: 0 };
            const dayMeals = meals
              .filter((m) => m.dayIndex === dayIndex)
              .slice()
              .sort((a, b) => {
                const order = planSettings.meal_slots;
                return order.indexOf(a.mealSlot) - order.indexOf(b.mealSlot);
              });

            return (
              <Card key={dayIndex}>
                <CardHeader>
                  <div className="flex items-baseline justify-between gap-2">
                    <CardTitle>{planDayLabels[dayIndex] ?? `Tag ${dayIndex + 1}`}</CardTitle>
                    <div className="text-sm text-muted-foreground">
                      {Math.round(aggregate.kcal)} / {targetKcal} kcal
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-3 gap-2 rounded-md border bg-muted/30 p-2 text-xs sm:grid-cols-3">
                    <div>
                      <span className="text-muted-foreground">Protein: </span>
                      <span className="font-medium">{formatGrams(aggregate.protein)}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">KH: </span>
                      <span className="font-medium">{formatGrams(aggregate.carbs)}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Fett: </span>
                      <span className="font-medium">{formatGrams(aggregate.fat)}</span>
                    </div>
                  </div>

                  <div className="space-y-2">
                    {dayMeals.map((meal) => {
                      const recipe = recipesById.get(meal.recipeId);
                      const macros = recipe
                        ? macrosForMeal(
                            recipe.ingredients,
                            recipe.base_servings,
                            meal.servingFactor,
                          )
                        : null;
                      return (
                        <GeneratorMealCard
                          key={`${meal.dayIndex}-${meal.mealSlot}`}
                          meal={meal}
                          recipe={recipe ?? null}
                          macros={macros}
                          onReroll={() =>
                            handleReroll(meal.dayIndex, meal.mealSlot)
                          }
                          onSwap={() =>
                            setSwapTarget({
                              dayIndex: meal.dayIndex,
                              mealSlot: meal.mealSlot,
                            })
                          }
                        />
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            );
          })}

          {/* Action Bar */}
          <div className="sticky bottom-0 -mx-4 flex justify-end gap-2 border-t bg-background/95 px-4 py-3 backdrop-blur supports-backdrop-filter:bg-background/60">
            <Button variant="outline" onClick={handleDiscard} disabled={isBusy}>
              Verwerfen
            </Button>
            <Button onClick={handleActivateClick} disabled={isBusy}>
              Plan festlegen
            </Button>
          </div>
        </div>
      )}

      {/* Confirm: aktiver Plan wird archiviert */}
      <Dialog
        open={confirmActivateOpen}
        onOpenChange={(open) => setConfirmActivateOpen(open)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Aktuellen Plan archivieren?</DialogTitle>
            <DialogDescription>
              Du hast bereits einen aktiven Plan. Wenn du den neuen Plan festlegst,
              wird der bisherige automatisch archiviert.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>Abbrechen</DialogClose>
            <Button
              onClick={async () => {
                setConfirmActivateOpen(false);
                await persistPlan();
              }}
              disabled={isBusy}
            >
              Festlegen & archivieren
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Manueller Tausch */}
      <SwapDialog
        target={swapTarget}
        meals={meals ?? []}
        recipes={recipePool}
        onClose={() => setSwapTarget(null)}
        onPick={handleSwap}
      />
    </div>
  );
}

// =========================================================================
// Swap-Dialog
// =========================================================================

type SwapDialogProps = {
  target: { dayIndex: number; mealSlot: MealSlot } | null;
  meals: GeneratedMeal[];
  recipes: RecipeWithIngredients[];
  onClose: () => void;
  onPick: (dayIndex: number, mealSlot: MealSlot, recipeId: string) => void;
};

function SwapDialog({ target, meals, recipes, onClose, onPick }: SwapDialogProps) {
  const open = target !== null;

  const candidates = React.useMemo(() => {
    if (!target) return [];
    const usedToday = new Set(
      meals
        .filter(
          (m) => m.dayIndex === target.dayIndex && m.mealSlot !== target.mealSlot,
        )
        .map((m) => m.recipeId),
    );
    return recipes
      .filter((r) => r.meal_types.includes(target.mealSlot))
      .filter((r) => !usedToday.has(r.id))
      .slice()
      .sort((a, b) => a.name.localeCompare(b.name, "de"));
  }, [target, meals, recipes]);

  const currentRecipeId = React.useMemo(() => {
    if (!target) return null;
    const cur = meals.find(
      (m) => m.dayIndex === target.dayIndex && m.mealSlot === target.mealSlot,
    );
    return cur?.recipeId ?? null;
  }, [target, meals]);

  return (
    <Dialog open={open} onOpenChange={(o) => (!o ? onClose() : null)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Rezept tauschen</DialogTitle>
          <DialogDescription>
            {target
              ? `Wähle ein anderes Rezept für ${MEAL_SLOT_LABELS[target.mealSlot]}.`
              : ""}
          </DialogDescription>
        </DialogHeader>
        <div className="max-h-80 overflow-y-auto">
          {candidates.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Keine passenden Rezepte verfügbar.
            </p>
          ) : (
            <ul className="flex flex-col gap-1">
              {candidates.map((r) => {
                const isCurrent = r.id === currentRecipeId;
                return (
                  <li key={r.id}>
                    <button
                      type="button"
                      onClick={() =>
                        target && onPick(target.dayIndex, target.mealSlot, r.id)
                      }
                      disabled={isCurrent}
                      className="flex w-full items-center justify-between rounded-md border border-input px-3 py-2 text-left text-sm transition-colors hover:bg-muted disabled:opacity-50"
                    >
                      <span className="truncate">{r.name}</span>
                      {isCurrent && (
                        <span className="text-xs text-muted-foreground">aktuell</span>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>Schließen</DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// =========================================================================
// Generator Meal Card
// Eigene Komponente, weil sie lokalen State (Detail-Dialog) braucht und
// nicht in der `meals.map()`-Iteration in der Page sitzen darf.
// =========================================================================

type GeneratorMealCardProps = {
  meal: GeneratedMeal;
  recipe: RecipeWithIngredients | null;
  macros: Macros | null;
  onReroll: () => void;
  onSwap: () => void;
};

function GeneratorMealCard({
  meal,
  recipe,
  macros,
  onReroll,
  onSwap,
}: GeneratorMealCardProps) {
  const [detailOpen, setDetailOpen] = React.useState(false);
  const clickable = recipe != null;

  function handleContainerClick() {
    if (!clickable) return;
    // Klicks auf die Action-Buttons sollen den Dialog nicht öffnen — sie
    // stoppen Propagation selbst (siehe unten). Hier reicht der einfache
    // Bubble-Pfad: jeder Klick, der durchkommt, öffnet das Detail.
    setDetailOpen(true);
  }

  function handleContainerKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    if (!clickable) return;
    if (e.target !== e.currentTarget) return;
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      setDetailOpen(true);
    }
  }

  return (
    <>
      <div
        className={`flex flex-col gap-2 rounded-md border p-3 transition-colors sm:flex-row sm:items-center sm:justify-between ${
          clickable
            ? "cursor-pointer [@media(hover:hover)]:hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            : ""
        }`}
        role={clickable ? "button" : undefined}
        tabIndex={clickable ? 0 : undefined}
        aria-haspopup={clickable ? "dialog" : undefined}
        aria-expanded={clickable ? detailOpen : undefined}
        aria-label={
          clickable && recipe
            ? `Details zu ${MEAL_SLOT_LABELS[meal.mealSlot]}: ${recipe.name}`
            : undefined
        }
        onClick={clickable ? handleContainerClick : undefined}
        onKeyDown={clickable ? handleContainerKeyDown : undefined}
      >
        <div className="min-w-0 flex-1">
          <div className="mb-1">
            <MealSlotChip slot={meal.mealSlot} />
          </div>
          <div className="truncate text-sm font-medium">
            {recipe?.name ?? "Unbekanntes Rezept"}
          </div>
          <div className="text-xs text-muted-foreground">
            {meal.servingFactor.toFixed(2)}× Portion
            {macros ? ` · ${formatKcal(macros.kcal)}` : ""}
          </div>
        </div>
        <div
          className="flex gap-2"
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => e.stopPropagation()}
        >
          <Button type="button" variant="outline" size="sm" onClick={onReroll}>
            <Dices />
            Würfeln
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={onSwap}>
            <Replace />
            Tauschen
          </Button>
        </div>
      </div>

      {recipe && (
        <RecipeDetailDialog
          open={detailOpen}
          onOpenChange={setDetailOpen}
          recipe={recipe}
          servingFactor={meal.servingFactor}
          mealSlot={meal.mealSlot}
        />
      )}
    </>
  );
}
