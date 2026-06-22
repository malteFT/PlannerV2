"use client";

import * as React from "react";
import { Check, ChevronDown, X as XIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  ingredientMatchesQuery,
  ingredientRelevanceBucket,
} from "@/lib/domain/ingredient-search";
import type { IngredientWithBls } from "@/lib/db/types";

export type IngredientPickerProps = {
  value: string | null;
  onChange: (id: string | null) => void;
  ingredients: IngredientWithBls[];
  placeholder?: string;
  disabled?: boolean;
  invalid?: boolean;
  /**
   * Optional: zusätzliches Filter über das geladene Ingredient-Set.
   * Wird auf der Vorrat-Add-Seite genutzt, um bereits vorhandene Zutaten
   * auszublenden.
   */
  filter?: (i: IngredientWithBls) => boolean;
};

/**
 * Such-Picker für Zutaten — kombiniert Input + Trefferliste. Sucht in
 * `display_name` und `aliases` (case-insensitive), sortiert nach
 * Prefix > Word-Prefix > Substring.
 *
 * Ersetzt ein `<Select>` an Stellen, wo
 *   (a) die Liste lang ist (>20 Einträge), und
 *   (b) Type-To-Search im Default-Select schlecht funktioniert.
 *
 * Anzeige des aktuell gewählten Items als Badge mit „X"-Button zum
 * Zurücksetzen, analog zum BlsSearchPicker.
 */
export function IngredientPicker({
  value,
  onChange,
  ingredients,
  placeholder = "Zutat suchen…",
  disabled = false,
  invalid = false,
  filter,
}: IngredientPickerProps) {
  const [term, setTerm] = React.useState("");
  const [open, setOpen] = React.useState(false);
  const wrapperRef = React.useRef<HTMLDivElement | null>(null);
  const inputRef = React.useRef<HTMLInputElement | null>(null);

  const pool = React.useMemo(
    () => (filter ? ingredients.filter(filter) : ingredients),
    [ingredients, filter],
  );

  const selected = React.useMemo(
    () => pool.find((i) => i.id === value) ?? null,
    [pool, value],
  );

  const results = React.useMemo(() => {
    const q = term.trim();
    const matches = q === ""
      ? pool
      : pool.filter((i) => ingredientMatchesQuery(i, q));
    if (q === "") {
      return matches;
    }
    return [...matches].sort((a, b) => {
      const ba = ingredientRelevanceBucket(a, q);
      const bb = ingredientRelevanceBucket(b, q);
      if (ba !== bb) return ba - bb;
      return a.display_name.localeCompare(b.display_name, "de");
    });
  }, [pool, term]);

  // Outside-Click zum Schließen
  React.useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      if (!wrapperRef.current) return;
      if (!wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [open]);

  function pick(id: string) {
    onChange(id);
    setTerm("");
    setOpen(false);
  }

  function clearSelection() {
    onChange(null);
    setTerm("");
    setOpen(true);
    // Fokus zurück ins Input — sonst hängt der Tab-Order am Trigger
    setTimeout(() => inputRef.current?.focus(), 0);
  }

  // Wenn etwas ausgewählt ist und der Picker nicht offen ist, zeigen wir
  // den Namen als Badge-ähnliche Pille. Klick darauf öffnet den Picker
  // wieder zum Wechseln.
  const showSelectedPill = selected != null && !open;

  return (
    <div ref={wrapperRef} className="relative flex flex-col gap-2">
      {showSelectedPill ? (
        <button
          type="button"
          onClick={() => {
            setOpen(true);
            setTimeout(() => inputRef.current?.focus(), 0);
          }}
          disabled={disabled}
          data-invalid={invalid || undefined}
          className={cn(
            "flex h-10 w-full items-center justify-between gap-2 rounded-sm border border-input bg-card px-3 py-2 text-left text-sm transition-colors",
            "focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/20",
            "data-[invalid]:border-destructive data-[invalid]:ring-[3px] data-[invalid]:ring-destructive/20",
            "disabled:cursor-not-allowed disabled:opacity-60",
          )}
        >
          <span className="truncate">{selected.display_name}</span>
          <span className="flex items-center gap-1">
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              onClick={(e) => {
                e.stopPropagation();
                clearSelection();
              }}
              aria-label="Auswahl entfernen"
              disabled={disabled}
            >
              <XIcon />
            </Button>
            <ChevronDown className="size-4 text-muted-foreground" aria-hidden />
          </span>
        </button>
      ) : (
        <Input
          ref={inputRef}
          type="text"
          value={term}
          placeholder={placeholder}
          disabled={disabled}
          aria-invalid={invalid || undefined}
          onFocus={() => setOpen(true)}
          onChange={(e) => {
            setTerm(e.target.value);
            setOpen(true);
          }}
        />
      )}

      {open && !showSelectedPill && (
        <div
          className={cn(
            "absolute inset-x-0 top-full z-50 mt-1 rounded-lg border border-input bg-popover text-popover-foreground shadow-md",
            "max-h-64 overflow-y-auto",
          )}
        >
          {results.length === 0 && (
            <div className="px-2.5 py-2 text-sm text-muted-foreground">
              Keine Treffer
            </div>
          )}
          {results.map((i) => {
            const isCurrent = i.id === value;
            return (
              <button
                key={i.id}
                type="button"
                onClick={() => pick(i.id)}
                className={cn(
                  "flex w-full items-center justify-between gap-2 px-2.5 py-2 text-left text-sm hover:bg-accent hover:text-accent-foreground",
                  isCurrent && "bg-accent/60",
                )}
              >
                <span className="flex flex-col">
                  <span className="font-medium">{i.display_name}</span>
                  {i.aliases && i.aliases.length > 0 && (
                    <span className="text-xs text-muted-foreground">
                      {i.aliases.join(", ")}
                    </span>
                  )}
                </span>
                {isCurrent && (
                  <Check className="size-4 text-primary" aria-hidden />
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
