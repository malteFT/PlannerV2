/**
 * Seed-Skript: liest Maltes ingredient/recipe/recipe_ingredient und
 * kopiert die Zeilen einmalig in die globalen Template-Tabellen aus
 * Migration 0007. Danach bekommt jeder neu registrierte User diesen
 * Snapshot automatisch via handle_new_user().
 *
 * Idempotent: existierende Templates mit gleichem lower(display_name) /
 * lower(name) werden nicht überschrieben.
 *
 * Aufruf:
 *   npm run seed:templates <USER_EMAIL>
 *
 * Voraussetzungen:
 *   - .env.local mit SUPABASE_SERVICE_ROLE_KEY
 *   - Migration 0007 ausgeführt
 *   - Maltes ingredient/recipe/recipe_ingredient sind bereits gesät
 */
import path from "node:path";
import { fileURLToPath } from "node:url";
import { config as loadEnv } from "dotenv";
import { createClient } from "@supabase/supabase-js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
loadEnv({ path: path.resolve(__dirname, "..", ".env.local") });

type IngredientRow = {
  id: string;
  display_name: string;
  bls_code: string;
  default_unit: "g" | "ml" | "piece";
  grams_per_piece: number | null;
  category: string;
  aliases: string[];
};

type RecipeRow = {
  id: string;
  name: string;
  meal_types: string[];
  base_servings: number;
  instructions: string;
};

type RecipeIngredientRow = {
  recipe_id: string;
  ingredient_id: string;
  amount: number;
  unit: "g" | "ml" | "piece";
  position: number;
};

