/**
 * Seed-Skript für Rezepte: parst seed-recipes-proposal.md und legt freigegebene
 * Rezepte unter der angegebenen User-ID an.
 *
 * Idempotent: Rezepte mit gleichem (user_id, name) werden ÜBERSPRUNGEN
 * (über Existenz-Check, da kein Unique-Index auf recipe.name).
 *
 * Aufruf:
 *   npm run seed:recipes <USER_EMAIL>
 *
 * Voraussetzungen:
 *   - .env.local mit SUPABASE_SERVICE_ROLE_KEY
 *   - Migrationen 0001-0006 ausgeführt
 *   - Seed-Zutaten bereits vorhanden (npm run seed:ingredients)
 *   - User existiert in auth.users
 *
 * Format der Rezepte im Markdown — siehe seed-recipes-proposal.md.
 * Status-Marker:
 *   - OK         → wird angelegt
 *   - NEIN       → übersprungen
 *   - BAUSTELLE  → übersprungen, mit Warnung
 *   - leer/_     → übersprungen (User hat noch nicht entschieden)
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
  "seed-recipes-proposal.md",
);

type MealSlot = "breakfast" | "lunch" | "dinner" | "snack";

const SLOT_MAP: Record<string, MealSlot> = {
  Frühstück: "breakfast",
  Fruehstueck: "breakfast",
  Mittag: "lunch",
  Abend: "dinner",
  Snack: "snack",
};

type RecipeIngredientRaw = {
  display_name: string;
  amount: number;
  unit: "g" | "ml" | "piece";
};

type ParsedRecipe = {
  num: string;
  name: string;
  meal_types: MealSlot[];
  base_servings: number;
  ingredients: RecipeIngredientRaw[];
  instructions: string;
  notes: string;
  status: string;
};

function parseProposal(md: string): ParsedRecipe[] {
  // Wir splitten an "### R" — jeder Block ist ein Rezept.
  const blocks = md.split(/^### /m).slice(1);
  const recipes: ParsedRecipe[] = [];

  for (const block of blocks) {
    const recipe = parseBlock(block.trim());
    if (recipe) recipes.push(recipe);
  }

  return recipes;
}

function parseBlock(block: string): ParsedRecipe | null {
  // Erste Zeile: "R01 · Rezeptname"
  const lines = block.split("\n");
  const heading = lines[0]?.trim() ?? "";
  const match = heading.match(/^(R\d+)\s*[·\-:]\s*(.+)$/);
  if (!match) return null;
  const num = match[1];
  const name = match[2].trim();

  // Felder per "**Field:** value" Pattern extrahieren
  const fields: Record<string, string> = {};
  for (const line of lines) {
    const m = line.match(/^\*\*([^:*]+?):\*\*\s*(.*)$/);
    if (m) fields[m[1].trim()] = m[2].trim();
  }

  // Mahlzeiten-Slots
  const mealRaw = fields["Mahlzeit"] ?? fields["Mahlzeiten"] ?? "";
  const meal_types: MealSlot[] = mealRaw
    .split(",")
    .map((s) => s.trim())
    .map((s) => SLOT_MAP[s])
    .filter((s): s is MealSlot => !!s);

  // Basisportionen
  const base_servings = Number(fields["Basisportionen"] ?? "1") || 1;

  // Status
  const status = fields["Status"]?.trim() ?? "_";

  // Zutaten-Tabelle parsen
  const ingredients: RecipeIngredientRaw[] = [];
  let inIngredientTable = false;
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith("| Zutat")) {
      inIngredientTable = true;
      continue;
    }
    if (inIngredientTable) {
      if (!trimmed.startsWith("|")) {
        inIngredientTable = false;
        continue;
      }
      // Trennzeile?
      if (trimmed.replace(/[\s|:-]/g, "") === "") continue;
      const cells = trimmed
        .split("|")
        .slice(1, -1)
        .map((c) => c.trim());
      if (cells.length < 3) continue;
      const [zutat, mengeRaw, einheitRaw] = cells;
      const menge = Number(mengeRaw.replace(",", "."));
      const unit = einheitRaw as "g" | "ml" | "piece";
      if (!Number.isFinite(menge) || menge <= 0) continue;
      if (unit !== "g" && unit !== "ml" && unit !== "piece") continue;
      ingredients.push({ display_name: zutat, amount: menge, unit });
    }
  }

  // Zubereitung: alles zwischen "**Zubereitung:**" und "**Notizen:**" / "**Status:**"
  const zubStart = block.indexOf("**Zubereitung:**");
  let instructions = "";
  if (zubStart !== -1) {
    const after = block.slice(zubStart + "**Zubereitung:**".length);
    const stopMatch = after.match(/\n\*\*(?:Notizen|Status):\*\*/);
    instructions = (stopMatch ? after.slice(0, stopMatch.index) : after).trim();
  }

  const notes = fields["Notizen"] ?? "";

  return {
    num,
    name,
    meal_types,
    base_servings,
    ingredients,
    instructions,
    notes,
    status,
  };
}

