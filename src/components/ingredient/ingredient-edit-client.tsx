"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ChevronLeft, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { IngredientForm } from "@/components/ingredient/ingredient-form";
import {
  useDeleteIngredient,
  useIngredient,
  useIngredientUsage,
  useUpdateIngredient,
} from "@/lib/queries/ingredients";
import type { IngredientFormValues } from "@/lib/validators";
import type { IngredientCategory } from "@/lib/db/types";

export function IngredientEditClient({ id }: { id: string }) {
  const router = useRouter();
  const ingredient = useIngredient(id);
  const update = useUpdateIngredient(id);
  const del = useDeleteIngredient();
  const usage = useIngredientUsage(id);

  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const [blockedOpen, setBlockedOpen] = React.useState(false);

  if (ingredient.isLoading) {
    return <p className="text-sm text-muted-foreground">Lade…</p>;
  }
  if (ingredient.isError) {
    return (
      <p className="text-sm text-red-600">
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
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon-sm"
            render={<Link href="/ingredients" />}
          >
            <ChevronLeft />
          </Button>
          <h1 className="text-2xl font-semibold tracking-tight">
            Zutat bearbeiten
          </h1>
        </div>
        <Button
          variant="destructive"
          onClick={onDeleteClick}
          disabled={usage.isLoading || del.isPending}
        >
          <Trash2 />
          Löschen
        </Button>
      </div>

      <IngredientForm
        defaultValues={defaults}
        onSubmit={handleSubmit}
        submitLabel="Speichern"
      />

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
