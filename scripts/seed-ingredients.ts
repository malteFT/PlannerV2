/**
 * Seed-Skript: liest seed-ingredients-proposal.md, parst die Tabelle und
 * legt die Zutaten unter der angegebenen User-ID in `ingredient` an.
 *
 * Idempotent: existierende Einträge mit gleichem (user_id, lower(display_name))
 * werden NICHT überschrieben (Unique-Index in 0002_stammdaten.sql).
 *
 * Aufruf:
 *   npm run seed:ingredients <USER_EMAIL>
 *
 * Voraussetzungen:
 *   - .env.local mit SUPABASE_SERVICE_ROLE_KEY
 *   - Migration 0006_ingredient_aliases ausgeführt
 *   - User mit der angegebenen E-Mail existiert in auth.users
 */
import path from "node:path";
import { fileURLToPath } from "node:url";
import { readFileSync } from "node:fs";
import { config as loadEnv } from "dotenv";
import { createClient } from "@supabase/supabase-js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
loadEnv({ path: path.resolve(__dirname, "..", ".env.local") });

const PROPOSAL_PATH = path.resolve(
  __dirname,
  "..",
  "seed-ingredients-proposal.md",
);

type SeedRow = {
  display_name: string;
  category: string;
  default_unit: "g" | "ml" | "piece";
  grams_per_piece: number | null;
  bls_code: string;
  bls_name: string;
  aliases: string[];
  kcal_per_100g: number;
  notiz: string;
  status: string;
};

function parseSeedFile(markdown: string): SeedRow[] {
  const lines = markdown.split("\n");
  const rows: SeedRow[] = [];
  let inTable = false;
  let headerSeen = false;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed.startsWith("|")) {
      // Leere Zeile zwischen Header und nächstem Abschnitt → Tabelle endet
      if (inTable) inTable = false;
      continue;
    }
    if (trimmed.startsWith("| Display-Name")) {
      inTable = true;
      headerSeen = true;
      continue;
    }
    if (!inTable || !headerSeen) continue;
    // Trennzeile (|---|---|...)
    if (trimmed.replace(/[\s|:-]/g, "") === "") continue;

    // Datenzeile parsen
    const cells = trimmed
      .split("|")
      .slice(1, -1)
      .map((c) => c.trim());
    if (cells.length < 9) continue;

    const [
      display_name,
      category,
      unit_raw,
      grams_per_piece_raw,
      bls_code,
      bls_name,
      aliases_raw,
      kcal_raw,
      notiz,
      status,
    ] = cells;

    if (!bls_code || bls_code === "—" || bls_code === "-") continue;

    const upStatus = (status ?? "").toUpperCase().trim();
    if (
      upStatus === "REDUNDANT" ||
      upStatus === "NEIN" ||
      upStatus.startsWith("NEIN")
    ) {
      continue;
    }
    if (upStatus.startsWith("KORREKTUR")) {
      // eslint-disable-next-line no-console
      console.warn(`  ⚠ ${display_name}: status "${status}" — bitte prüfen.`);
    }

    const unit = unit_raw as SeedRow["default_unit"];
    if (unit !== "g" && unit !== "ml" && unit !== "piece") {
      // eslint-disable-next-line no-console
      console.warn(
        `  ⚠ ${display_name}: unbekannte Einheit "${unit_raw}" — überspringe.`,
      );
      continue;
    }

    const grams_per_piece =
      unit === "piece" ? Number(grams_per_piece_raw.replace(",", ".")) : null;

    const kcal_per_100g = Number(kcal_raw.replace(",", "."));

    const aliases = aliases_raw
      ? aliases_raw
          .split(",")
          .map((a) => a.trim())
          .filter(Boolean)
      : [];

    rows.push({
      display_name,
      category,
      default_unit: unit,
      grams_per_piece:
        grams_per_piece !== null && Number.isFinite(grams_per_piece)
          ? grams_per_piece
          : null,
      bls_code,
      bls_name,
      aliases,
      kcal_per_100g: Number.isFinite(kcal_per_100g) ? kcal_per_100g : 0,
      notiz,
      status,
    });
  }

  return rows;
}

async function main() {
  const targetEmail = process.argv[2];
  if (!targetEmail) {
    console.error("Usage: npm run seed:ingredients <USER_EMAIL>");
    process.exit(1);
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    console.error(
      "Fehlt: NEXT_PUBLIC_SUPABASE_URL und/oder SUPABASE_SERVICE_ROLE_KEY",
    );
    process.exit(1);
  }

  const supabase = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // eslint-disable-next-line no-console
  console.log(`Suche User mit E-Mail "${targetEmail}"…`);
  const usersResp = await supabase.auth.admin.listUsers();
  if (usersResp.error) {
    console.error("Fehler beim Listen der User:", usersResp.error);
    process.exit(1);
  }
  const user = usersResp.data.users.find((u) => u.email === targetEmail);
  if (!user) {
    console.error(`User "${targetEmail}" nicht gefunden.`);
    process.exit(1);
  }
  // eslint-disable-next-line no-console
  console.log(`  → user_id ${user.id}`);

  const md = readFileSync(PROPOSAL_PATH, "utf8");
  const rows = parseSeedFile(md);
  // eslint-disable-next-line no-console
  console.log(`Geparst: ${rows.length} Zutaten aus ${PROPOSAL_PATH}`);

  const allCodes = [...new Set(rows.map((r) => r.bls_code))];
  const blsResp = await supabase
    .from("bls_food")
    .select("bls_code")
    .in("bls_code", allCodes);
  if (blsResp.error) {
    console.error("Fehler beim BLS-Lookup:", blsResp.error);
    process.exit(1);
  }
  const knownBls = new Set((blsResp.data ?? []).map((r) => r.bls_code));
  const missingBls = allCodes.filter((c) => !knownBls.has(c));
  if (missingBls.length > 0) {
    console.warn(
      `⚠ Folgende BLS-Codes existieren nicht in der DB: ${missingBls.join(", ")}`,
    );
  }

  const existingResp = await supabase
    .from("ingredient")
    .select("display_name")
    .eq("user_id", user.id);
  if (existingResp.error) {
    console.error("Fehler beim Lesen bestehender Zutaten:", existingResp.error);
    process.exit(1);
  }
  const existingNames = new Set(
    (existingResp.data ?? []).map((r) =>
      (r.display_name as string).toLowerCase(),
    ),
  );

  let inserted = 0;
  let skippedExisting = 0;
  let skippedNoBls = 0;

  for (const row of rows) {
    if (!knownBls.has(row.bls_code)) {
      skippedNoBls++;
      continue;
    }
    if (existingNames.has(row.display_name.toLowerCase())) {
      skippedExisting++;
      continue;
    }

    const insertResp = await supabase.from("ingredient").insert({
      user_id: user.id,
      display_name: row.display_name,
      bls_code: row.bls_code,
      default_unit: row.default_unit,
      grams_per_piece: row.grams_per_piece,
      category: row.category,
      excluded: false,
      aliases: row.aliases,
    });
    if (insertResp.error) {
      console.warn(
        `  ✗ ${row.display_name} (${row.bls_code}): ${insertResp.error.message}`,
      );
      continue;
    }
    inserted++;
    process.stdout.write(`\r  Eingefügt: ${inserted}/${rows.length}`);
  }
  process.stdout.write("\n");
  // eslint-disable-next-line no-console
  console.log(
    `Fertig.\n  Eingefügt: ${inserted}\n  Übersprungen (existiert): ${skippedExisting}\n  Übersprungen (kein BLS-Match): ${skippedNoBls}`,
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
