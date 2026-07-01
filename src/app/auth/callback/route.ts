import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Callback für Supabase-Auth-Flows (Signup-Confirmation, Magic-Link, OAuth).
 * Supabase leitet nach der Bestätigung mit ?code=... hierher; wir tauschen
 * den Code gegen eine Session ein und leiten weiter.
 *
 * Fehler → zurück auf /login mit ?error=confirm damit der User es sieht.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const nextParam = searchParams.get("next");
  const next =
    nextParam && nextParam.startsWith("/") && !nextParam.startsWith("//")
      ? nextParam
      : "/plan";

  if (code) {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=confirm`);
}
