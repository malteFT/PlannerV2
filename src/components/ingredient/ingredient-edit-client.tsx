"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ChevronLeft, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { IngredientForm } from "@/components/ingredient/ingredient-form";
import { PageHeader } from "@/components/layout/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useDeleteIngredient,
  useIngredient,
  useIngredientUsage,
  useUpdateIngredient,
} from "@/lib/queries/ingredients";
import type { IngredientFormValues } from "@/lib/validators";
import type { IngredientCategory } from "@/lib/db/types";
import {
  formatGrams,
  formatKcal,
  macrosForIngredientAmount,
} from "@/lib/domain/nutrition";

export function IngredientEditClient({ id }: { id: string }) {
  const router = useRouter();
  const ingredient = useIngredient(id);
  const update = useUpdateIngredient(id);
  const del = useDeleteIngredient();
  const usage = useIngredientUsage(id);

  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const [blockedOpen, setBlockedOpen] = React.useState(false);

  if (ingredient.isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <Card>
          <CardContent className="space-y-3 py-6">
            <Skeleton className="h-9 w-full" />
            <Skeleton className="h-9 w-full" />
            <Skeleton className="h-9 w-1/2" />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="space-y-3 py-6">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-4 w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }
  if (ingredient.isError) {
    return (
      <p className="text-sm text-destructive">
        Fehler:{" "}
        {ingredient.error instanceof Error
          ? ingredient.error.message
          : "Unbekannt"}
      </p>
    );
  }
  if (!ingredient.data) {
    return <p className="text-sm text-muted-foreground">Nicht gefunden.</p>;
  }

  const data = ingredient.data;
  const defaults: IngredientFormValues = {
    display_name: data.display_name,
    bls_code: data.bls_code,
    default_unit: data.default_unit,
    grams_per_piece: data.grams_per_piece,
    category: data.category as IngredientCategory,
    excluded: data.excluded,
    aliases: data.aliases ?? [],
  };

  async function handleSubmit(values: IngredientFormValues) {
    await update.mutateAsync(values);
    toast.success("Gespeichert");
    router.push("/ingredients");
  }

  function onDeleteClick() {
    const usedIn = usage.data ?? [];
    if (usedIn.length > 0) {
      setBlockedOpen(true);
    } else {
      setConfirmOpen(true);
    }
  }

  async function confirmDelete() {
    try {
      await del.mutateAsync(id);
      toast.success("Zutat gelöscht");
      setConfirmOpen(false);
      router.push("/ingredients");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Löschen fehlgeschlagen";
      toast.error(msg);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={
          <span className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon-sm"
              render={<Link href="/ingredients" />}
            >
              <ChevronLeft />
            </Button>
            <span className="truncate">{data.display_name}</span>
          </span>
        }
        description="Zutat bearbeiten"
        actions={
          <Button
            variant="destructive"
            onClick={onDeleteClick}
            disabled={usage.isLoading || del.isPending}
          >
            <Trash2 />
            Löschen
          </Button>
        }
      />

      <IngredientForm
        defaultValues={defaults}
        onSubmit={handleSubmit}
        submitLabel="Speichern"
      />

      <Card>
        <CardHeader>
          <CardTitle>Nährwerte (BLS)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <p className="text-xs text-muted-foreground">
            BLS-Eintrag: {data.bls.name_de} ({data.bls.bls_code})
          </p>
          <div className="grid grid-cols-2 gap-y-1 sm:grid-cols-4">
            <div>
              <span className="text-muted-foreground">kcal: </span>
              <span className="font-medium">
                {formatKcal(data.bls.kcal_per_100g)}
              </span>
            </div>
            <div>
              <span className="text-muted-foreground">Protein: </span>
              <span className="font-medium">
                {formatGrams(data.bls.protein_per_100g)}
              </span>
            </div>
            <div>
              <span className="text-muted-foreground">KH: </span>
              <span className="font-medium">
                {formatGrams(data.bls.carbs_per_100g)}
              </span>
            </div>
            <div>
              <span className="text-muted-foreground">Fett: </span>
              <span className="font-medium">
                {formatGrams(data.bls.fat_per_100g)}
              </span>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">jeweils pro 100 g</p>
          {data.default_unit === "piece" && data.grams_per_piece ? (
            <div className="border-t pt-2">
              {(() => {
                const m = macrosForIngredientAmount(1, "piece", data);
                return (
                  <>
                    <p className="text-xs text-muted-foreground">
                      Pro Stück (≈ {data.grams_per_piece} g)
                    </p>
                    <div className="grid grid-cols-2 gap-y-1 sm:grid-cols-4">
                      <div>
                        <span className="text-muted-foreground">kcal: </span>
                        <span className="font-medium">{formatKcal(m.kcal)}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Protein: </span>
                        <span className="font-medium">
                          {formatGrams(m.protein)}
                        </span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">KH: </span>
                        <span className="font-medium">{formatGrams(m.carbs)}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Fett: </span>
                        <span className="font-medium">{formatGrams(m.fat)}</span>
                      </div>
                    </div>
                  </>
                );
              })()}
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Dialog open={blockedOpen} onOpenChange={setBlockedOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Zutat wird verwendet</DialogTitle>
            <DialogDescription>
              Diese Zutat ist in Rezepten enthalten und kann deshalb nicht
              gelöscht werden. Entferne sie zuerst aus diesen Rezepten:
            </DialogDescription>
          </DialogHeader>
          <ul className="max-h-48 list-disc overflow-y-auto pl-5 text-sm">
            {(usage.data ?? []).map((r) => (
              <li key={r.id}>
                <Link
                  href={`/recipes/${r.id}`}
                  className="underline underline-offset-2 hover:text-foreground"
                >
                  {r.name}
                </Link>
              </li>
            ))}
          </ul>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBlockedOpen(false)}>
              Schließen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Zutat löschen?</DialogTitle>
            <DialogDescription>
              Das kann nicht rückgängig gemacht werden.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setConfirmOpen(false)}
              disabled={del.isPending}
            >
              Abbrechen
            </Button>
            <Button
              variant="destructive"
              onClick={confirmDelete}
              disabled={del.isPending}
            >
              Löschen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
