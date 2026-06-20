"use client";

import * as React from "react";
import Link from "next/link";
import { Plus, UtensilsCrossed } from "lucide-react";

import { useRecipes } from "@/lib/queries/recipes";
import {
  ALL_MEAL_SLOTS,
  MEAL_SLOT_LABELS,
  type MealSlot,
} from "@/lib/db/types";
import { macrosPerServing, formatKcal } from "@/lib/domain/nutrition";

import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { MealSlotChip } from "@/components/plan/meal-slot-chip";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/layout/page-header";
import { Skeleton } from "@/components/ui/skeleton";

const ALL_VALUE = "__all__";

export default function RecipesPage() {
  const [searchInput, setSearchInput] = React.useState("");
  const [debouncedQuery, setDebouncedQuery] = React.useState("");
  const [mealType, setMealType] = React.useState<MealSlot | undefined>(
    undefined,
  );
  const [includeSuppressed, setIncludeSuppressed] = React.useState(false);

  React.useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(searchInput), 200);
    return () => clearTimeout(t);
  }, [searchInput]);

  const { data: recipes = [], isLoading } = useRecipes({
    query: debouncedQuery || undefined,
    mealType,
    includeSuppressed,
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Rezepte"
        actions={
          <Link href="/recipes/new" className={cn(buttonVariants())}>
            <Plus />
            Neu
          </Link>
        }
      />

      <section className="space-y-2">
        <h2 className="text-sm font-medium text-muted-foreground">Filter</h2>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex-1">
            <Label htmlFor="recipe-search" className="text-xs">
              Suche
            </Label>
            <Input
              id="recipe-search"
              placeholder="Nach Name suchen…"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
            />
          </div>
          <div>
            <Label className="text-xs">Mahlzeit</Label>
            <Select
              value={mealType ?? ALL_VALUE}
              onValueChange={(v) => {
                setMealType(v === ALL_VALUE ? undefined : (v as MealSlot));
              }}
            >
              <SelectTrigger className="w-40">
                <SelectValue>
                  {(v) =>
                    v === ALL_VALUE
                      ? "Alle"
                      : MEAL_SLOT_LABELS[v as MealSlot]
                  }
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_VALUE}>Alle</SelectItem>
                {ALL_MEAL_SLOTS.map((slot) => (
                  <SelectItem key={slot} value={slot}>
                    {MEAL_SLOT_LABELS[slot]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2">
            <Switch
              id="include-suppressed"
              checked={includeSuppressed}
              onCheckedChange={(c) => setIncludeSuppressed(!!c)}
            />
            <Label htmlFor="include-suppressed" className="text-sm">
              Auch unterdrückte zeigen
            </Label>
          </div>
        </div>
      </section>

      {isLoading ? (
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
                <div className="space-y-2 text-right">
                  <Skeleton className="h-3 w-24" />
                  <Skeleton className="h-3 w-16" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : recipes.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center gap-3 py-10 text-center">
            <UtensilsCrossed className="size-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              Noch keine Rezepte angelegt.
            </p>
            <Link href="/recipes/new" className={cn(buttonVariants())}>
              <Plus />
              Neu
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {recipes.map((r) => {
            const macros = macrosPerServing(r.ingredients, r.base_servings);
            return (
              <Link
                key={r.id}
                href={`/recipes/${r.id}`}
                className="card-interactive flex items-center justify-between gap-3 rounded-lg border border-border bg-card px-4 py-3 transition-colors"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate font-medium text-foreground">
                      {r.name}
                    </p>
                    {r.suppressed && (
                      <Badge variant="destructive">unterdrückt</Badge>
                    )}
                  </div>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {r.meal_types.map((mt) => (
                      <MealSlotChip key={mt} slot={mt} />
                    ))}
                  </div>
                </div>
                <div className="text-right text-xs text-muted-foreground">
                  <div>{formatKcal(macros.kcal)} / Portion</div>
                  <div>{r.ingredients.length} Zutaten</div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
