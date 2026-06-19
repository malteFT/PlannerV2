"use client";

import * as React from "react";
import { useIngredients } from "@/lib/queries/ingredients";
import type { IngredientUnit } from "@/lib/db/types";
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
    const q = search.trim().toLowerCase();
    return ingredients.filter((i) => {
      if (excludeIds?.includes(i.id)) return false;
      if (!q) return true;
      return i.display_name.toLowerCase().includes(q);
    });
  }, [ingredients, search, excludeIds]);

  if (!showPicker && selected) {
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
        placeholder="Zutat suchen…"
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
            {filtered.map((i) => (
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
                  {i.display_name}
                  <span className="ml-2 text-xs text-muted-foreground">
                    {i.category}
                  </span>
                </button>
              </li>
            ))}
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
