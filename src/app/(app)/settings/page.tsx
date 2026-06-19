"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Pencil, Check, X, Plus } from "lucide-react";
import { toast } from "sonner";

import { useSettings, useUpdateSettings } from "@/lib/queries/settings";
import { useIngredients } from "@/lib/queries/ingredients";
import { signOut } from "@/app/(auth)/login/actions";
import {
  ALL_MEAL_SLOTS,
  MEAL_SLOT_LABELS,
  type MealSlot,
} from "@/lib/db/types";
import {
  userSettingsFormSchema,
  type UserSettingsFormInput,
  type UserSettingsFormValues,
} from "@/lib/validators";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Field } from "@/components/forms/field";
import { preventEnterSubmit } from "@/components/forms/keyboard";

const DEFAULT_VALUES: UserSettingsFormInput = {
  target_kcal_per_day: 2000,
  protein_pct: 30,
  carbs_pct: 40,
  fat_pct: 30,
  meal_slots: ["breakfast", "lunch", "dinner"],
  meal_slot_pct: [30, 40, 30],
  tolerance_pct: 10,
  excluded_ingredient_ids: [],
};

function formatPct(n: number) {
  return `${Math.round(n * 10) / 10} %`;
}

function formatGrams(n: number) {
  return `${Math.round(n * 10) / 10} g`;
}

function distributeEqually(count: number): number[] {
  if (count <= 0) return [];
  const base = Math.floor((100 / count) * 10) / 10;
  const arr = new Array(count).fill(base);
  const rest = Math.round((100 - base * count) * 10) / 10;
  arr[0] = Math.round((arr[0] + rest) * 10) / 10;
  return arr;
}

/**
 * Default-Anteile pro Mahlzeit. Wenn die aktuelle Slot-Auswahl genau einer
 * dieser Konfigurationen entspricht, nehmen wir den definierten Default —
 * sonst gleichmäßig verteilen.
 */
const DEFAULT_DISTRIBUTIONS: ReadonlyArray<{
  slots: ReadonlyArray<MealSlot>;
  pct: ReadonlyArray<number>;
}> = [
  { slots: ["breakfast", "lunch", "dinner"], pct: [30, 40, 30] },
  { slots: ["breakfast", "lunch", "dinner", "snack"], pct: [25, 35, 30, 10] },
  { slots: ["breakfast", "lunch"], pct: [40, 60] },
  { slots: ["lunch", "dinner"], pct: [55, 45] },
  { slots: ["breakfast", "dinner"], pct: [40, 60] },
  { slots: ["lunch"], pct: [100] },
  { slots: ["dinner"], pct: [100] },
  { slots: ["breakfast"], pct: [100] },
  { slots: ["snack"], pct: [100] },
];

function distributionFor(slots: MealSlot[]): number[] {
  const match = DEFAULT_DISTRIBUTIONS.find(
    (d) =>
      d.slots.length === slots.length &&
      d.slots.every((s, i) => s === slots[i]),
  );
  return match ? [...match.pct] : distributeEqually(slots.length);
}

