import { describe, expect, it } from "vitest";
import {
  ingredientMatchesQuery,
  ingredientRelevanceBucket,
} from "@/lib/domain/ingredient-search";
import { normalizeAliases } from "@/lib/queries/ingredients";

const makeIng = (display_name: string, aliases: string[] = []) => ({
  display_name,
  aliases,
});

describe("ingredientMatchesQuery", () => {
  it("findet display_name (case-insensitive)", () => {
    expect(ingredientMatchesQuery(makeIng("Nudeln"), "nud")).toBe(true);
    expect(ingredientMatchesQuery(makeIng("Nudeln"), "NUD")).toBe(true);
  });

  it("findet alias (case-insensitive)", () => {
    expect(
      ingredientMatchesQuery(
        makeIng("Nudeln", ["Spaghetti", "Penne"]),
        "spag",
      ),
    ).toBe(true);
    expect(
      ingredientMatchesQuery(makeIng("Nudeln", ["Penne"]), "PEN"),
    ).toBe(true);
  });

  it("kein Match wenn weder name noch alias passt", () => {
    expect(
      ingredientMatchesQuery(makeIng("Nudeln", ["Pasta"]), "reis"),
    ).toBe(false);
  });

  it("leerer Query matcht immer", () => {
    expect(ingredientMatchesQuery(makeIng("Nudeln"), "")).toBe(true);
    expect(ingredientMatchesQuery(makeIng("Nudeln"), "   ")).toBe(true);
  });

  it("aliases undefined — toleriert", () => {
    // @ts-expect-error — bewusst undefined, defensive Branch testen
    expect(ingredientMatchesQuery({ display_name: "Apfel" }, "apf")).toBe(true);
  });
});

describe("ingredientRelevanceBucket", () => {
  it("Bucket 0: name beginnt mit query", () => {
    expect(
      ingredientRelevanceBucket(makeIng("Nudeln"), "nud"),
    ).toBe(0);
  });

  it("Bucket 0: alias beginnt mit query (besser als name-Substring)", () => {
    // name "Nudeln" enthält "udel" (Substring=2), alias "Spaghetti" beginnt
    // mit "spag" (Prefix=0). Best wins → 0.
    expect(
      ingredientRelevanceBucket(
        makeIng("Nudeln", ["Spaghetti"]),
        "spag",
      ),
    ).toBe(0);
  });

  it("Bucket 1: Wort-Prefix in name (nach Bindestrich)", () => {
    expect(
      ingredientRelevanceBucket(makeIng("Vollkorn-Dinkelmehl"), "dinkel"),
    ).toBe(1);
  });

  it("Bucket 2: reiner Substring", () => {
    // 'lkormehl' ist Substring im name, kein Token-Prefix
    expect(
      ingredientRelevanceBucket(makeIng("Vollkornmehl"), "lkorn"),
    ).toBe(2);
  });

  it("Bucket 3: kein Match (sollte vorher gefiltert sein)", () => {
    expect(ingredientRelevanceBucket(makeIng("Apfel"), "reis")).toBe(3);
  });

  it("nimmt den BESTEN Bucket aus name + alle aliases", () => {
    // name "Tomatensuppe" → Bucket 0 für 'tom'
    // alias "Suppentomate" → Bucket 1 (token-prefix von 'tom' nach 'Suppen')
    // Ergebnis: 0 (best wins)
    expect(
      ingredientRelevanceBucket(
        makeIng("Tomatensuppe", ["Suppentomate"]),
        "tom",
      ),
    ).toBe(0);
  });
});

describe("normalizeAliases", () => {
  it("trimmt und entfernt leere", () => {
    expect(normalizeAliases([" Spaghetti ", "", "  ", "Penne"])).toEqual([
      "Spaghetti",
      "Penne",
    ]);
  });

  it("entfernt case-insensitive Duplikate, behält erste Schreibweise", () => {
    expect(normalizeAliases(["Spaghetti", "spaghetti", "SPAGHETTI"])).toEqual([
      "Spaghetti",
    ]);
  });

  it("erhält Reihenfolge", () => {
    expect(normalizeAliases(["b", "a", "c"])).toEqual(["b", "a", "c"]);
  });
});
