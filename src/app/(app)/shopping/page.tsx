"use client";

import * as React from "react";
import { toast } from "sonner";
import { ChevronDown, ChevronRight, Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { useActivePlan } from "@/lib/queries/plans";
import {
  useShoppingList,
  useCheckShoppingItem,
  useUncheckShoppingItem,
  useAddManualShoppingItem,
  useDeleteShoppingItem,
} from "@/lib/queries/shopping";
import { useIngredients } from "@/lib/queries/ingredients";
import {
  ALL_UNITS,
  UNIT_LABELS,
  type IngredientUnit,
  type ShoppingListItemWithIngredient,
} from "@/lib/db/types";

// =========================================================================
// Helpers
// =========================================================================

function formatAmount(value: number, unit: IngredientUnit): string {
  if (unit === "piece") {
    return `${Math.round(value)} ${UNIT_LABELS[unit]}`;
  }
  const isWhole = Math.abs(value - Math.round(value)) < 1e-9;
  const num = isWhole ? value.toFixed(0) : value.toFixed(1);
  return `${num} ${UNIT_LABELS[unit]}`;
}

function groupByCategory(
  items: ShoppingListItemWithIngredient[],
): Map<string, ShoppingListItemWithIngredient[]> {
  const map = new Map<string, ShoppingListItemWithIngredient[]>();
  for (const it of items) {
    const cat = it.ingredient.category ?? "Sonstiges";
    const arr = map.get(cat) ?? [];
    arr.push(it);
    map.set(cat, arr);
  }
  for (const [, arr] of map) {
    arr.sort((a, b) =>
      a.ingredient.display_name.localeCompare(b.ingredient.display_name, "de"),
    );
  }
  return map;
}

// =========================================================================
// Page
// =========================================================================

export default function ShoppingPage() {
  const { data: plan, isLoading: planLoading } = useActivePlan();
  const { data: items, isLoading: itemsLoading } = useShoppingList(plan?.id);

  const [doneOpen, setDoneOpen] = React.useState(false);
  const [addOpen, setAddOpen] = React.useState(false);

  const toBuy = React.useMemo(
    () => (items ?? []).filter((i) => !i.checked),
    [items],
  );
  const done = React.useMemo(
    () => (items ?? []).filter((i) => i.checked),
    [items],
  );

  const grouped = React.useMemo(() => groupByCategory(toBuy), [toBuy]);
  const sortedCategories = React.useMemo(
    () => Array.from(grouped.keys()).sort((a, b) => a.localeCompare(b, "de")),
    [grouped],
  );

  if (planLoading) {
    return (
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Einkauf</h1>
        <p className="text-sm text-muted-foreground">Lädt…</p>
      </div>
    );
  }

  if (!plan) {
    return (
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Einkauf</h1>
        <p className="text-sm text-muted-foreground">
          Kein aktiver Plan — generiere zuerst einen unter /plan.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Einkauf</h1>
        <Button onClick={() => setAddOpen(true)}>
          <Plus className="mr-1 size-4" />
          Manuell hinzufügen
        </Button>
      </div>

      {itemsLoading ? (
        <p className="text-sm text-muted-foreground">Lädt…</p>
      ) : (items ?? []).length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Nichts auf der Einkaufsliste — du hast alles im Vorrat.
        </p>
      ) : (
        <>
          {/* Zu kaufen */}
          <section className="space-y-4">
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-semibold">Zu kaufen</h2>
              <Badge variant="secondary">{toBuy.length}</Badge>
            </div>

            {toBuy.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Alles erledigt.
              </p>
            ) : (
              <div className="space-y-5">
                {sortedCategories.map((cat) => {
                  const rows = grouped.get(cat) ?? [];
                  return (
                    <div key={cat} className="space-y-2">
                      <h3 className="text-sm font-medium text-muted-foreground">
                        {cat}
                      </h3>
                      <ul className="space-y-1 rounded-md border">
                        {rows.map((item) => (
                          <ToBuyRow key={item.id} item={item} />
                        ))}
                      </ul>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          <Separator />

          {/* Erledigt */}
          <section className="space-y-2">
            <button
              type="button"
              onClick={() => setDoneOpen((s) => !s)}
              className="flex items-center gap-2 text-lg font-semibold"
            >
              {doneOpen ? (
                <ChevronDown className="size-4" />
              ) : (
                <ChevronRight className="size-4" />
              )}
              <span>Erledigt</span>
              <Badge variant="secondary">{done.length}</Badge>
            </button>

            {doneOpen && (
              <ul className="space-y-1 rounded-md border">
                {done.length === 0 ? (
                  <li className="p-3 text-sm text-muted-foreground">
                    Noch nichts erledigt.
                  </li>
                ) : (
                  done.map((item) => <DoneRow key={item.id} item={item} />)
                )}
              </ul>
            )}
          </section>
        </>
      )}

      <AddManualDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        planId={plan.id}
      />
    </div>
  );
}

// =========================================================================
// Rows
// =========================================================================

function ToBuyRow({ item }: { item: ShoppingListItemWithIngredient }) {
  const check = useCheckShoppingItem();
  const del = useDeleteShoppingItem();

  const handleCheck = () => {
    check.mutate(item.id, {
      onError: (e) => {
        const msg = e instanceof Error ? e.message : "Unbekannter Fehler";
        toast.error(msg);
      },
    });
  };

  const handleDelete = () => {
    if (!window.confirm(`„${item.ingredient.display_name}“ wirklich löschen?`)) {
      return;
    }
    del.mutate(item.id, {
      onSuccess: () => toast.success("Eintrag gelöscht."),
      onError: (e) => {
        const msg = e instanceof Error ? e.message : "Unbekannter Fehler";
        toast.error(msg);
      },
    });
  };

  return (
    <li className="flex items-center gap-3 px-3 py-2">
      <Checkbox
        checked={false}
        onCheckedChange={(v) => {
          if (v === true) handleCheck();
        }}
        disabled={check.isPending}
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-3">
          <span className="truncate text-sm font-medium">
            {item.ingredient.display_name}
          </span>
          <span className="text-sm tabular-nums">
            {formatAmount(item.to_buy_amount, item.unit)}
          </span>
        </div>
        <p className="text-xs text-muted-foreground">
          Bedarf {formatAmount(item.required_amount, item.unit)} • zu kaufen{" "}
          {formatAmount(item.to_buy_amount, item.unit)}
        </p>
      </div>
      {item.manual && (
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={handleDelete}
          disabled={del.isPending}
          aria-label="Löschen"
        >
          <Trash2 className="size-4" />
        </Button>
      )}
    </li>
  );
}

function DoneRow({ item }: { item: ShoppingListItemWithIngredient }) {
  const uncheck = useUncheckShoppingItem();

  const handleUncheck = () => {
    uncheck.mutate(item.id, {
      onError: (e) => {
        const msg = e instanceof Error ? e.message : "Unbekannter Fehler";
        toast.error(msg);
      },
    });
  };

  return (
    <li className="flex items-center gap-3 px-3 py-2">
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-3">
          <span className="truncate text-sm font-medium text-muted-foreground line-through">
            {item.ingredient.display_name}
          </span>
          <span className="text-sm tabular-nums text-muted-foreground line-through">
            {formatAmount(item.to_buy_amount, item.unit)}
          </span>
        </div>
      </div>
      <Button
        variant="outline"
        size="sm"
        onClick={handleUncheck}
        disabled={uncheck.isPending}
      >
        Rückgängig
      </Button>
    </li>
  );
}

// =========================================================================
// Add Manual Dialog
// =========================================================================

type AddManualDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  planId: string;
};

function AddManualDialog({ open, onOpenChange, planId }: AddManualDialogProps) {
  const { data: ingredients, isLoading } = useIngredients();
  const add = useAddManualShoppingItem();

  const [ingredientId, setIngredientId] = React.useState<string>("");
  const [amount, setAmount] = React.useState<string>("");

  // Reset on open
  React.useEffect(() => {
    if (open) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setIngredientId("");
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setAmount("");
    }
  }, [open]);

  const handleIngredientChange = (id: string | null) => {
    if (!id) return;
    setIngredientId(id);
  };

  const sortedIngredients = React.useMemo(
    () =>
      (ingredients ?? [])
        .slice()
        .sort((a, b) => a.display_name.localeCompare(b.display_name, "de")),
    [ingredients],
  );

  const selectedIngredient = ingredients?.find((i) => i.id === ingredientId);

  const canSubmit =
    ingredientId !== "" &&
    amount !== "" &&
    !Number.isNaN(Number(amount)) &&
    Number(amount) > 0;

  const handleSave = () => {
    if (!canSubmit) return;
    add.mutate(
      {
        planId,
        ingredientId,
        amount: Number(amount),
      },
      {
        onSuccess: () => {
          toast.success("Eintrag hinzugefügt.");
          onOpenChange(false);
        },
        onError: (e) => {
          const msg = e instanceof Error ? e.message : "Unbekannter Fehler";
          toast.error(msg);
        },
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Manuell hinzufügen</DialogTitle>
          <DialogDescription>
            Eintrag zur Einkaufsliste hinzufügen.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex flex-col gap-2">
            <Label>Zutat</Label>
            <Select
              value={ingredientId}
              onValueChange={handleIngredientChange}
              disabled={isLoading}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Zutat wählen…" />
              </SelectTrigger>
              <SelectContent>
                {sortedIngredients.map((ing) => (
                  <SelectItem key={ing.id} value={ing.id}>
                    {ing.display_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="manual-amount">Menge</Label>
            <Input
              id="manual-amount"
              type="number"
              inputMode="decimal"
              min={0}
              step="any"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="z.B. 250"
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label>Einheit</Label>
            <p className="text-sm text-muted-foreground">
              {selectedIngredient
                ? UNIT_LABELS[selectedIngredient.default_unit]
                : "—"}
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Abbrechen
          </Button>
          <Button onClick={handleSave} disabled={!canSubmit || add.isPending}>
            Speichern
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
