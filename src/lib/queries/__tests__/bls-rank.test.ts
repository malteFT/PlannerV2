import { describe, expect, it } from "vitest";
import { rankBlsResults } from "@/lib/queries/bls";
import type { BlsFood } from "@/lib/db/types";

function bls(name: string, code: string = name): BlsFood {
  return {
    bls_code: code,
    name_de: name,
    kcal_per_100g: 0,
    protein_per_100g: 0,
    carbs_per_100g: 0,
    fat_per_100g: 0,
  };
}

describe("rankBlsResults", () => {
  it("sortiert Prefix-Treffer vor Substring-Treffer", () => {
    const rows = [
      bls("Dinkelbrot"),
      bls("Vollkorn-Dinkelmehl"), // Wort-Prefix in Token "Dinkelmehl"
      bls("Dinkelteigwaren eifrei, roh"),
      bls("Backmischung Dinkel-Gemisch"), // ebenfalls Wort-Prefix (nach Bindestrich)
    ];
    const ranked = rankBlsResults(rows, "Dinkel");
    // Bucket 0 (Name beginnt mit "Dinkel"):
    //   "Dinkelbrot", "Dinkelteigwaren eifrei, roh"
    // Bucket 1 (irgendein Token beginnt mit "Dinkel" — sowohl "Dinkelmehl"
    //   als auch "Dinkel-Gemisch"):
    //   "Backmischung Dinkel-Gemisch", "Vollkorn-Dinkelmehl"
    expect(ranked.map((r) => r.name_de)).toEqual([
      "Dinkelbrot",
      "Dinkelteigwaren eifrei, roh",
      "Backmischung Dinkel-Gemisch",
      "Vollkorn-Dinkelmehl",
    ]);
  });

  it("Substring ohne Wort-Prefix landet im letzten Bucket", () => {
    // 'Spinatomelett' hat 'omelett' als Substring (kein Token-Prefix für 'lett'),
    // 'Pfannkuchen' beginnt mit 'P', kein Match. Wir konstruieren einen
    // expliziten Substring-only-Treffer:
    const rows = [
      bls("Tomatenketchup"), // Wort-Prefix "Tomatenketchup" beginnt mit "tom"
      bls("Spitzentomate"), // reiner Substring (kein Token beginnt mit "tom")
    ];
    const ranked = rankBlsResults(rows, "tom");
    expect(ranked[0].name_de).toBe("Tomatenketchup");
    expect(ranked[1].name_de).toBe("Spitzentomate");
  });

  it("ist case-insensitive für den Search-Term", () => {
    const rows = [bls("Dinkel"), bls("dinkel"), bls("DINKEL")];
    const ranked = rankBlsResults(rows, "DINKEL");
    expect(ranked).toHaveLength(3);
    // Alle drei matchen Prefix-Bucket. Innerhalb davon nutzt localeCompare("de")
    // — Reihenfolge ist hier nicht kritisch, wichtig ist nur, dass alle drei
    // im selben Bucket landen und die Suche überhaupt findet.
    expect(ranked.map((r) => r.name_de.toLowerCase())).toEqual([
      "dinkel",
      "dinkel",
      "dinkel",
    ]);
  });

  it("alphabetische Sortierung innerhalb eines Buckets", () => {
    const rows = [
      bls("Apfelmus"),
      bls("Apfelsaft"),
      bls("Apfel"),
    ];
    const ranked = rankBlsResults(rows, "apfel");
    expect(ranked.map((r) => r.name_de)).toEqual([
      "Apfel",
      "Apfelmus",
      "Apfelsaft",
    ]);
  });

  it("Suche mit Bindestrich-Wort: 'teig' findet Wort-Prefix", () => {
    const rows = [
      bls("Dinkel-Teigwaren"),
      bls("Hefeteig"), // Substring, nicht Token-Prefix
    ];
    const ranked = rankBlsResults(rows, "teig");
    // Erstes Element sollte Wort-Prefix sein
    expect(ranked[0].name_de).toBe("Dinkel-Teigwaren");
  });

  it("liefert leeres Array bei leeren Eingaben", () => {
    expect(rankBlsResults([], "abc")).toEqual([]);
  });
});