async function main() {
  const targetEmail = process.argv[2];
  if (!targetEmail) {
    console.error("Usage: npm run seed:recipes <USER_EMAIL>");
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

  // User auflösen
  console.log(`Suche User "${targetEmail}"…`);
  const usersResp = await supabase.auth.admin.listUsers();
  if (usersResp.error) {
    console.error(usersResp.error);
    process.exit(1);
  }
  const user = usersResp.data.users.find((u) => u.email === targetEmail);
  if (!user) {
    console.error(`User nicht gefunden: ${targetEmail}`);
    process.exit(1);
  }
  console.log(`  → user_id ${user.id}`);

  // Markdown lesen
  const md = readFileSync(PROPOSAL_PATH, "utf8");
  const recipes = parseProposal(md);
  console.log(`Geparst: ${recipes.length} Rezepte aus ${PROPOSAL_PATH}`);

  // Stammzutaten dieses Users laden (für Name → ID-Mapping)
  const ingResp = await supabase
    .from("ingredient")
    .select("id, display_name")
    .eq("user_id", user.id);
  if (ingResp.error) {
    console.error(ingResp.error);
    process.exit(1);
  }
  const ingByName = new Map<string, string>();
  for (const i of ingResp.data) {
    ingByName.set((i.display_name as string).toLowerCase(), i.id as string);
  }

  // Bestehende Rezeptnamen
  const recResp = await supabase
    .from("recipe")
    .select("name")
    .eq("user_id", user.id);
  if (recResp.error) {
    console.error(recResp.error);
    process.exit(1);
  }
  const existingNames = new Set(
    (recResp.data ?? []).map((r) => (r.name as string).toLowerCase()),
  );

  let inserted = 0;
  let skippedStatus = 0;
  let skippedExisting = 0;
  let skippedNoIngredient = 0;

  for (const r of recipes) {
    const status = r.status.trim().replace(/[*_]/g, "").toUpperCase();
    if (status !== "OK") {
      if (status === "BAUSTELLE") {
        console.warn(`  ⚠ ${r.num} ${r.name}: BAUSTELLE — übersprungen.`);
      }
      skippedStatus++;
      continue;
    }

    if (existingNames.has(r.name.toLowerCase())) {
      skippedExisting++;
      continue;
    }

    if (r.meal_types.length === 0) {
      console.warn(`  ✗ ${r.num} ${r.name}: keine Mahlzeitenkategorie.`);
      continue;
    }

    // Zutaten-IDs auflösen
    const resolved: Array<{ ingredient_id: string; amount: number; unit: string }> = [];
    let missing: string[] = [];
    for (const ri of r.ingredients) {
      const id = ingByName.get(ri.display_name.toLowerCase());
      if (!id) {
        missing.push(ri.display_name);
        continue;
      }
      resolved.push({
        ingredient_id: id,
        amount: ri.amount,
        unit: ri.unit,
      });
    }
    if (missing.length > 0) {
      console.warn(
        `  ✗ ${r.num} ${r.name}: fehlende Zutaten: ${missing.join(", ")}`,
      );
      skippedNoIngredient++;
      continue;
    }

    // Recipe insert
    const recInsert = await supabase
      .from("recipe")
      .insert({
        user_id: user.id,
        name: r.name,
        meal_types: r.meal_types,
        base_servings: r.base_servings,
        instructions: r.instructions,
        suppressed: false,
      })
      .select("id")
      .single();
    if (recInsert.error) {
      console.warn(`  ✗ ${r.num} ${r.name}: ${recInsert.error.message}`);
      continue;
    }
    const recipeId = (recInsert.data as { id: string }).id;

    // Zutaten-Junction inserten
    if (resolved.length > 0) {
      const rows = resolved.map((ri, idx) => ({
        recipe_id: recipeId,
        ingredient_id: ri.ingredient_id,
        amount: ri.amount,
        unit: ri.unit,
        position: idx,
      }));
      const junctionInsert = await supabase
        .from("recipe_ingredient")
        .insert(rows);
      if (junctionInsert.error) {
        console.warn(
          `  ✗ ${r.num} ${r.name}: Junction-Fehler: ${junctionInsert.error.message}`,
        );
        // Recipe wieder löschen für Konsistenz
        await supabase.from("recipe").delete().eq("id", recipeId);
        continue;
      }
    }

    inserted++;
    process.stdout.write(`\r  Eingefügt: ${inserted}/${recipes.length}`);
  }
  process.stdout.write("\n");

  console.log(
    `Fertig.\n  Eingefügt: ${inserted}\n  Status nicht OK: ${skippedStatus}\n  Existiert: ${skippedExisting}\n  Fehlende Zutat: ${skippedNoIngredient}`,
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