async function main() {
  const targetEmail = process.argv[2];
  if (!targetEmail) {
    console.error("Usage: npm run seed:templates <USER_EMAIL>");
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
  console.log(`Suche User "${targetEmail}"…`);
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

  // --------------------------------------------------------------------
  // 1. Zutaten kopieren
  // --------------------------------------------------------------------

  const ingResp = await supabase
    .from("ingredient")
    .select(
      "id, display_name, bls_code, default_unit, grams_per_piece, category, aliases",
    )
    .eq("user_id", user.id);
  if (ingResp.error) {
    console.error("Fehler beim Lesen der Zutaten:", ingResp.error);
    process.exit(1);
  }
  const sourceIngredients = (ingResp.data ?? []) as IngredientRow[];
  // eslint-disable-next-line no-console
  console.log(`Gefunden: ${sourceIngredients.length} Zutaten bei ${targetEmail}`);

  const existingTiResp = await supabase
    .from("template_ingredient")
    .select("id, display_name");
  if (existingTiResp.error) {
    console.error(
      "Fehler beim Lesen bestehender template_ingredient:",
      existingTiResp.error,
    );
    process.exit(1);
  }
  const existingTiByName = new Map<string, string>();
  for (const row of existingTiResp.data ?? []) {
    existingTiByName.set(
      (row.display_name as string).toLowerCase(),
      row.id as string,
    );
  }

  // Mapping: malte_ingredient.id → template_ingredient.id (für Junction)
  const ingIdMap = new Map<string, string>();
  let ingInserted = 0;
  let ingSkipped = 0;

  for (const row of sourceIngredients) {
    const key = row.display_name.toLowerCase();
    const existingId = existingTiByName.get(key);
    if (existingId) {
      ingIdMap.set(row.id, existingId);
      ingSkipped++;
      continue;
    }
    const insertResp = await supabase
      .from("template_ingredient")
      .insert({
        display_name: row.display_name,
        bls_code: row.bls_code,
        default_unit: row.default_unit,
        grams_per_piece: row.grams_per_piece,
        category: row.category,
        aliases: row.aliases ?? [],
      })
      .select("id")
      .single();
    if (insertResp.error || !insertResp.data) {
      console.warn(
        `  ✗ Zutat "${row.display_name}": ${insertResp.error?.message ?? "kein data"}`,
      );
      continue;
    }
    ingIdMap.set(row.id, insertResp.data.id as string);
    existingTiByName.set(key, insertResp.data.id as string);
    ingInserted++;
    process.stdout.write(
      `\r  Templates (Zutaten): eingefügt ${ingInserted}, übersprungen ${ingSkipped}`,
    );
  }
  process.stdout.write("\n");

  // --------------------------------------------------------------------
  // 2. Rezepte kopieren
  // --------------------------------------------------------------------

  const recResp = await supabase
    .from("recipe")
    .select("id, name, meal_types, base_servings, instructions")
    .eq("user_id", user.id);
  if (recResp.error) {
    console.error("Fehler beim Lesen der Rezepte:", recResp.error);
    process.exit(1);
  }
  const sourceRecipes = (recResp.data ?? []) as RecipeRow[];
  // eslint-disable-next-line no-console
  console.log(`Gefunden: ${sourceRecipes.length} Rezepte bei ${targetEmail}`);

  const existingTrResp = await supabase
    .from("template_recipe")
    .select("id, name");
  if (existingTrResp.error) {
    console.error(
      "Fehler beim Lesen bestehender template_recipe:",
      existingTrResp.error,
    );
    process.exit(1);
  }
  const existingTrByName = new Map<string, string>();
  for (const row of existingTrResp.data ?? []) {
    existingTrByName.set(
      (row.name as string).toLowerCase(),
      row.id as string,
    );
  }

  let recInserted = 0;
  let recSkipped = 0;
  let recSkippedNoIngredient = 0;
  let junctionRows = 0;

  for (const rec of sourceRecipes) {
    const key = rec.name.toLowerCase();
    if (existingTrByName.has(key)) {
      recSkipped++;
      continue;
    }

    // Zutaten für dieses Rezept lesen
    const riResp = await supabase
      .from("recipe_ingredient")
      .select("recipe_id, ingredient_id, amount, unit, position")
      .eq("recipe_id", rec.id);
    if (riResp.error) {
      console.warn(
        `  ✗ Rezept "${rec.name}" — Fehler beim Lesen der Junction: ${riResp.error.message}`,
      );
      continue;
    }
    const sourceJunction = (riResp.data ?? []) as RecipeIngredientRow[];

    // Alle Ingredient-IDs müssen sich in die Templates mappen lassen.
    const missing = sourceJunction
      .map((r) => r.ingredient_id)
      .filter((id) => !ingIdMap.has(id));
    if (missing.length > 0) {
      console.warn(
        `  ✗ Rezept "${rec.name}" — ${missing.length} Zutat(en) haben kein Template-Mapping, überspringe.`,
      );
      recSkippedNoIngredient++;
      continue;
    }

    // Rezept einfügen
    const insertResp = await supabase
      .from("template_recipe")
      .insert({
        name: rec.name,
        meal_types: rec.meal_types,
        base_servings: rec.base_servings,
        instructions: rec.instructions,
      })
      .select("id")
      .single();
    if (insertResp.error || !insertResp.data) {
      console.warn(
        `  ✗ Rezept "${rec.name}": ${insertResp.error?.message ?? "kein data"}`,
      );
      continue;
    }
    const newTemplateRecipeId = insertResp.data.id as string;
    existingTrByName.set(key, newTemplateRecipeId);

    // Junction einfügen
    const junctionRowsPayload = sourceJunction.map((r) => ({
      recipe_id: newTemplateRecipeId,
      ingredient_id: ingIdMap.get(r.ingredient_id)!,
      amount: r.amount,
      unit: r.unit,
      position: r.position,
    }));
    if (junctionRowsPayload.length > 0) {
      const juResp = await supabase
        .from("template_recipe_ingredient")
        .insert(junctionRowsPayload);
      if (juResp.error) {
        console.warn(
          `  ✗ Junction für "${rec.name}": ${juResp.error.message} — rolle Rezept zurück`,
        );
        await supabase
          .from("template_recipe")
          .delete()
          .eq("id", newTemplateRecipeId);
        existingTrByName.delete(key);
        continue;
      }
      junctionRows += junctionRowsPayload.length;
    }

    recInserted++;
    process.stdout.write(
      `\r  Templates (Rezepte): eingefügt ${recInserted}, übersprungen ${recSkipped}`,
    );
  }
  process.stdout.write("\n");

  // eslint-disable-next-line no-console
  console.log("Fertig.");
  console.log(
    `  Zutaten-Templates: eingefügt ${ingInserted}, übersprungen ${ingSkipped}`,
  );
  console.log(
    `  Rezept-Templates:  eingefügt ${recInserted}, übersprungen ${recSkipped}` +
      (recSkippedNoIngredient > 0
        ? `, übersprungen wegen fehlender Zutat ${recSkippedNoIngredient}`
        : ""),
  );
  console.log(`  Junction-Zeilen:   ${junctionRows}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
