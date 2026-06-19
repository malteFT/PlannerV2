"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { X as XIcon } from "lucide-react";

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
import { Badge } from "@/components/ui/badge";
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
  aliases: [],
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

      <Field
        control={form.control}
        name="aliases"
        label="Synonyme (optional)"
        description="Zusätzliche Suchbegriffe — z.B. 'Spaghetti, Penne, Pasta' bei einer Zutat 'Nudeln'. Im Rezept-Editor findest du die Zutat dann auch über diese Begriffe."
      >
        {(f) => (
          <AliasTagInput
            value={(f.value as string[] | undefined) ?? []}
            onChange={(next) => f.onChange(next)}
          />
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

/**
 * Tag-Input für Synonyme/Aliase.
 * - Comma oder Enter fügt das aktuelle Eingabewort als Tag hinzu
 * - Backspace im leeren Input entfernt den letzten Tag
 * - X-Button auf dem Tag löscht ihn
 * - Duplikate (case-insensitive) werden ignoriert
 */
function AliasTagInput({
  value,
  onChange,
}: {
  value: string[];
  onChange: (next: string[]) => void;
}) {
  const [draft, setDraft] = React.useState("");

  function commitDraft() {
    const trimmed = draft.trim();
    if (!trimmed) return;
    const lower = trimmed.toLowerCase();
    if (value.some((v) => v.toLowerCase() === lower)) {
      setDraft("");
      return;
    }
    onChange([...value, trimmed]);
    setDraft("");
  }

  function removeAt(index: number) {
    const next = value.slice();
    next.splice(index, 1);
    onChange(next);
  }

  return (
    <div className="flex flex-col gap-2">
      {value.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {value.map((alias, i) => (
            <Badge key={`${alias}-${i}`} variant="secondary" className="gap-1 pr-1">
              <span>{alias}</span>
              <button
                type="button"
                // mousedown preventDefault verhindert, dass der Input den Focus
                // verliert und sein onBlur den noch nicht commiteten Draft
                // versehentlich gleichzeitig hinzufügt → würde mit dieser
                // Remove-Operation racen.
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => removeAt(i)}
                className="rounded-full p-0.5 hover:bg-muted-foreground/20"
                aria-label={`${alias} entfernen`}
              >
                <XIcon className="size-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}
      <Input
        value={draft}
        placeholder="Synonym tippen, Enter oder Komma zum Bestätigen"
        onChange={(e) => {
          const next = e.target.value;
          // Wenn der String ein Komma enthält, splitten wir und committen
          // alles links vom letzten Komma. Funktioniert auch bei Paste:
          // "Spaghetti, Penne, Pasta" → 3 Tags + leerer Draft.
          if (next.includes(",")) {
            const parts = next.split(",");
            const tail = parts.pop() ?? ""; // letzter Teil bleibt im Input
            const toCommit = parts.map((p) => p.trim()).filter(Boolean);
            if (toCommit.length > 0) {
              const existing = new Set(value.map((v) => v.toLowerCase()));
              const additions: string[] = [];
              for (const c of toCommit) {
                const lower = c.toLowerCase();
                if (!existing.has(lower)) {
                  existing.add(lower);
                  additions.push(c);
                }
              }
              if (additions.length > 0) {
                onChange([...value, ...additions]);
              }
            }
            setDraft(tail);
          } else {
            setDraft(next);
          }
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            commitDraft();
          } else if (e.key === "Backspace" && draft === "" && value.length > 0) {
            // Letzten Tag löschen
            removeAt(value.length - 1);
          }
        }}
        onBlur={commitDraft}
      />
    </div>
  );
}
