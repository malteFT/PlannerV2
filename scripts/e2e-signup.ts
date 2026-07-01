/**
 * End-to-End-Test für Copy-on-Signup:
 *   1. Testuser via admin.createUser (email_confirm=true) anlegen.
 *   2. handle_new_user()-Trigger sollte automatisch feuern und Templates
 *      in ingredient/recipe/recipe_ingredient kopieren.
 *   3. Counts prüfen: ingredient == template_ingredient, recipe ==
 *      template_recipe, junction == template_recipe_ingredient.
 *   4. Snapshot-Versionen in user_settings gesetzt?
 *   5. RLS-Cross-Check: Sample-Zutat vom Testuser darf nicht Maltes user_id
 *      haben und umgekehrt.
 *   6. Cleanup: admin.deleteUser → cascade räumt alle Rows.
 *
 * Aufruf:
 *   npm run test:e2e:signup <MALTE_EMAIL>
 * Optional 2. Argument: Testemail (Default: plannerv2-e2e-<ts>@example.com).
 */
import path from "node:path";
import { fileURLToPath } from "node:url";
import { config as loadEnv } from "dotenv";
import { createClient } from "@supabase/supabase-js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
loadEnv({ path: path.resolve(__dirname, "..", ".env.local") });

async function main() {
  const malteEmail = process.argv[2];
  if (!malteEmail) {
    console.error("Usage: npm run test:e2e:signup <MALTE_EMAIL> [TEST_EMAIL]");
    process.exit(1);
  }
  const testEmail =
    process.argv[3] ?? `plannerv2-e2e-${Date.now()}@example.com`;
  const testPassword = "TestPassw0rd-" + Math.random().toString(36).slice(2, 10);

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

  const log = (...a: unknown[]) => console.log(...a);
  const ok = (m: string) => console.log(`  ✓ ${m}`);
  const fail = (m: string) => {
    console.error(`  ✗ ${m}`);
    failures.push(m);
  };
  const failures: string[] = [];

  // -------------------------------------------------------------------------
  // 0. Referenzdaten sammeln (Templates + Malte)
  // -------------------------------------------------------------------------

  log(`\n[0/6] Referenzdaten sammeln…`);

  const [tiCountResp, trCountResp, triCountResp] = await Promise.all([
    supabase.from("template_ingredient").select("*", { count: "exact", head: true }),
    supabase.from("template_recipe").select("*", { count: "exact", head: true }),
    supabase.from("template_recipe_ingredient").select("*", { count: "exact", head: true }),
  ]);
  const templateIngredientCount = tiCountResp.count ?? -1;
  const templateRecipeCount = trCountResp.count ?? -1;
  const templateJunctionCount = triCountResp.count ?? -1;
  log(
    `    Templates: ${templateIngredientCount} Zutaten, ${templateRecipeCount} Rezepte, ${templateJunctionCount} Junction`,
  );

  const malteListResp = await supabase.auth.admin.listUsers();
  if (malteListResp.error) {
    console.error("Fehler beim Listen der User:", malteListResp.error);
    process.exit(1);
  }
  const malteUser = malteListResp.data.users.find((u) => u.email === malteEmail);
  if (!malteUser) {
    console.error(`Malte-User "${malteEmail}" nicht gefunden.`);
    process.exit(1);
  }
  log(`    Malte user_id: ${malteUser.id}`);

  const malteIngResp = await supabase
    .from("ingredient")
    .select("*", { count: "exact", head: true })
    .eq("user_id", malteUser.id);
  const malteIngCountBefore = malteIngResp.count ?? -1;
  const malteRecResp = await supabase
    .from("recipe")
    .select("*", { count: "exact", head: true })
    .eq("user_id", malteUser.id);
  const malteRecCountBefore = malteRecResp.count ?? -1;
  log(
    `    Malte: ${malteIngCountBefore} Zutaten, ${malteRecCountBefore} Rezepte (vor Test)`,
  );

  // -------------------------------------------------------------------------
  // 1. Testuser anlegen (auto-confirm)
  // -------------------------------------------------------------------------

  log(`\n[1/6] Testuser anlegen: ${testEmail}`);
  const createResp = await supabase.auth.admin.createUser({
    email: testEmail,
    password: testPassword,
    email_confirm: true,
  });
  if (createResp.error || !createResp.data.user) {
    console.error(`Fehler beim Anlegen:`, createResp.error);
    process.exit(1);
  }
  const testUserId = createResp.data.user.id;
  log(`    → user_id ${testUserId}`);

  // -------------------------------------------------------------------------
  // 2. Counts prüfen
  // -------------------------------------------------------------------------

  log(`\n[2/6] Kopier-Counts prüfen…`);

  // Kleine Verzögerung, damit der Trigger sicher durch ist (er läuft
  // synchron im Insert, aber wir geben Postgres sicherheitshalber einen
  // Moment).
  await new Promise((r) => setTimeout(r, 500));

  const testIngResp = await supabase
    .from("ingredient")
    .select("*", { count: "exact", head: true })
    .eq("user_id", testUserId);
  const testIngCount = testIngResp.count ?? -1;
  if (testIngCount === templateIngredientCount) {
    ok(`ingredient-Count: ${testIngCount} (== template ${templateIngredientCount})`);
  } else {
    fail(
      `ingredient-Count: ${testIngCount} !== template ${templateIngredientCount}`,
    );
  }

  const testRecResp = await supabase
    .from("recipe")
    .select("*", { count: "exact", head: true })
    .eq("user_id", testUserId);
  const testRecCount = testRecResp.count ?? -1;
  if (testRecCount === templateRecipeCount) {
    ok(`recipe-Count: ${testRecCount} (== template ${templateRecipeCount})`);
  } else {
    fail(`recipe-Count: ${testRecCount} !== template ${templateRecipeCount}`);
  }

  // Junction: user-scoped Ergebnis via JOIN (RLS bypasst mit service_role)
  const testJunctionResp = await supabase
    .from("recipe_ingredient")
    .select("recipe:recipe!inner(user_id)", { count: "exact", head: true })
    .eq("recipe.user_id", testUserId);
  const testJunctionCount = testJunctionResp.count ?? -1;
  if (testJunctionCount === templateJunctionCount) {
    ok(
      `recipe_ingredient-Count: ${testJunctionCount} (== template ${templateJunctionCount})`,
    );
  } else {
    fail(
      `recipe_ingredient-Count: ${testJunctionCount} !== template ${templateJunctionCount}`,
    );
  }

  // -------------------------------------------------------------------------
  // 3. Snapshot-Version in user_settings
  // -------------------------------------------------------------------------

  log(`\n[3/6] Snapshot-Version in user_settings prüfen…`);

  const settingsResp = await supabase
    .from("user_settings")
    .select(
      "template_snapshot_ingredient_version, template_snapshot_recipe_version",
    )
    .eq("user_id", testUserId)
    .single();
  if (settingsResp.error || !settingsResp.data) {
    fail(`user_settings nicht gefunden: ${settingsResp.error?.message ?? "no data"}`);
  } else {
    const s = settingsResp.data as {
      template_snapshot_ingredient_version: number;
      template_snapshot_recipe_version: number;
    };
    if (s.template_snapshot_ingredient_version >= 1) {
      ok(`snapshot_ingredient_version = ${s.template_snapshot_ingredient_version}`);
    } else {
      fail(`snapshot_ingredient_version zu niedrig: ${s.template_snapshot_ingredient_version}`);
    }
    if (s.template_snapshot_recipe_version >= 1) {
      ok(`snapshot_recipe_version = ${s.template_snapshot_recipe_version}`);
    } else {
      fail(`snapshot_recipe_version zu niedrig: ${s.template_snapshot_recipe_version}`);
    }
  }

  // -------------------------------------------------------------------------
  // 4. RLS-Isolation: Testuser hat NUR eigene Rows, keine Malte-Rows
  // -------------------------------------------------------------------------

  log(`\n[4/6] RLS-Isolation prüfen (via user-scoped Client)…`);

  // Wir bauen einen Client, der als Testuser authentifiziert ist (via
  // anonKey + signInWithPassword). Dann sehen wir, was RLS für ihn erlaubt.
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!anonKey) {
    fail("NEXT_PUBLIC_SUPABASE_ANON_KEY nicht gesetzt — RLS-Check nicht möglich");
  } else {
    const userClient = createClient(url, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const signInResp = await userClient.auth.signInWithPassword({
      email: testEmail,
      password: testPassword,
    });
    if (signInResp.error) {
      fail(`SignIn als Testuser fehlgeschlagen: ${signInResp.error.message}`);
    } else {
      // Der User sollte GENAU 66 Zutaten sehen (seine eigenen), nicht 132.
      const seenIngResp = await userClient
        .from("ingredient")
        .select("user_id", { count: "exact", head: true });
      const seenIngCount = seenIngResp.count ?? -1;
      if (seenIngCount === templateIngredientCount) {
        ok(
          `RLS: Testuser sieht ${seenIngCount} Zutaten (keine Malte-Leaks)`,
        );
      } else {
        fail(
          `RLS: Testuser sieht ${seenIngCount} Zutaten — erwartet ${templateIngredientCount}`,
        );
      }

      const seenRecResp = await userClient
        .from("recipe")
        .select("user_id", { count: "exact", head: true });
      const seenRecCount = seenRecResp.count ?? -1;
      if (seenRecCount === templateRecipeCount) {
        ok(`RLS: Testuser sieht ${seenRecCount} Rezepte (keine Malte-Leaks)`);
      } else {
        fail(
          `RLS: Testuser sieht ${seenRecCount} Rezepte — erwartet ${templateRecipeCount}`,
        );
      }

      // Cross-Check: alle sichtbaren Zutaten müssen dem Testuser gehören
      const sampleResp = await userClient
        .from("ingredient")
        .select("user_id")
        .limit(5);
      const foreign = (sampleResp.data ?? []).filter(
        (r) => (r.user_id as string) !== testUserId,
      );
      if (foreign.length === 0) {
        ok(`RLS: alle 5 stichprobenartigen Zutaten gehören dem Testuser`);
      } else {
        fail(
          `RLS: ${foreign.length} von 5 Zutaten haben fremde user_id — LEAK!`,
        );
      }
    }
  }

  // -------------------------------------------------------------------------
  // 5. Malte-Daten unverändert
  // -------------------------------------------------------------------------

  log(`\n[5/6] Malte-Daten prüfen (unverändert?)…`);

  const malteIngAfter = await supabase
    .from("ingredient")
    .select("*", { count: "exact", head: true })
    .eq("user_id", malteUser.id);
  const malteRecAfter = await supabase
    .from("recipe")
    .select("*", { count: "exact", head: true })
    .eq("user_id", malteUser.id);
  if ((malteIngAfter.count ?? -1) === malteIngCountBefore) {
    ok(`Malte Zutaten: ${malteIngAfter.count} (unverändert)`);
  } else {
    fail(
      `Malte Zutaten: ${malteIngAfter.count} !== ${malteIngCountBefore} — TAINTED!`,
    );
  }
  if ((malteRecAfter.count ?? -1) === malteRecCountBefore) {
    ok(`Malte Rezepte: ${malteRecAfter.count} (unverändert)`);
  } else {
    fail(
      `Malte Rezepte: ${malteRecAfter.count} !== ${malteRecCountBefore} — TAINTED!`,
    );
  }

  // -------------------------------------------------------------------------
  // 6. Cleanup
  // -------------------------------------------------------------------------

  log(`\n[6/6] Testuser löschen…`);
  // Supabase's admin.deleteUser gibt teilweise 500er wenn viele Cascade-Rows
  // dranhängen. Wir löschen deshalb erst die abhängigen Rows manuell (bypassed
  // RLS via service_role), dann den Auth-User. Idempotent bei Retry.
  const cleanupSteps = [
    () => supabase.from("recipe").delete().eq("user_id", testUserId),
    () => supabase.from("ingredient").delete().eq("user_id", testUserId),
    () => supabase.from("user_settings").delete().eq("user_id", testUserId),
  ];
  for (const step of cleanupSteps) {
    const r = await step();
    if (r.error) fail(`Cleanup-Row-Delete: ${r.error.message}`);
  }
  const delResp = await supabase.auth.admin.deleteUser(testUserId);
  if (delResp.error) {
    fail(`admin.deleteUser: ${delResp.error.message}`);
  } else {
    ok(`Testuser gelöscht`);
  }
  // Post-cleanup: cascade check
  const afterIng = await supabase
    .from("ingredient")
    .select("*", { count: "exact", head: true })
    .eq("user_id", testUserId);
  const afterRec = await supabase
    .from("recipe")
    .select("*", { count: "exact", head: true })
    .eq("user_id", testUserId);
  if ((afterIng.count ?? -1) === 0 && (afterRec.count ?? -1) === 0) {
    ok(`Nach Cleanup: 0 Rows in ingredient/recipe für gelöschten user`);
  } else {
    fail(
      `Nach Cleanup: ingredient=${afterIng.count}, recipe=${afterRec.count} (erwartet 0/0)`,
    );
  }

  // -------------------------------------------------------------------------
  // Verdikt
  // -------------------------------------------------------------------------

  console.log(`\n===================================================`);
  if (failures.length === 0) {
    console.log(`ALLE CHECKS GRÜN. Copy-on-Signup funktioniert.`);
    process.exit(0);
  } else {
    console.log(`FAILURES (${failures.length}):`);
    for (const f of failures) console.log(`  - ${f}`);
    process.exit(2);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
