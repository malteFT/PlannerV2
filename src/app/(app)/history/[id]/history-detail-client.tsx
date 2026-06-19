"use client";

import * as React from "react";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

import { usePlan } from "@/lib/queries/plans";
import { macrosForMeal, formatKcal, formatGrams } from "@/lib/domain/nutrition";
import { MEAL_SLOT_LABELS } from "@/lib/db/types";

function formatDateTime(iso: string | null): string {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    return d.toLocaleString("de-DE", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

export function HistoryDetailClient({ id }: { id: string }) {
  const query = usePlan(id);

  if (query.isLoading) {
    return <p className="text-sm text-muted-foreground">Lade…</p>;
  }
  if (query.isError) {
    return (
      <p className="text-sm text-red-600">
        Fehler:{" "}
        {query.error instanceof Error ? query.error.message : "Unbekannt"}
      </p>
    );
  }
  const plan = query.data;
  if (!plan) {
    return <p className="text-sm text-muted-foreground">Nicht gefunden.</p>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon-sm"
            render={<Link href="/history" />}
          >
            <ChevronLeft />
          </Button>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              {plan.name ?? "Plan"}
            </h1>
            <p className="text-xs text-muted-foreground">
              Aktiv: {formatDateTime(plan.activated_at)} — Archiviert:{" "}
              {formatDateTime(plan.archived_at)}
            </p>
          </div>
        </div>
        <Badge variant="secondary">{plan.day_count} Tage</Badge>
      </div>

      <Card>
        <CardContent className="flex flex-wrap items-center gap-x-6 gap-y-2 py-4">
          <div>
            <p className="text-sm text-muted-foreground">Tagesziel</p>
            <p className="text-lg font-semibold">
              {formatKcal(plan.target_kcal_per_day)}
            </p>
          </div>
          <Separator orientation="vertical" className="h-10" />
          <div className="text-sm text-muted-foreground">
            Makros: P {plan.protein_pct}% · KH {plan.carbs_pct}% · F{" "}
            {plan.fat_pct}%
          </div>
        </CardContent>
      </Card>

      <div className="space-y-4">
        {Array.from({ length: plan.day_count }, (_, di) => {
          const meals = plan.meals.filter((m) => m.day_index === di);
          let kcalSum = 0;
          for (const m of meals) {
            if (!m.recipe) continue;
            const mac = macrosForMeal(
              m.recipe.ingredients,
              m.recipe.base_servings,
              Number(m.serving_factor),
            );
            kcalSum += mac.kcal;
          }
          return (
            <Card key={di}>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-base">
                  {plan.day_labels[di] ?? `Tag ${di + 1}`}
                </CardTitle>
                <Badge variant="secondary">{formatKcal(kcalSum)}</Badge>
              </CardHeader>
              <CardContent className="space-y-2">
                {meals.length === 0 && (
                  <p className="text-sm text-muted-foreground">
                    Keine Mahlzeiten.
                  </p>
                )}
                {meals.map((m) => {
                  const recipeName = m.recipe?.name ?? "(Rezept gelöscht)";
                  const macros = m.recipe
                    ? macrosForMeal(
                        m.recipe.ingredients,
                        m.recipe.base_servings,
                        Number(m.serving_factor),
                      )
                    : null;
                  return (
                    <div
                      key={m.id}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-input p-2"
                    >
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">
                          {MEAL_SLOT_LABELS[m.meal_slot]}
                        </Badge>
                        <span className="text-sm">{recipeName}</span>
                        <span className="text-xs text-muted-foreground">
                          ×{Number(m.serving_factor).toFixed(2)}
                        </span>
                      </div>
                      {macros && (
                        <div className="text-xs text-muted-foreground">
                          {formatKcal(macros.kcal)} · P{" "}
                          {formatGrams(macros.protein)} · KH{" "}
                          {formatGrams(macros.carbs)} · F{" "}
                          {formatGrams(macros.fat)}
                        </div>
                      )}
                      {m.cooked && (
                        <Badge variant="secondary">gekocht</Badge>
                      )}
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
