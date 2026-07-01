/**
 * End-to-End-Test des ÖFFENTLICHEN Signup-Flows (nicht admin.createUser):
 *   1. auth.signUp() mit anon-Key — simuliert exakt was das Signup-Formular macht.
 *   2. Prüfen, ob Session sofort da ist (= "Confirm email" ist deaktiviert)
 *      oder erst nach Confirm (= "Confirm email" ist aktiviert). Beides ist
 *      valide, aber der Test meldet welches.
 *   3. Trigger-Effekt prüfen: Templates via service_role zählen (der
 *      Auth-User wird beim Signup schon angelegt, auch wenn Confirm noch
 *      pending ist — der Trigger feuert also bereits).
 *   4. Callback-Endpoint auf Vercel HEAD-checken (302 zu /login?error=confirm
 *      wenn kein Code, aber Route lebt).
 *   5. Cleanup wie beim admin-Test.
 */
import { config as loadEnv } from "dotenv";
import { createClient } from "@supabase/supabase-js";

loadEnv({ path: ".env.local" });

async function main() {
  const malteEmail = process.argv[2];
  if (!malteEmail) {
    console.error("Usage: npm run test:e2e:public-signup <MALTE_EMAIL>");
    process.exit(1);
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !anonKey || !serviceKey) {
    console.error("Env fehlt (URL/ANON/SERVICE_ROLE)");
    process.exit(1);
  }

  const failures: string[] = [];
  const ok = (m: string) => console.log(`  ✓ ${m}`);
  const fail = (m: string) => {
    console.error(`  ✗ ${m}`);
    failures.push(m);
  };

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const publicClient = createClient(supabaseUrl, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // Referenz für spätere Isolation-Prüfung
  const [ti, tr, tri] = await Promise.all([
    admin.from("template_ingredient").select("*", { count: "exact", head: true }),
    admin.from("template_recipe").select("*", { count: "exact", head: true }),
    admin.from("template_recipe_ingredient").select("*", { count: "exact", head: true }),
  ]);
  console.log(
    `Templates: ${ti.count} Zutaten, ${tr.count} Rezepte, ${tri.count} Junction`,
  );

  // Malte-Referenz (soll unverändert bleiben)
  const malteList = await admin.auth.admin.listUsers();
  const malte = malteList.data.users.find((u) => u.email === malteEmail);
  if (!malte) {
    fail(`Malte "${malteEmail}" nicht gefunden`);
    process.exit(1);
  }
  const malteBefore = {
    ing: (await admin.from("ingredient").select("*", { count: "exact", head: true }).eq("user_id", malte.id)).count,
    rec: (await admin.from("recipe").select("*", { count: "exact", head: true }).eq("user_id", malte.id)).count,
  };
  console.log(`Malte before: ${malteBefore.ing} Zutaten, ${malteBefore.rec} Rezepte`);

  // -------------------------------------------------------------------------
  // 1. Öffentlicher Signup
  // -------------------------------------------------------------------------

  const testEmail = `plannerv2-public-e2e-${Date.now()}@sharklasers.com`;
  const testPassword = "TestPassw0rd-" + Math.random().toString(36).slice(2, 10);

  console.log(`\n[1/5] auth.signUp mit anon-Key als "${testEmail}"…`);
  const emailRedirectTo = "https://planner-v2-ten.vercel.app/auth/callback";
  const signUpResp = await publicClient.auth.signUp({
    email: testEmail,
    password: testPassword,
    options: { emailRedirectTo },
  });
  if (signUpResp.error) {
    fail(`auth.signUp: ${signUpResp.error.message}`);
    process.exit(2);
  }

  const gotSession = !!signUpResp.data.session;
  const gotUser = !!signUpResp.data.user;
  ok(`signUp erfolgreich (user=${gotUser}, session=${gotSession})`);
  if (gotSession) {
    console.log(
      `    → Session sofort erhalten. 'Confirm email' scheint DEAKTIVIERT zu sein.`,
    );
  } else {
    console.log(
      `    → Kein Session-Token. 'Confirm email' ist aktiviert — erwartet.`,
    );
  }

  const testUserId = signUpResp.data.user?.id;
  if (!testUserId) {
    fail("signUp lieferte keine user.id");
    process.exit(2);
  }

  // -------------------------------------------------------------------------
  // 2. Trigger-Effekt prüfen (via service_role, weil User evtl. nicht confirmed)
  // -------------------------------------------------------------------------

  console.log(`\n[2/5] Trigger-Effekt prüfen (via service_role)…`);
  await new Promise((r) => setTimeout(r, 500));

  const [testIng, testRec, testSet] = await Promise.all([
    admin.from("ingredient").select("*", { count: "exact", head: true }).eq("user_id", testUserId),
    admin.from("recipe").select("*", { count: "exact", head: true }).eq("user_id", testUserId),
    admin.from("user_settings")
      .select("template_snapshot_ingredient_version, template_snapshot_recipe_version")
      .eq("user_id", testUserId).maybeSingle(),
  ]);

  if (testIng.count === ti.count) ok(`Zutaten kopiert: ${testIng.count}`);
  else fail(`Zutaten-Count: ${testIng.count} !== ${ti.count}`);

  if (testRec.count === tr.count) ok(`Rezepte kopiert: ${testRec.count}`);
  else fail(`Rezepte-Count: ${testRec.count} !== ${tr.count}`);

  if (testSet.data) {
    const s = testSet.data as {
      template_snapshot_ingredient_version: number;
      template_snapshot_recipe_version: number;
    };
    if (s.template_snapshot_ingredient_version >= 1 && s.template_snapshot_recipe_version >= 1) {
      ok(`Snapshot-Version: ing=${s.template_snapshot_ingredient_version}, rec=${s.template_snapshot_recipe_version}`);
    } else {
      fail(`Snapshot-Version zu niedrig: ${JSON.stringify(s)}`);
    }
  } else {
    fail(`user_settings nicht angelegt: ${testSet.error?.message ?? "no data"}`);
  }

  // -------------------------------------------------------------------------
  // 3. Doppel-Signup mit derselben Email → Fehler (Supabase Standard)
  // -------------------------------------------------------------------------

  console.log(`\n[3/5] Doppel-Signup mit derselben Email…`);
  const dupResp = await publicClient.auth.signUp({
    email: testEmail,
    password: "OtherPass9999!",
    options: { emailRedirectTo },
  });
  // Supabase gibt bei bereits registrierter Email keinen error zurück, sondern
  // ein "leerer" user (identities=[]) — als Anti-Enumeration-Schutz. Wir
  // prüfen dass mindestens KEIN neuer User angelegt wurde.
  const stillOne = (
    await admin.auth.admin.listUsers()
  ).data.users.filter((u) => u.email === testEmail);
  if (stillOne.length === 1) {
    ok(`Doppel-Signup: exakt 1 User (kein Duplikat angelegt)`);
  } else {
    fail(`Doppel-Signup: ${stillOne.length} User mit Email ${testEmail}`);
  }
  if (dupResp.data.user && (dupResp.data.user.identities?.length ?? 0) === 0) {
    ok(`Doppel-Signup: identities leer (Anti-Enumeration wie erwartet)`);
  }

  // -------------------------------------------------------------------------
  // 4. Callback-Route auf Vercel erreichbar?
  // -------------------------------------------------------------------------

  console.log(`\n[4/5] Callback-Endpoint auf Vercel prüfen…`);
  try {
    const resp = await fetch(
      "https://planner-v2-ten.vercel.app/auth/callback",
      { redirect: "manual" },
    );
    // Ohne Code sollte er zu /login?error=confirm redirecten (302 oder 307).
    if (resp.status >= 300 && resp.status < 400) {
      const loc = resp.headers.get("location") ?? "";
      if (loc.includes("/login")) {
        ok(`GET /auth/callback → ${resp.status} → ${loc}`);
      } else {
        fail(`GET /auth/callback → ${resp.status} → ${loc} (erwartet /login)`);
      }
    } else if (resp.status === 200) {
      // Manche Deployments antworten mit 200 + Body statt Redirect
      ok(`GET /auth/callback → 200 (Route lebt)`);
    } else {
      fail(`GET /auth/callback → ${resp.status}`);
    }
  } catch (e) {
    fail(`GET /auth/callback: ${e instanceof Error ? e.message : String(e)}`);
  }

  // -------------------------------------------------------------------------
  // 5. Malte-Daten unverändert + Cleanup
  // -------------------------------------------------------------------------

  console.log(`\n[5/5] Malte-Isolation + Cleanup…`);
  const malteAfter = {
    ing: (await admin.from("ingredient").select("*", { count: "exact", head: true }).eq("user_id", malte.id)).count,
    rec: (await admin.from("recipe").select("*", { count: "exact", head: true }).eq("user_id", malte.id)).count,
  };
  if (malteAfter.ing === malteBefore.ing && malteAfter.rec === malteBefore.rec) {
    ok(`Malte unverändert: ${malteAfter.ing}/${malteAfter.rec}`);
  } else {
    fail(`Malte tainted: ${JSON.stringify(malteAfter)} vs. ${JSON.stringify(malteBefore)}`);
  }

  // Cleanup: erst Rows manuell (Supabase-Auth-API zickt sonst), dann User
  await admin.from("recipe").delete().eq("user_id", testUserId);
  await admin.from("ingredient").delete().eq("user_id", testUserId);
  await admin.from("user_settings").delete().eq("user_id", testUserId);
  const del = await admin.auth.admin.deleteUser(testUserId);
  if (del.error) {
    fail(`Cleanup: ${del.error.message}`);
  } else {
    ok(`Cleanup ok — Testuser gelöscht`);
  }

  console.log(`\n===================================================`);
  if (failures.length === 0) {
    console.log(`ALLE CHECKS GRÜN. Öffentlicher Signup-Flow funktioniert.`);
    process.exit(0);
  } else {
    console.log(`FAILURES (${failures.length}):`);
    for (const f of failures) console.log(`  - ${f}`);
    process.exit(2);
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
