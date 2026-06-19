"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { X as XIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useBlsSearch } from "@/lib/queries/bls";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import type { BlsFood } from "@/lib/db/types";

type Props = {
  value: string;
  onChange: (bls_code: string, name?: string) => void;
  invalid?: boolean;
};

/**
 * Holt einen einzelnen BLS-Eintrag per bls_code, damit das aktuelle
 * Badge auch bei Edit-Forms angezeigt werden kann (ohne dass der User
 * vorher tippen muss).
 */
function useBlsByCode(code: string | undefined) {
  return useQuery({
    queryKey: ["bls", "by-code", code ?? ""],
    enabled: !!code,
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<BlsFood | null> => {
      const supabase = createSupabaseBrowserClient();
      const { data, error } = await supabase
        .from("bls_food")
        .select(
          "bls_code,name_de,kcal_per_100g,protein_per_100g,carbs_per_100g,fat_per_100g",
        )
        .eq("bls_code", code!)
        .maybeSingle();
      if (error) throw error;
      return (data as BlsFood) ?? null;
    },
  });
}

export function BlsSearchPicker({ value, onChange, invalid }: Props) {
  const [term, setTerm] = React.useState("");
  const [debounced, setDebounced] = React.useState("");

  // Debounce term -> debounced (200ms)
  React.useEffect(() => {
    const t = setTimeout(() => setDebounced(term), 200);
    return () => clearTimeout(t);
  }, [term]);

  const search = useBlsSearch(debounced);
  const current = useBlsByCode(value);

  // Side-Effekt: Wenn der User tippt, blenden wir das Badge aus.
  const showBadge = !!value && term.trim().length === 0;
  const showResults = debounced.trim().length >= 2;

  const items = (search.data ?? []).slice(0, 8);

  return (
    <div className="flex flex-col gap-2">
      {showBadge && current.data && (
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="max-w-full truncate">
            Aktuell: {current.data.name_de} ({current.data.bls_code})
          </Badge>
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            onClick={() => {
              onChange("", "");
              setTerm("");
            }}
            aria-label="BLS-Auswahl entfernen"
          >
            <XIcon />
          </Button>
        </div>
      )}

      <Input
        type="text"
        placeholder="BLS-Eintrag suchen (mind. 2 Zeichen)…"
        value={term}
        onChange={(e) => setTerm(e.target.value)}
        aria-invalid={invalid || undefined}
      />

      {showResults && (
        <div
          className={cn(
            "rounded-lg border border-input bg-popover text-popover-foreground",
            "max-h-64 overflow-y-auto",
          )}
        >
          {search.isLoading && (
            <div className="px-2.5 py-2 text-sm text-muted-foreground">
              Suche…
            </div>
          )}
          {!search.isLoading && items.length === 0 && (
            <div className="px-2.5 py-2 text-sm text-muted-foreground">
              Keine Treffer
            </div>
          )}
          {!search.isLoading &&
            items.map((it) => (
              <button
                key={it.bls_code}
                type="button"
                onClick={() => {
                  onChange(it.bls_code, it.name_de);
                  setTerm("");
                  setDebounced("");
                }}
                className="flex w-full flex-col items-start gap-0.5 px-2.5 py-1.5 text-left text-sm hover:bg-accent hover:text-accent-foreground"
              >
                <span className="font-medium">{it.name_de}</span>
                <span className="text-xs text-muted-foreground">
                  {it.bls_code} · {Math.round(it.kcal_per_100g)} kcal/100g
                </span>
              </button>
            ))}
        </div>
      )}
    </div>
  );
}
