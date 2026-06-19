/**
 * BLS-Import-Skript.
 *
 * Liest BLS_4_0_2025_DE/BLS_4_0_Daten_2025_DE.xlsx, mappt die relevanten
 * Spalten und schreibt sie idempotent in `public.bls_food`.
 *
 * Voraussetzungen:
 *   - Supabase-Projekt existiert
 *   - Migration 0001_init.sql ist im Supabase SQL-Editor ausgeführt
 *   - .env.local enthält NEXT_PUBLIC_SUPABASE_URL und SUPABASE_SERVICE_ROLE_KEY
 *
 * Aufruf:  npm run bls:import
 */
import "dotenv/config";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import * as XLSX from "xlsx";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const XLSX_PATH = path.resolve(
  __dirname,
  "..",
  "BLS_4_0_2025_DE",
  "BLS_4_0_Daten_2025_DE.xlsx",
);

// Mapping: Spaltenname in der Excel → DB-Feld
const COLUMNS = {
  bls_code: "BLS Code",
  name_de: "Lebensmittelbezeichnung",
  kcal_per_100g: "ENERCC Energie (Kilokalorien) [kcal/100g]",
  protein_per_100g: "PROT625 Protein (Nx6,25) [g/100g]",
  carbs_per_100g: "CHO Kohlenhydrate, verfügbar [g/100g]",
  fat_per_100g: "FAT Fett [g/100g]",
} as const;

type BlsRow = {
  bls_code: string;
  name_de: string;
  kcal_per_100g: number;
  protein_per_100g: number;
  carbs_per_100g: number;
  fat_per_100g: number;
};

function asNumber(v: unknown): number {
  if (typeof v === "number") return v;
  if (typeof v === "string") {
    const trimmed = v.trim().replace(",", ".");
    if (trimmed === "" || trimmed === "-") return 0;
    const n = Number(trimmed);
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    console.error(
      "Fehlt: NEXT_PUBLIC_SUPABASE_URL und/oder SUPABASE_SERVICE_ROLE_KEY in .env.local",
    );
    process.exit(1);
  }

  console.log("Lese Excel:", XLSX_PATH);
  const wb = XLSX.readFile(XLSX_PATH);
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const records = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    defval: null,
    raw: true,
  });

  // Header-Verifikation
  const headers = Object.keys(records[0] ?? {});
  const missing = Object.values(COLUMNS).filter((c) => !headers.includes(c));
  if (missing.length > 0) {
    console.error("Fehlende erwartete Spalten in der Excel:", missing);
    console.error("Vorhandene Spalten:", headers);
    process.exit(1);
  }

  const rows: BlsRow[] = [];
  for (const r of records) {
    const code = String(r[COLUMNS.bls_code] ?? "").trim();
    const name = String(r[COLUMNS.name_de] ?? "").trim();
    if (!code || !name) continue;
    rows.push({
      bls_code: code,
      name_de: name,
      kcal_per_100g: asNumber(r[COLUMNS.kcal_per_100g]),
      protein_per_100g: asNumber(r[COLUMNS.protein_per_100g]),
      carbs_per_100g: asNumber(r[COLUMNS.carbs_per_100g]),
      fat_per_100g: asNumber(r[COLUMNS.fat_per_100g]),
    });
  }
  console.log(`Mapped rows: ${rows.length}`);

  const supabase = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // Batched upsert (Postgres mag keine 14k-Zeilen-Inserts in einem Request)
  const BATCH = 500;
  let inserted = 0;
  for (let i = 0; i < rows.length; i += BATCH) {
    const slice = rows.slice(i, i + BATCH);
    const { error } = await supabase
      .from("bls_food")
      .upsert(slice, { onConflict: "bls_code" });
    if (error) {
      console.error("Upsert-Fehler bei Batch", i, error);
      process.exit(1);
    }
    inserted += slice.length;
    process.stdout.write(`\rImported: ${inserted}/${rows.length}`);
  }
  process.stdout.write("\n");
  console.log("Fertig.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
