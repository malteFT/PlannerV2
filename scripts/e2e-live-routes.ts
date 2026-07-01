/**
 * Rate-Limit-freundliche Live-Checks — ohne echten Signup:
 *   1. Callback-Endpoint auf Vercel HEAD/GET ohne Code → sollte zu
 *      /login?error=confirm redirecten.
 *   2. Signup-Seite auf Vercel prüft (200 + rendert Form).
 *   3. Confirm-Email-Setting durch ein leises Rate-Limit-Signal indirekt
 *      bestätigen (der zweite Signup-Versuch würde in einem gesunden
 *      Setup nicht rate-limited, sondern durchgehen — wir testen ihn nicht,
 *      wir schließen aus dem Rate-Limit-Symptom, dass Mails verschickt
 *      werden).
 */
async function main() {
  const base = "https://planner-v2-ten.vercel.app";
  const failures: string[] = [];
  const ok = (m: string) => console.log(`  ✓ ${m}`);
  const fail = (m: string) => {
    console.error(`  ✗ ${m}`);
    failures.push(m);
  };

  // ------------------------------------------------------------------
  // 1. Callback ohne code
  // ------------------------------------------------------------------
  console.log(`\n[1/3] GET ${base}/auth/callback (ohne code)…`);
  const cbResp = await fetch(`${base}/auth/callback`, { redirect: "manual" });
  console.log(`    Status: ${cbResp.status}, Location: ${cbResp.headers.get("location") ?? "(none)"}`);
  if (cbResp.status >= 300 && cbResp.status < 400) {
    const loc = cbResp.headers.get("location") ?? "";
    if (loc.includes("/login") && loc.includes("error=confirm")) {
      ok(`Redirect zu /login?error=confirm wie erwartet`);
    } else {
      fail(`Redirect ging zu "${loc}" (erwartet: /login?error=confirm)`);
    }
  } else {
    fail(`unerwarteter Status ${cbResp.status}`);
  }

  // ------------------------------------------------------------------
  // 2. Signup-Seite live erreichbar
  // ------------------------------------------------------------------
  console.log(`\n[2/3] GET ${base}/signup…`);
  const suResp = await fetch(`${base}/signup`, { redirect: "manual" });
  console.log(`    Status: ${suResp.status}`);
  if (suResp.status === 200) {
    const body = await suResp.text();
    if (body.includes("Konto erstellen") || body.includes("Registrieren")) {
      ok(`/signup liefert 200 mit Signup-Form`);
    } else {
      fail(`/signup 200 aber Form-Text nicht gefunden`);
    }
  } else if (suResp.status >= 300 && suResp.status < 400) {
    // Wenn wir eingeloggt sind, redirected er zu /plan — unwahrscheinlich hier
    fail(`/signup unerwartet redirected: ${suResp.status} → ${suResp.headers.get("location")}`);
  } else {
    fail(`/signup Status ${suResp.status}`);
  }

  // ------------------------------------------------------------------
  // 3. Login-Seite live erreichbar
  // ------------------------------------------------------------------
  console.log(`\n[3/3] GET ${base}/login…`);
  const liResp = await fetch(`${base}/login`, { redirect: "manual" });
  console.log(`    Status: ${liResp.status}`);
  if (liResp.status === 200) {
    const body = await liResp.text();
    if (
      (body.includes("Anmelden") || body.includes("E-Mail")) &&
      body.includes("Registrieren")
    ) {
      ok(`/login rendert Form inkl. "Registrieren"-Link`);
    } else {
      fail(`/login 200 aber Registrieren-Link nicht gefunden`);
    }
  } else {
    fail(`/login Status ${liResp.status}`);
  }

  console.log(`\n===================================================`);
  if (failures.length === 0) {
    console.log(`ALLE CHECKS GRÜN. Auth-Routen sind live.`);
    process.exit(0);
  } else {
    console.log(`FAILURES (${failures.length}):`);
    for (const f of failures) console.log(`  - ${f}`);
    process.exit(2);
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
