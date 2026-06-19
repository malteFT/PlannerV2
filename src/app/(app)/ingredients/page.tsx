"use client";

import * as React from "react";
import Link from "next/link";
import { Plus } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { useIngredients } from "@/lib/queries/ingredients";
import { UNIT_LABELS } from "@/lib/db/types";

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
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight">Zutaten</h1>
          <p className="text-muted-foreground">Zutatenkatalog mit BLS-Bezug.</p>
        </div>
        <Button render={<Link href="/ingredients/new" />}>
          <Plus />
          Neu
        </Button>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <Input
          type="search"
          placeholder="Suche nach Name…"
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

      {query.isLoading && (
        <p className="text-sm text-muted-foreground">Lade…</p>
      )}

      {query.isError && (
        <p className="text-sm text-red-600">
          Fehler:{" "}
          {query.error instanceof Error ? query.error.message : "Unbekannt"}
        </p>
      )}

      {!query.isLoading && !query.isError && items.length === 0 && (
        <p className="text-sm text-muted-foreground">
          Noch keine Zutaten — lege deine erste an.
        </p>
      )}

      {items.length > 0 && (
        <ul className="divide-y rounded-xl ring-1 ring-foreground/10">
          {items.map((i) => (
            <li key={i.id}>
              <Link
                href={`/ingredients/${i.id}`}
                className="flex flex-col gap-1 px-4 py-3 hover:bg-muted/50 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex flex-col gap-0.5">
                  <span className="font-medium">{i.display_name}</span>
                  <span className="text-xs text-muted-foreground">
                    {i.bls?.name_de ?? "—"}
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline">{i.category}</Badge>
                  <Badge variant="secondary">{UNIT_LABELS[i.default_unit]}</Badge>
                  {i.excluded && (
                    <Badge variant="destructive">ausgeschlossen</Badge>
                  )}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
