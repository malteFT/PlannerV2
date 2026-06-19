/**
 * Liest und validiert die Supabase-Env-Variablen.
 *
 * Statt `process.env.X!` mit Non-Null-Assertion (was zur Laufzeit als
 * 'fetch failed' o.ä. zurückkommt, wenn die Variable fehlt), werfen wir
 * hier sofort einen klaren Error mit Hinweis, welche Variable fehlt.
 */
function readEnv(name: string): string {
  const v = process.env[name];
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
  return {
    url: readEnv("NEXT_PUBLIC_SUPABASE_URL"),
    anonKey: readEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
  };
}
