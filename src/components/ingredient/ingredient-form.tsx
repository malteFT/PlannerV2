"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Field } from "@/components/forms/field";
import { preventEnterSubmit } from "@/components/forms/keyboard";
import { BlsSearchPicker } from "@/components/ingredient/bls-search-picker";
import {
  ALL_UNITS,
  INGREDIENT_CATEGORIES,
  UNIT_LABELS,
} from "@/lib/db/types";
import { z } from "zod";
import {
  ingredientFormSchema,
  type IngredientFormValues,
} from "@/lib/validators";

type IngredientFormInput = z.input<typeof ingredientFormSchema>;

type Props = {
  defaultValues?: Partial<IngredientFormInput>;
  onSubmit: (v: IngredientFormValues) => Promise<void>;
  submitLabel: string;
};

const EMPTY_DEFAULTS: IngredientFormInput = {
  display_name: "",
  bls_code: "",
  default_unit: "g",
  grams_per_piece: null,
  category: INGREDIENT_CATEGORIES[0],
  excluded: false,
};

export function IngredientForm({ defaultValues, onSubmit, submitLabel }: Props) {
  const form = useForm<IngredientFormInput, unknown, IngredientFormValues>({
    resolver: zodResolver(ingredientFormSchema),
    defaultValues: { ...EMPTY_DEFAULTS, ...defaultValues },
  });

  const unit = form.watch("default_unit");

  const handle = form.handleSubmit(async (values) => {
    try {
      await onSubmit(values);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Unbekannter Fehler";
      toast.error(msg);
    }
  });

  return (
    <form onSubmit={handle} onKeyDown={preventEnterSubmit} className="flex max-w-xl flex-col gap-4">
      <Field control={form.control} name="display_name" label="Name">
        {(f) => (
          <Input
            value={(f.value as string) ?? ""}
            onChange={(e) => f.onChange(e.target.value)}
            onBlur={f.onBlur}
            aria-invalid={f.invalid || undefined}
            placeholder="z.B. Apfel rot"
          />
        )}
      </Field>

      <Field control={form.control} name="bls_code" label="BLS-Eintrag">
        {(f) => (
          <BlsSearchPicker
            value={(f.value as string) ?? ""}
            invalid={f.invalid}
            onChange={(code) => f.onChange(code)}
          />
        )}
      </Field>

      <Field control={form.control} name="default_unit" label="Standard-Einheit">
        {(f) => (
          <Select
            value={(f.value as string) ?? "g"}
            onValueChange={(v) => f.onChange(v)}
          >
            <SelectTrigger aria-invalid={f.invalid || undefined}>
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
      </Field>

      {unit === "piece" && (
        <Field
          control={form.control}
          name="grams_per_piece"
          label="Gramm pro Stück"
        >
          {(f) => (
            <Input
              type="number"
              step="0.1"
              min="0"
              value={
                typeof f.value === "number" && Number.isFinite(f.value)
                  ? String(f.value)
                  : ""
              }
              onChange={(e) => {
                const raw = e.target.value;
                if (raw === "") {
                  f.onChange(null);
                } else {
                  const n = Number(raw);
                  f.onChange(Number.isFinite(n) ? n : null);
                }
              }}
              onBlur={f.onBlur}
              aria-invalid={f.invalid || undefined}
              placeholder="z.B. 180"
            />
          )}
        </Field>
      )}

      <Field control={form.control} name="category" label="Kategorie">
        {(f) => (
          <Select
            value={(f.value as string) ?? INGREDIENT_CATEGORIES[0]}
            onValueChange={(v) => f.onChange(v)}
          >
            <SelectTrigger aria-invalid={f.invalid || undefined}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {INGREDIENT_CATEGORIES.map((c) => (
                <SelectItem key={c} value={c}>
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </Field>

      <p className="text-xs text-muted-foreground">
        Globale Ausschluss-Liste für den Generator wird in den Settings gepflegt.
      </p>

      <div className="flex gap-2">
        <Button type="submit" disabled={form.formState.isSubmitting}>
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}