export default function SettingsPage() {
  const settingsQuery = useSettings();
  const updateMutation = useUpdateSettings();
  const ingredientsQuery = useIngredients();

  const form = useForm<UserSettingsFormInput, unknown, UserSettingsFormValues>({
    resolver: zodResolver(userSettingsFormSchema),
    defaultValues: DEFAULT_VALUES,
    mode: "onChange",
  });

  // Sync loaded settings into the form once available.
  React.useEffect(() => {
    const s = settingsQuery.data;
    if (!s) return;
    form.reset({
      target_kcal_per_day: s.target_kcal_per_day,
      protein_pct: s.protein_pct,
      carbs_pct: s.carbs_pct,
      fat_pct: s.fat_pct,
      meal_slots: s.meal_slots,
      meal_slot_pct: s.meal_slot_pct,
      tolerance_pct: s.tolerance_pct,
      excluded_ingredient_ids: s.excluded_ingredient_ids ?? [],
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settingsQuery.data]);

  // Watch form values for derived UI.
  const kcal = form.watch("target_kcal_per_day");
  const proteinPct = form.watch("protein_pct");
  const carbsPct = form.watch("carbs_pct");
  const fatPct = form.watch("fat_pct");
  const mealSlots = form.watch("meal_slots");
  const mealSlotPct = form.watch("meal_slot_pct");
  const excludedIds = form.watch("excluded_ingredient_ids");

  const macroSum = (proteinPct ?? 0) + (carbsPct ?? 0) + (fatPct ?? 0);
  const macroSumOk = Math.round(macroSum * 100) === 10000;

  const slotSum = (mealSlotPct ?? []).reduce((s, x) => s + (x ?? 0), 0);
  const slotSumOk = Math.round(slotSum * 100) === 10000;
  const slotLengthOk = (mealSlots?.length ?? 0) === (mealSlotPct?.length ?? 0);

  // Derived gram values (4/4/9 kcal-per-gram rule).
  const proteinG = ((proteinPct ?? 0) * 0.01 * (kcal ?? 0)) / 4;
  const carbsG = ((carbsPct ?? 0) * 0.01 * (kcal ?? 0)) / 4;
  const fatG = ((fatPct ?? 0) * 0.01 * (kcal ?? 0)) / 9;

  const [editingSlots, setEditingSlots] = React.useState(false);
  const [ingredientSearch, setIngredientSearch] = React.useState("");
  const [showDropdown, setShowDropdown] = React.useState(false);

  const ingredientsData = ingredientsQuery.data;
  const allIngredients = React.useMemo(
    () => ingredientsData ?? [],
    [ingredientsData],
  );
  const excludedIngredients = React.useMemo(
    () => allIngredients.filter((i) => (excludedIds ?? []).includes(i.id)),
    [allIngredients, excludedIds],
  );

  const dropdownCandidates = React.useMemo(() => {
    const q = ingredientSearch.trim().toLowerCase();
    return allIngredients
      .filter((i) => !(excludedIds ?? []).includes(i.id))
      .filter((i) =>
        q.length === 0 ? true : i.display_name.toLowerCase().includes(q),
      )
      .slice(0, 20);
  }, [allIngredients, excludedIds, ingredientSearch]);

  function toggleSlot(slot: MealSlot, on: boolean) {
    const current = [...(mealSlots ?? [])];
    let next: MealSlot[];
    if (on) {
      if (current.includes(slot)) return;
      // Preserve canonical order.
      next = ALL_MEAL_SLOTS.filter((s) => current.includes(s) || s === slot);
    } else {
      next = current.filter((s) => s !== slot);
      if (next.length === 0) {
        toast.error("Mindestens eine Mahlzeit ist erforderlich.");
        return;
      }
    }
    const nextPct = distributionFor(next);
    form.setValue("meal_slots", next, { shouldValidate: true, shouldDirty: true });
    form.setValue("meal_slot_pct", nextPct, {
      shouldValidate: true,
      shouldDirty: true,
    });
  }

  function setSlotPct(idx: number, value: number) {
    const next = [...(mealSlotPct ?? [])];
    next[idx] = value;
    form.setValue("meal_slot_pct", next, {
      shouldValidate: true,
      shouldDirty: true,
    });
  }

  function addExcluded(id: string) {
    const next = Array.from(new Set([...(excludedIds ?? []), id]));
    form.setValue("excluded_ingredient_ids", next, {
      shouldValidate: true,
      shouldDirty: true,
    });
    setIngredientSearch("");
    setShowDropdown(false);
  }

  function removeExcluded(id: string) {
    const next = (excludedIds ?? []).filter((x) => x !== id);
    form.setValue("excluded_ingredient_ids", next, {
      shouldValidate: true,
      shouldDirty: true,
    });
  }

  async function onSubmit(values: UserSettingsFormValues) {
    try {
      await updateMutation.mutateAsync(values);
      toast.success("Einstellungen gespeichert");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Speichern fehlgeschlagen";
      toast.error(msg);
    }
  }

  const submitDisabled =
    !macroSumOk ||
    !slotSumOk ||
    !slotLengthOk ||
    updateMutation.isPending ||
    settingsQuery.isLoading;

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="text-muted-foreground">
          Globales Profil — Energie, Makros, Mahlzeiten, Ausschluss.
        </p>
      </div>

      {settingsQuery.isLoading ? (
        <p className="text-sm text-muted-foreground">Lade Einstellungen…</p>
      ) : (
        <form
          onSubmit={form.handleSubmit(onSubmit)}
          onKeyDown={preventEnterSubmit}
          className="space-y-6"
        >
          {/* 1. Energieziel & Makros */}
          <Card>
            <CardHeader>
              <CardTitle>Energieziel & Makros</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Field
                control={form.control}
                name="target_kcal_per_day"
                label="Tagesziel (kcal)"
              >
                {(f) => (
                  <Input
                    id="target_kcal_per_day"
                    type="number"
                    min={1}
                    step={1}
                    value={f.value ?? ""}
                    onChange={(e) =>
                      f.onChange(
                        e.target.value === "" ? undefined : Number(e.target.value),
                      )
                    }
                    onBlur={f.onBlur}
                    aria-invalid={f.invalid}
                  />
                )}
              </Field>

              <Separator />

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <Field
                  control={form.control}
                  name="protein_pct"
                  label="Protein (%)"
                  description={`= ${formatGrams(proteinG)}`}
                >
                  {(f) => (
                    <Input
                      type="number"
                      min={0}
                      max={100}
                      step={1}
                      value={f.value ?? ""}
                      onChange={(e) =>
                        f.onChange(
                          e.target.value === "" ? 0 : Number(e.target.value),
                        )
                      }
                      onBlur={f.onBlur}
                      aria-invalid={f.invalid}
                    />
                  )}
                </Field>
                <Field
                  control={form.control}
                  name="carbs_pct"
                  label="Kohlenhydrate (%)"
                  description={`= ${formatGrams(carbsG)}`}
                >
                  {(f) => (
                    <Input
                      type="number"
                      min={0}
                      max={100}
                      step={1}
                      value={f.value ?? ""}
                      onChange={(e) =>
                        f.onChange(
                          e.target.value === "" ? 0 : Number(e.target.value),
                        )
                      }
                      onBlur={f.onBlur}
                      aria-invalid={f.invalid}
                    />
                  )}
                </Field>
                <Field
                  control={form.control}
                  name="fat_pct"
                  label="Fett (%)"
                  description={`= ${formatGrams(fatG)}`}
                >
                  {(f) => (
                    <Input
                      type="number"
                      min={0}
                      max={100}
                      step={1}
                      value={f.value ?? ""}
                      onChange={(e) =>
                        f.onChange(
                          e.target.value === "" ? 0 : Number(e.target.value),
                        )
                      }
                      onBlur={f.onBlur}
                      aria-invalid={f.invalid}
                    />
                  )}
                </Field>
              </div>

              <p
                className={
                  macroSumOk
                    ? "text-sm text-muted-foreground"
                    : "text-sm text-red-600"
                }
                role={macroSumOk ? undefined : "alert"}
              >
                Summe: {formatPct(macroSum)}
                {!macroSumOk && " — muss exakt 100 % ergeben"}
              </p>
            </CardContent>
          </Card>

          {/* 2. Mahlzeitenverteilung */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Mahlzeitenverteilung</CardTitle>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setEditingSlots((v) => !v)}
                aria-label={
                  editingSlots
                    ? "Mahlzeitenauswahl schließen"
                    : "Mahlzeitenauswahl bearbeiten"
                }
              >
                {editingSlots ? (
                  <Check className="size-4" />
                ) : (
                  <Pencil className="size-4" />
                )}
              </Button>
            </CardHeader>
            <CardContent className="space-y-4">
              {editingSlots && (
                <div className="flex flex-wrap gap-4">
                  {ALL_MEAL_SLOTS.map((slot) => {
                    const checked = (mealSlots ?? []).includes(slot);
                    return (
                      <label
                        key={slot}
                        className="flex items-center gap-2 text-sm"
                      >
                        <Checkbox
                          checked={checked}
                          onCheckedChange={(v) => toggleSlot(slot, v === true)}
                        />
                        <span>{MEAL_SLOT_LABELS[slot]}</span>
                      </label>
                    );
                  })}
                </div>
              )}

              <div className="space-y-3">
                {(mealSlots ?? []).map((slot, idx) => (
                  <div
                    key={slot}
                    className="grid grid-cols-[1fr_auto] items-center gap-3"
                  >
                    <Label htmlFor={`slot-${slot}`}>
                      {MEAL_SLOT_LABELS[slot]}
                    </Label>
                    <div className="flex items-center gap-2">
                      <Input
                        id={`slot-${slot}`}
                        type="number"
                        min={0}
                        max={100}
                        step={1}
                        className="w-24"
                        value={mealSlotPct?.[idx] ?? 0}
                        onChange={(e) =>
                          setSlotPct(
                            idx,
                            e.target.value === "" ? 0 : Number(e.target.value),
                          )
                        }
                      />
                      <span className="text-sm text-muted-foreground">%</span>
                    </div>
                  </div>
                ))}
              </div>

              <p
                className={
                  slotSumOk && slotLengthOk
                    ? "text-sm text-muted-foreground"
                    : "text-sm text-red-600"
                }
                role={slotSumOk && slotLengthOk ? undefined : "alert"}
              >
                Summe: {formatPct(slotSum)}
                {!slotSumOk && " — muss exakt 100 % ergeben"}
              </p>
            </CardContent>
          </Card>

          {/* 3. Generator-Constraints */}
          <Card>
            <CardHeader>
              <CardTitle>Generator-Constraints</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Field
                control={form.control}
                name="tolerance_pct"
                label="Toleranz (%)"
                description="Erlaubte Abweichung vom Tagesziel je Tag."
              >
                {(f) => (
                  <Input
                    type="number"
                    min={0}
                    max={50}
                    step={1}
                    value={f.value ?? ""}
                    onChange={(e) =>
                      f.onChange(
                        e.target.value === "" ? 0 : Number(e.target.value),
                      )
                    }
                    onBlur={f.onBlur}
                    aria-invalid={f.invalid}
                  />
                )}
              </Field>

              <Separator />

              <div className="space-y-3">
                <Label>Ausgeschlossene Zutaten</Label>
                {excludedIngredients.length === 0 ? (
                  <p className="text-xs text-muted-foreground">
                    Keine Zutaten ausgeschlossen.
                  </p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {excludedIngredients.map((i) => (
                      <Badge key={i.id} variant="secondary" className="gap-1 pr-1">
                        <span>{i.display_name}</span>
                        <button
                          type="button"
                          onClick={() => removeExcluded(i.id)}
                          className="rounded-full p-0.5 hover:bg-muted-foreground/20"
                          aria-label={`${i.display_name} entfernen`}
                        >
                          <X className="size-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                )}

                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Input
                      placeholder="Zutat suchen…"
                      value={ingredientSearch}
                      onChange={(e) => {
                        setIngredientSearch(e.target.value);
                        setShowDropdown(true);
                      }}
                      onFocus={() => setShowDropdown(true)}
                      aria-label="Auszuschließende Zutat suchen"
                    />
                    {showDropdown && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setShowDropdown(false);
                          setIngredientSearch("");
                        }}
                      >
                        Schließen
                      </Button>
                    )}
                  </div>
                  {showDropdown && (
                    <div className="rounded-md border border-input bg-card max-h-60 overflow-auto">
                      {dropdownCandidates.length === 0 ? (
                        <p className="px-3 py-2 text-sm text-muted-foreground">
                          {allIngredients.length === 0
                            ? "Noch keine Zutaten angelegt."
                            : "Keine Treffer."}
                        </p>
                      ) : (
                        dropdownCandidates.map((i) => (
                          <button
                            key={i.id}
                            type="button"
                            onClick={() => addExcluded(i.id)}
                            className="flex w-full items-center justify-between gap-2 px-3 py-2 text-sm hover:bg-muted text-left"
                          >
                            <span>{i.display_name}</span>
                            <Plus className="size-3.5 text-muted-foreground" />
                          </button>
                        ))
                      )}
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Submit */}
          <div className="flex items-center gap-3">
            <Button type="submit" disabled={submitDisabled}>
              {updateMutation.isPending ? "Speichere…" : "Speichern"}
            </Button>
            {(!macroSumOk || !slotSumOk || !slotLengthOk) && (
              <span className="text-xs text-red-600" role="alert">
                Bitte Prozentsummen korrigieren.
              </span>
            )}
          </div>
        </form>
      )}

      {/* 4. Konto */}
      <Card>
        <CardHeader>
          <CardTitle>Konto</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={signOut}>
            <Button type="submit" variant="outline">
              Abmelden
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
