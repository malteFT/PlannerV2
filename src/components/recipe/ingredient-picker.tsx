"use client";

import * as React from "react";
import { useIngredients } from "@/lib/queries/ingredients";
import type { IngredientUnit } from "@/lib/db/types";
import {
  ingredientMatchesQuery,
  ingredientRelevanceBucket,
} from "@/lib/domain/ingredient-search";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Props = {
  value: string;
  onChange: (id: string, hint?: { defaultUnit: IngredientUnit }) => void;
  excludeIds?: string[];
};

export function IngredientPicker({ value, onChange, excludeIds }: Props) {
  const { data: ingredients = [], isLoading } = useIngredients();
  const [open, setOpen] = React.useState(false);
  const [search, setSearch] = React.useState("");

  const selected = React.useMemo(
    () => ingredients.find((i) => i.id === value),
    [ingredients, value],
  );

  // Auto-open in picker mode when no selection yet
  const showPicker = open || !value;

  const filtered = React.useMemo(() => {
    const matches = ingredients.filter((i) => {
      if (excludeIds?.includes(i.id)) return false;
      return ingredientMatchesQuery(i, search);
    });
    if (search.trim() === "") {
      // Ohne Suche: alphabetisch.
      return [...matches].sort((a, b) =>
        a.display_name.localeCompare(b.display_name, "de"),
      );
    }
    // Mit Suche: nach Relevanz (Prefix → Wort-Prefix → Substring),
    // innerhalb gleichem Bucket alphabetisch.
    return [...matches].sort((a, b) => {
      const ba = ingredientRelevanceBucket(a, search);
      const bb = ingredientRelevanceBucket(b, search);
      if (ba !== bb) return ba - bb;
      return a.display_name.localeCompare(b.display_name, "de");
    });
  }, [ingredients, search, excludeIds]);

  if (!showPicker && selected) {
    // Wenn die ausgewählte Zutat einen Alias hat, der vom display_name
    // abweicht, ist es hilfreich kurz zu zeigen — aber bei eindeutigen
    // Zutaten wäre das Lärm. Wir lassen es bei display_name.
    return (
      <div className="flex items-center justify-between gap-2 rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm">
        <span className="truncate">{selected.display_name}</span>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => setOpen(true)}
        >
          Ändern
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1 rounded-lg border border-input p-2">
      <Input
        placeholder="Zutat suchen (auch Synonyme)…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        autoFocus
      />
      <div className="max-h-48 overflow-auto rounded-md">
        {isLoading ? (
          <p className="px-2 py-1 text-xs text-muted-foreground">Lädt…</p>
        ) : filtered.length === 0 ? (
          <p className="px-2 py-1 text-xs text-muted-foreground">
            Keine Zutaten gefunden.
          </p>
        ) : (
          <ul className="flex flex-col">
            {filtered.map((i) => {
              // Wenn ein Alias den Treffer ausgelöst hat, zeigen wir ihn
              // hinter dem Namen an, damit der User versteht, warum die
              // Zutat erscheint. Wir wählen den Alias mit dem besten
              // Bucket (Prefix > Wort-Prefix > Substring), nicht den ersten.
              const q = search.trim().toLowerCase();
              let matchedAlias: string | null = null;
              if (q !== "" && !i.display_name.toLowerCase().includes(q)) {
                let bestBucket = 3;
                for (const a of i.aliases ?? []) {
                  const lower = a.toLowerCase();
                  let bucket: number;
                  if (lower.startsWith(q)) bucket = 0;
                  else if (
                    lower
                      .split(/[\s,/\-]+/)
                      .filter(Boolean)
                      .some((tok) => tok.startsWith(q))
                  )
                    bucket = 1;
                  else if (lower.includes(q)) bucket = 2;
                  else bucket = 3;
                  if (bucket < bestBucket) {
                    bestBucket = bucket;
                    matchedAlias = a;
                  }
                }
              }
              return (
                <li key={i.id}>
                  <button
                    type="button"
                    className="w-full rounded-md px-2 py-1 text-left text-sm hover:bg-accent hover:text-accent-foreground"
                    onClick={() => {
                      onChange(i.id, { defaultUnit: i.default_unit });
                      setSearch("");
                      setOpen(false);
                    }}
                  >
                    <span className="font-medium">{i.display_name}</span>
                    {matchedAlias && (
                      <span className="ml-1 text-xs italic text-muted-foreground">
                        (auch „{matchedAlias}“)
                      </span>
                    )}
                    <span className="ml-2 text-xs text-muted-foreground">
                      {i.category}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
      {value && (
        <div className="flex justify-end">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setOpen(false)}
          >
            Abbrechen
          </Button>
        </div>
      )}
    </div>
  );
}
