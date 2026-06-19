/**
 * Liest und validiert die Supabase-Env-Variablen.
 *
 * WICHTIG: Direkter statischer Property-Access auf process.env.NEXT_PUBLIC_*.
 * Dynamischer Index (process.env[name] mit Variable) verhindert die
 * Build-Time-Inlining im Browser-Bundle — die Werte würden zur Laufzeit
 * undefined sein, weil `process.env` im Browser leer ist.
 *
 * Webpack/Next ersetzen NEXT_PUBLIC_* nur bei statischem Zugriff durch
 * den literalen String, daher MUSS der Code so geschrieben sein.
 */

function nonEmpty(v: string | undefined, name: string): string {
  if (!v || v.trim() === "") {
    throw new Error(
      `Missing environment variable: ${name}. ` +
        `Auf Vercel: Project Settings → Environment Variables. ` +
        `Lokal: .env.local prüfen.`,
    );
  }
  return v;
}

export function getSupabaseEnv() {
  // Statische Property-Zugriffe — Next.js inlinet diese im Build.
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  return {
    url: nonEmpty(url, "NEXT_PUBLIC_SUPABASE_URL"),
    anonKey: nonEmpty(anonKey, "NEXT_PUBLIC_SUPABASE_ANON_KEY"),
  };
}
