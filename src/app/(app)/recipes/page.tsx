"use client";

import * as React from "react";
import Link from "next/link";
import { Plus } from "lucide-react";

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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";

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
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Rezepte</h1>
        <Link href="/recipes/new" className={cn(buttonVariants())}>
          <Plus />
          Neu
        </Link>
      </div>

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
              <SelectValue />
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

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Lädt…</p>
      ) : recipes.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Keine Rezepte gefunden.
        </p>
      ) : (
        <div className="grid gap-3">
          {recipes.map((r) => {
            const macros = macrosPerServing(r.ingredients, r.base_servings);
            return (
              <Link key={r.id} href={`/recipes/${r.id}`} className="block">
                <Card className="hover:bg-accent/30">
                  <CardContent className="flex items-center justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="truncate font-medium">{r.name}</p>
                        {r.suppressed && (
                          <Badge variant="destructive">unterdrückt</Badge>
                        )}
                      </div>
                      <div className="mt-1 flex flex-wrap gap-1">
                        {r.meal_types.map((mt) => (
                          <Badge key={mt} variant="secondary">
                            {MEAL_SLOT_LABELS[mt]}
                          </Badge>
                        ))}
                      </div>
                    </div>
                    <div className="text-right text-xs text-muted-foreground">
                      <div>{formatKcal(macros.kcal)} / Portion</div>
                      <div>{r.ingredients.length} Zutaten</div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
