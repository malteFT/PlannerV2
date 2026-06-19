"use client";

import * as React from "react";
import { useForm, useFieldArray, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Trash2, Plus } from "lucide-react";
import { toast } from "sonner";

import {
  recipeFormSchema,
  type RecipeFormInput,
  type RecipeFormValues,
} from "@/lib/validators";
import {
  ALL_MEAL_SLOTS,
  ALL_UNITS,
  MEAL_SLOT_LABELS,
  UNIT_LABELS,
  type IngredientUnit,
  type MealSlot,
  type RecipeIngredientWithIngredient,
} from "@/lib/db/types";
import { useIngredients } from "@/lib/queries/ingredients";
import {
  macrosPerServing,
  formatKcal,
  formatGrams,
} from "@/lib/domain/nutrition";

import { Field } from "@/components/forms/field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
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
import { IngredientPicker } from "@/components/recipe/ingredient-picker";

type Props = {
  defaultValues?: Partial<RecipeFormInput>;
  onSubmit: (v: RecipeFormValues) => Promise<void>;
  submitLabel: string;
};

const EMPTY_DEFAULTS: RecipeFormInput = {
  name: "",
  meal_types: [],
  base_servings: 2,
  instructions: "",
  suppressed: false,
  ingredients: [],
};

export function RecipeForm({ defaultValues, onSubmit, submitLabel }: Props) {
  const form = useForm<RecipeFormInput, unknown, RecipeFormValues>({
    resolver: zodResolver(recipeFormSchema),
    defaultValues: { ...EMPTY_DEFAULTS, ...defaultValues },
  });
  const {
    control,
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = form;

  const { fields, append, remove } = useFieldArray({
    control,
    name: "ingredients",
  });

  const { data: ingredientsData = [] } = useIngredients();
  const ingredientsById = React.useMemo(() => {
    const m = new Map<string, (typeof ingredientsData)[number]>();
    for (const ing of ingredientsData) m.set(ing.id, ing);
    return m;
  }, [ingredientsData]);

  const watchedIngredients = watch("ingredients");
  const watchedBaseServings = watch("base_servings");

  const liveMacros = React.useMemo(() => {
    const items: RecipeIngredientWithIngredient[] = [];
    for (let i = 0; i < (watchedIngredients?.length ?? 0); i++) {
      const ri = watchedIngredients[i];
      if (!ri || !ri.ingredient_id) continue;
      const ing = ingredientsById.get(ri.ingredient_id);
      if (!ing) continue;
      const amount = Number(ri.amount);
      if (!Number.isFinite(amount) || amount <= 0) continue;
      items.push({
        recipe_id: "",
        ingredient_id: ri.ingredient_id,
        amount,
        unit: ri.unit as IngredientUnit,
        position: i,
        ingredient: ing,
      });
    }
    const baseServings = Number(watchedBaseServings);
    if (!Number.isFinite(baseServings) || baseServings <= 0) {
      return null;
    }
    return macrosPerServing(items, baseServings);
  }, [watchedIngredients, watchedBaseServings, ingredientsById]);

  const submit = handleSubmit(async (values) => {
    try {
      await onSubmit(values);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Speichern fehlgeschlagen";
      toast.error(msg);
    }
  });

  const usedIds = (watchedIngredients ?? [])
    .map((r) => r?.ingredient_id)
    .filter((id): id is string => !!id);

  return (
    <form onSubmit={submit} className="space-y-6">
      {/* Section: Allgemein */}
      <Card>
        <CardHeader>
          <CardTitle>Allgemein</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Field control={control} name="name" label="Name">
            {(f) => (
              <Input
                id="name"
                value={(f.value as string) ?? ""}
                onChange={(e) => f.onChange(e.target.value)}
                onBlur={f.onBlur}
                aria-invalid={f.invalid}
              />
            )}
          </Field>

          <Field
            control={control}
            name="base_servings"
            label="Basisportionen"
          >
            {(f) => (
              <Input
                id="base_servings"
                type="number"
                min={1}
                step={1}
                value={
                  f.value === undefined || f.value === null
                    ? ""
                    : String(f.value)
                }
                onChange={(e) => f.onChange(e.target.value)}
                onBlur={f.onBlur}
                aria-invalid={f.invalid}
              />
            )}
          </Field>

          <div className="flex flex-col gap-2">
            <Label>Mahlzeit-Kategorien</Label>
            <Controller
              control={control}
              name="meal_types"
              render={({ field }) => {
                const value = (field.value ?? []) as MealSlot[];
                return (
                  <div className="flex flex-wrap gap-3">
                    {ALL_MEAL_SLOTS.map((slot) => {
                      const checked = value.includes(slot);
                      return (
                        <label
                          key={slot}
                          className="flex items-center gap-2 rounded-md border border-input px-2.5 py-1 text-sm"
                        >
                          <Checkbox
                            checked={checked}
                            onCheckedChange={(c) => {
                              if (c) {
                                field.onChange([...value, slot]);
                              } else {
                                field.onChange(value.filter((s) => s !== slot));
                              }
                            }}
                          />
                          {MEAL_SLOT_LABELS[slot]}
                        </label>
                      );
                    })}
                  </div>
                );
              }}
            />
            {errors.meal_types?.message && (
              <p className="text-xs text-red-600" role="alert">
                {errors.meal_types.message as string}
              </p>
            )}
          </div>

          <Field
            control={control}
            name="instructions"
            label="Zubereitung (optional)"
          >
            {(f) => (
              <Textarea
                id="instructions"
                value={(f.value as string) ?? ""}
                onChange={(e) => f.onChange(e.target.value)}
                onBlur={f.onBlur}
                rows={5}
              />
            )}
          </Field>

          <div className="flex items-center justify-between gap-3">
            <Label htmlFor="suppressed">Nicht mehr vorschlagen</Label>
            <Controller
              control={control}
              name="suppressed"
              render={({ field }) => (
                <Switch
                  id="suppressed"
                  checked={!!field.value}
                  onCheckedChange={(c) => field.onChange(c)}
                />
              )}
            />
          </div>
        </CardContent>
      </Card>

      {/* Section: Zutaten + Live nutrition */}
      <Card>
        <CardHeader>
          <CardTitle>Zutaten</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Live nutrition card */}
          <div className="rounded-lg border border-input bg-muted/30 p-3">
            <p className="text-xs font-medium text-muted-foreground">
              Pro Portion (live)
            </p>
            {liveMacros ? (
              <div className="mt-1 grid grid-cols-2 gap-y-1 text-sm sm:grid-cols-4">
                <div>
                  <span className="text-muted-foreground">kcal: </span>
                  <span className="font-medium">{formatKcal(liveMacros.kcal)}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Protein: </span>
                  <span className="font-medium">
                    {formatGrams(liveMacros.protein)}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground">KH: </span>
                  <span className="font-medium">
                    {formatGrams(liveMacros.carbs)}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground">Fett: </span>
                  <span className="font-medium">
                    {formatGrams(liveMacros.fat)}
                  </span>
                </div>
              </div>
            ) : (
              <p className="mt-1 text-sm text-muted-foreground">
                Noch keine Angaben.
              </p>
            )}
          </div>

          {/* Ingredient rows */}
          <div className="space-y-3">
            {fields.map((field, index) => {
              const otherIds = usedIds.filter(
                (_, idx) => idx !== index,
              ) as string[];
              return (
                <div
                  key={field.id}
                  className="flex flex-col gap-2 rounded-lg border border-border p-3 sm:flex-row sm:items-start"
                >
                  <div className="flex-1 min-w-0">
                    <Controller
                      control={control}
                      name={`ingredients.${index}.ingredient_id`}
                      render={({ field: f, fieldState }) => (
                        <div className="flex flex-col gap-1">
                          <IngredientPicker
                            value={(f.value as string) ?? ""}
                            onChange={(id, hint) => {
                              f.onChange(id);
                              if (hint?.defaultUnit) {
                                setValue(
                                  `ingredients.${index}.unit`,
                                  hint.defaultUnit,
                                  { shouldDirty: true },
                                );
                              }
                            }}
                            excludeIds={otherIds}
                          />
                          {fieldState.error?.message && (
                            <p className="text-xs text-red-600" role="alert">
                              {fieldState.error.message}
                            </p>
                          )}
                        </div>
                      )}
                    />
                  </div>
                  <div className="flex items-start gap-2">
                    <div className="flex flex-col gap-1">
                      <Input
                        type="number"
                        min={0}
                        step="any"
                        placeholder="Menge"
                        className="w-24"
                        aria-invalid={!!errors.ingredients?.[index]?.amount}
                        {...register(`ingredients.${index}.amount`)}
                      />
                      {errors.ingredients?.[index]?.amount?.message && (
                        <p className="text-xs text-red-600" role="alert">
                          {errors.ingredients[index]?.amount?.message as string}
                        </p>
                      )}
                    </div>
                    <Controller
                      control={control}
                      name={`ingredients.${index}.unit`}
                      render={({ field: f }) => (
                        <Select
                          value={(f.value as string) ?? "g"}
                          onValueChange={(v) => f.onChange(v)}
                        >
                          <SelectTrigger className="w-24">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {ALL_UNITS.map((u) => (
                              <SelectItem key={u} value={u}>
                                {UNIT_LABELS[u]}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => remove(index)}
                      aria-label="Zutat entfernen"
                    >
                      <Trash2 />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>

          <Button
            type="button"
            variant="outline"
            onClick={() =>
              append({
                ingredient_id: "",
                amount: 0,
                unit: "g" as IngredientUnit,
              })
            }
          >
            <Plus />
            Zutat hinzufügen
          </Button>

          {errors.ingredients?.message && (
            <p className="text-xs text-red-600" role="alert">
              {errors.ingredients.message as string}
            </p>
          )}
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button type="submit" disabled={isSubmitting}>
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}
