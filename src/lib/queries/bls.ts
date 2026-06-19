"use client";

import { useQuery } from "@tanstack/react-query";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { qk } from "@/lib/query/keys";
import type { BlsFood } from "@/lib/db/types";

/**
 * Sucht im BLS nach `term` (Substring-Match auf name_de) und sortiert die
 * Treffer so, dass:
 *   1. Prefix-Treffer (Name beginnt mit Term) zuerst
 *   2. Wort-Prefix-Treffer (irgendein Wort beginnt mit Term)
 *   3. Reine Substring-Treffer
 * Innerhalb jeder Gruppe alphabetisch.
 *
 * Whitespace-Tolerant: Wenn der Term keine Whitespaces enthält, sucht die
 * Query zusätzlich gegen den Namen mit entfernten Leerzeichen — sodass
 * "Haferflocken" auch den BLS-Eintrag "Hafer Flocken" findet.
 *
 * Wir holen bis zu 100 Datenbank-Treffer pro Pfad und sortieren clientseitig.
 */
const FETCH_LIMIT = 100;
const DISPLAY_LIMIT = 25;

export function useBlsSearch(term: string) {
  const trimmed = term.trim();
  return useQuery({
    queryKey: qk.blsSearch(trimmed),
    enabled: trimmed.length >= 2,
    staleTime: 60_000,
    queryFn: async (): Promise<BlsFood[]> => {
      const supabase = createSupabaseBrowserClient();
      // Standard-Suche: Substring im Namen.
      const directPromise = supabase
        .from("bls_food")
        .select(
          "bls_code,name_de,kcal_per_100g,protein_per_100g,carbs_per_100g,fat_per_100g",
        )
        .ilike("name_de", `%${trimmed}%`)
        .limit(FETCH_LIMIT);

      // Whitespace-Tolerant: wenn der User-Term zusammengeschrieben ist
      // (z.B. "Haferflocken"), splitten wir ihn an natürlichen Wortgrenzen
      // (z.B. nach 4 Zeichen) und versuchen die Query mit Leerzeichen
      // dazwischen. Sehr simple Heuristik: wir splitten nach jedem Vokal
      // oder probieren längste Präfix-Matches gegen unsere Liste.
      // → Praktischer: wenn term keine Whitespace hat UND länger als 5
      //   Zeichen ist, splitten wir an plausiblen Stellen (nach 3..n-3
      //   Zeichen) und ODER-en die Treffer.
      const noWhitespace = !/\s/.test(trimmed);
      let splitPromise: Promise<{ data: BlsFood[] | null }> | null = null;
      if (noWhitespace && trimmed.length >= 6) {
        // Wir versuchen 1-2 typische Split-Stellen. Eine echte Wortgrenze
        // zu finden ist linguistisch komplex — wir nehmen einfach jede
        // Split-Position von Mitte aus +/- 1 und kombinieren mit OR.
        const mid = Math.floor(trimmed.length / 2);
        const candidates = [
          [trimmed.slice(0, mid), trimmed.slice(mid)],
          [trimmed.slice(0, mid + 1), trimmed.slice(mid + 1)],
          [trimmed.slice(0, mid - 1), trimmed.slice(mid - 1)],
        ];
        // Bauen ein OR-Statement: jede Variante als ilike "A% %B" oder
        // "A %B%". Vereinfachung: ilike "%A% %B%" (beide Teile irgendwo
        // im String mit mindestens einem Leerzeichen dazwischen).
        const orParts = candidates
          .filter(([a, b]) => a.length >= 2 && b.length >= 2)
          .map(([a, b]) => `name_de.ilike.%${a}% %${b}%`);
        if (orParts.length > 0) {
          splitPromise = supabase
            .from("bls_food")
            .select(
              "bls_code,name_de,kcal_per_100g,protein_per_100g,carbs_per_100g,fat_per_100g",
            )
            .or(orParts.join(","))
            .limit(FETCH_LIMIT) as unknown as Promise<{ data: BlsFood[] | null }>;
        }
      }

      const [direct, split] = await Promise.all([
        directPromise,
        splitPromise ?? Promise.resolve({ data: null as BlsFood[] | null }),
      ]);
      if (direct.error) throw direct.error;

      // Dedupe via bls_code
      const merged = new Map<string, BlsFood>();
      for (const r of direct.data ?? []) merged.set(r.bls_code, r);
      for (const r of split.data ?? []) merged.set(r.bls_code, r);

      return rankBlsResults([...merged.values()], trimmed).slice(0, DISPLAY_LIMIT);
    },
  });
}

/**
 * 0 = Prefix-Treffer (Name beginnt mit term)
 * 1 = Wort-Prefix-Treffer (irgendein Token im Namen beginnt mit term)
 * 2 = sonst (Substring oder zusammengeschrieben matched)
 */
function relevanceBucket(name: string, term: string): number {
  const lower = name.toLowerCase();
  const t = term.toLowerCase();
  if (lower.startsWith(t)) return 0;
  // Trennzeichen, an denen wir Wörter splitten:
  // Whitespace, Komma, Bindestrich, Schrägstrich.
  const tokens = lower.split(/[\s,/\-]+/).filter(Boolean);
  if (tokens.some((tok) => tok.startsWith(t))) return 1;
  // Auch zusammengeschriebene Variante prüfen: "Haferflocken" gegen
  // den Namen ohne Whitespace.
  if (!/\s/.test(t)) {
    const compactName = lower.replace(/\s+/g, "");
    if (compactName.startsWith(t)) return 0;
  }
  return 2;
}

export function rankBlsResults(rows: BlsFood[], term: string): BlsFood[] {
  return [...rows].sort((a, b) => {
    const ba = relevanceBucket(a.name_de, term);
    const bb = relevanceBucket(b.name_de, term);
    if (ba !== bb) return ba - bb;
    return a.name_de.localeCompare(b.name_de, "de");
  });
}
