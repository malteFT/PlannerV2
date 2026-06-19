"use client";

import * as React from "react";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogClose,
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
import {
  useInventory,
  useUpsertInventory,
  useDeleteInventoryItem,
} from "@/lib/queries/inventory";
import { useIngredients } from "@/lib/queries/ingredients";
import {
  INGREDIENT_CATEGORIES,
  UNIT_LABELS,
  type IngredientUnit,
  type InventoryItemWithIngredient,
} from "@/lib/db/types";

/**
 * Formatiert Vorratsmengen abhängig von der Einheit.
 * - piece: ganze Zahlen
 * - g/ml: 1 Nachkommastelle, wenn nicht ganzzahlig
 */
function formatAmount(amount: number, unit: IngredientUnit): string {
  if (!Number.isFinite(amount)) return "0";
  if (unit === "piece") return String(Math.round(amount));
  if (Number.isInteger(amount)) return String(amount);
  return amount.toFixed(1);
}

export default function InventoryPage() {
  const [search, setSearch] = React.useState("");
  const [debounced, setDebounced] = React.useState("");
  const [addOpen, setAddOpen] = React.useState(false);

  React.useEffect(() => {
    const t = setTimeout(() => setDebounced(search.trim().toLowerCase()), 200);
    return () => clearTimeout(t);
  }, [search]);

  const inventory = useInventory();

  const items = React.useMemo(() => {
    const all = inventory.data ?? [];
    if (!debounced) return all;
    return all.filter((it) =>
      it.ingredient.display_name.toLowerCase().includes(debounced),
    );
  }, [inventory.data, debounced]);

  const grouped = React.useMemo(() => {
    const map = new Map<string, InventoryItemWithIngredient[]>();
    for (const it of items) {
      const cat = it.ingredient.category || "Sonstiges";
      const arr = map.get(cat);
      if (arr) arr.push(it);
      else map.set(cat, [it]);
    }
    // Reihenfolge wie INGREDIENT_CATEGORIES, unbekannte Kategorien hinten.
    const ordered: Array<[string, InventoryItemWithIngredient[]]> = [];
    for (const cat of INGREDIENT_CATEGORIES) {
      const arr = map.get(cat);
      if (arr && arr.length > 0) {
        arr.sort((a, b) =>
          a.ingredient.display_name.localeCompare(b.ingredient.display_name, "de"),
        );
        ordered.push([cat, arr]);
        map.delete(cat);
      }
    }
    for (const [cat, arr] of map) {
      arr.sort((a, b) =>
        a.ingredient.display_name.localeCompare(b.ingredient.display_name, "de"),
      );
      ordered.push([cat, arr]);
    }
    return ordered;
  }, [items]);

  const isEmpty =
    !inventory.isLoading &&
    !inventory.isError &&
    (inventory.data ?? []).length === 0;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight">Vorrat</h1>
          <p className="text-muted-foreground">Was du zu Hause hast.</p>
        </div>
        <Button onClick={() => setAddOpen(true)}>
          <Plus />
          Hinzufügen
        </Button>
      </div>

      <Input
        type="search"
        placeholder="Suche nach Name…"
        aria-label="Vorrat suchen"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="sm:max-w-sm"
      />

      {inventory.isLoading && (
        <p className="text-sm text-muted-foreground">Lade…</p>
      )}

      {inventory.isError && (
        <p className="text-sm text-red-600">
          Fehler:{" "}
          {inventory.error instanceof Error
            ? inventory.error.message
            : "Unbekannt"}
        </p>
      )}

      {isEmpty && (
        <p className="text-sm text-muted-foreground">
          Noch nichts im Vorrat. Hake Einkaufslisten-Items ab oder füge manuell
          hinzu.
        </p>
      )}

      {!isEmpty && grouped.length === 0 && !inventory.isLoading && (
        <p className="text-sm text-muted-foreground">
          Keine Treffer für „{search}“.
        </p>
      )}

      {grouped.length > 0 && (
        <div className="space-y-6">
          {grouped.map(([cat, rows]) => (
            <section key={cat} className="space-y-2">
              <h2 className="text-sm font-medium text-muted-foreground">
                {cat}
              </h2>
              <ul className="divide-y rounded-xl ring-1 ring-foreground/10">
                {rows.map((it) => (
                  <InventoryRow key={it.ingredient_id} item={it} />
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}

      <AddInventoryDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        existingIds={
          new Set((inventory.data ?? []).map((it) => it.ingredient_id))
        }
      />
    </div>
  );
}

// =========================================================================
// Row
// =========================================================================

function InventoryRow({ item }: { item: InventoryItemWithIngredient }) {
  const upsert = useUpsertInventory();
  const del = useDeleteInventoryItem();
  const unit = item.ingredient.default_unit;

  const initial = React.useMemo(
    () => formatAmount(item.amount, unit),
    [item.amount, unit],
  );
  const [value, setValue] = React.useState(initial);
  const [confirmOpen, setConfirmOpen] = React.useState(false);

  // Externe Updates (z.B. nach Refetch) übernehmen, wenn keine lokale Bearbeitung.
  React.useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setValue(initial);
  }, [initial]);

  const handleBlur = () => {
    const trimmed = value.trim().replace(",", ".");
    if (trimmed === "") {
      setValue(initial);
      return;
    }
    const num = Number(trimmed);
    if (!Number.isFinite(num) || num < 0) {
      setValue(initial);
      return;
    }
    // Nur senden, wenn der Wert sich tatsächlich geändert hat.
    if (Math.abs(num - item.amount) < 1e-9) {
      setValue(initial);
      return;
    }
    upsert.mutate(
      { ingredientId: item.ingredient_id, amount: num },
      {
        onSuccess: () => toast.success("Gespeichert"),
        onError: (e) => {
          toast.error(e instanceof Error ? e.message : "Fehler beim Speichern");
          setValue(initial);
        },
      },
    );
  };

  const onDelete = () => {
    del.mutate(item.ingredient_id, {
      onSuccess: () => {
        toast.success("Gelöscht");
        setConfirmOpen(false);
      },
      onError: (e) =>
        toast.error(e instanceof Error ? e.message : "Fehler beim Löschen"),
    });
  };

  return (
    <li className="flex items-center gap-3 px-4 py-3">
      <div className="flex flex-col gap-0.5 min-w-0 flex-1">
        <span className="font-medium truncate">
          {item.ingredient.display_name}
        </span>
        <span className="text-xs text-muted-foreground truncate">
          {item.ingredient.bls?.name_de ?? "—"}
        </span>
      </div>
      <div className="flex items-center gap-1">
        <Input
          type="number"
          inputMode="decimal"
          min={0}
          step={unit === "piece" ? 1 : 0.1}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onBlur={handleBlur}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.currentTarget.blur();
            }
          }}
          aria-label={`Menge ${item.ingredient.display_name}`}
          className="w-24 text-right"
        />
        <span className="text-sm text-muted-foreground w-10">
          {UNIT_LABELS[unit]}
        </span>
      </div>
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label={`${item.ingredient.display_name} löschen`}
        onClick={() => setConfirmOpen(true)}
      >
        <Trash2 />
      </Button>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Aus Vorrat entfernen?</DialogTitle>
            <DialogDescription>
              „{item.ingredient.display_name}“ wird aus dem Vorrat gelöscht.
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
              onClick={onDelete}
              disabled={del.isPending}
            >
              Löschen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </li>
  );
}

// =========================================================================
// Add Dialog
// =========================================================================

function AddInventoryDialog({
  open,
  onOpenChange,
  existingIds,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  existingIds: Set<string>;
}) {
  const ingredientsQuery = useIngredients();
  const upsert = useUpsertInventory();

  const [ingredientId, setIngredientId] = React.useState<string>("");
  const [amount, setAmount] = React.useState<string>("");

  // Beim Öffnen zurücksetzen.
  React.useEffect(() => {
    if (open) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setIngredientId("");
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setAmount("");
    }
  }, [open]);

  const available = React.useMemo(() => {
    const all = ingredientsQuery.data ?? [];
    return all.filter((i) => !existingIds.has(i.id));
  }, [ingredientsQuery.data, existingIds]);

  const selected = React.useMemo(
    () => available.find((i) => i.id === ingredientId) ?? null,
    [available, ingredientId],
  );

  const canSave = (() => {
    if (!ingredientId) return false;
    const trimmed = amount.trim().replace(",", ".");
    if (trimmed === "") return false;
    const num = Number(trimmed);
    return Number.isFinite(num) && num >= 0;
  })();

  const handleSave = () => {
    const num = Number(amount.trim().replace(",", "."));
    if (!ingredientId || !Number.isFinite(num) || num < 0) return;
    upsert.mutate(
      { ingredientId, amount: num },
      {
        onSuccess: () => {
          toast.success("Hinzugefügt");
          onOpenChange(false);
        },
        onError: (e) =>
          toast.error(e instanceof Error ? e.message : "Fehler beim Speichern"),
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Zum Vorrat hinzufügen</DialogTitle>
          <DialogDescription>
            Wähle eine Zutat und gib die vorhandene Menge ein.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label>Zutat</Label>
            {ingredientsQuery.isLoading ? (
              <p className="text-sm text-muted-foreground">Lade Zutaten…</p>
            ) : available.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Alle Zutaten sind bereits im Vorrat.
              </p>
            ) : (
              <Select
                value={ingredientId}
                onValueChange={(v) => setIngredientId(v as string)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Zutat wählen…" />
                </SelectTrigger>
                <SelectContent>
                  {available.map((i) => (
                    <SelectItem key={i.id} value={i.id}>
                      {i.display_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="inventory-amount">Menge</Label>
            <div className="flex items-center gap-2">
              <Input
                id="inventory-amount"
                type="number"
                inputMode="decimal"
                min={0}
                step={selected?.default_unit === "piece" ? 1 : 0.1}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-40"
                placeholder="0"
              />
              <span className="text-sm text-muted-foreground">
                {selected ? UNIT_LABELS[selected.default_unit] : ""}
              </span>
            </div>
          </div>
        </div>

        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>
            Abbrechen
          </DialogClose>
          <Button onClick={handleSave} disabled={!canSave || upsert.isPending}>
            Speichern
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
