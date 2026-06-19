"use client";

import * as React from "react";
import Link from "next/link";
import { Plus, Carrot } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { useIngredients } from "@/lib/queries/ingredients";
import { UNIT_LABELS } from "@/lib/db/types";
import {
  macrosForIngredientAmount,
  formatKcal,
  formatGrams,
} from "@/lib/domain/nutrition";
import { PageHeader } from "@/components/layout/page-header";
import { Skeleton } from "@/components/ui/skeleton";

export default function IngredientsPage() {
  const [search, setSearch] = React.useState("");
  const [debounced, setDebounced] = React.useState("");
  const [onlyExcluded, setOnlyExcluded] = React.useState(false);

  React.useEffect(() => {
    const t = setTimeout(() => setDebounced(search), 200);
    return () => clearTimeout(t);
  }, [search]);

  const query = useIngredients(debounced);
  const items = (query.data ?? []).filter((i) =>
    onlyExcluded ? i.excluded : true,
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Zutaten"
        description="Zutatenkatalog mit BLS-Bezug."
        actions={
          <Button render={<Link href="/ingredients/new" />}>
            <Plus />
            Neu
          </Button>
        }
      />

      <section className="space-y-2">
        <h2 className="text-sm font-medium text-muted-foreground">Filter</h2>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <Input
            type="search"
            placeholder="Suche nach Name…"
            aria-label="Zutaten suchen"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="sm:max-w-sm"
          />
          <label className="flex items-center gap-2 text-sm">
            <Switch
              checked={onlyExcluded}
              onCheckedChange={(v) => setOnlyExcluded(!!v)}
            />
            <span>Nur ausgeschlossene</span>
          </label>
        </div>
      </section>

      {query.isLoading && (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="rounded-lg border border-border bg-card px-4 py-3"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-48" />
                  <Skeleton className="h-3 w-32" />
                </div>
                <div className="flex gap-2">
                  <Skeleton className="h-5 w-16" />
                  <Skeleton className="h-5 w-16" />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {query.isError && (
        <p className="text-sm text-destructive">
          Fehler:{" "}
          {query.error instanceof Error ? query.error.message : "Unbekannt"}
        </p>
      )}

      {!query.isLoading && !query.isError && items.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center gap-3 py-10 text-center">
            <Carrot className="size-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              Noch keine Zutaten — lege deine erste an.
            </p>
            <Button render={<Link href="/ingredients/new" />}>
              <Plus />
              Neu
            </Button>
          </CardContent>
        </Card>
      )}

      {items.length > 0 && (
        <div className="space-y-2">
          {items.map((i) => {
            // Makros pro 100 g für die Schnellansicht — direkt aus BLS.
            const per100 = {
              kcal: i.bls.kcal_per_100g,
              protein: i.bls.protein_per_100g,
              carbs: i.bls.carbs_per_100g,
              fat: i.bls.fat_per_100g,
            };
            // Bei Stück-Zutaten zusätzlich Makros pro Stück anzeigen.
            const perPiece =
              i.default_unit === "piece" && i.grams_per_piece
                ? macrosForIngredientAmount(1, "piece", i)
                : null;
            return (
              <Link
                key={i.id}
                href={`/ingredients/${i.id}`}
                className="card-interactive flex flex-col gap-2 rounded-lg border border-border bg-card px-4 py-3 transition-colors"
              >
                <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex flex-col gap-0.5 min-w-0">
                    <span className="font-medium text-foreground truncate">
                      {i.display_name}
                    </span>
                    <span className="text-xs text-muted-foreground truncate">
                      {i.bls?.name_de ?? "—"}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline">{i.category}</Badge>
                    <Badge variant="secondary">
                      {UNIT_LABELS[i.default_unit]}
                    </Badge>
                    {i.excluded && (
                      <Badge variant="destructive">ausgeschlossen</Badge>
                    )}
                  </div>
                </div>
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                  <span>
                    <span className="font-medium text-foreground">
                      {formatKcal(per100.kcal)}
                    </span>
                    {" "}/ 100 g
                  </span>
                  <span>P {formatGrams(per100.protein)}</span>
                  <span>KH {formatGrams(per100.carbs)}</span>
                  <span>F {formatGrams(per100.fat)}</span>
                  {perPiece && (
                    <span className="text-muted-foreground">
                      ({formatKcal(perPiece.kcal)} / Stück, {i.grams_per_piece} g)
                    </span>
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
