/**
 * Temporäre Debug-Route — gibt aus, ob die kritischen ENV-Variablen
 * im Vercel-Build angekommen sind, OHNE die Werte zu leaken.
 *
 * Nach erfolgreicher Diagnose wieder löschen.
 */
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  return NextResponse.json({
    NEXT_PUBLIC_SUPABASE_URL: {
      present: !!url,
      length: url?.length ?? 0,
      starts_with_https: url?.startsWith("https://") ?? false,
      // Nur erste 30 Zeichen — sicher genug, da URL ohnehin public ist
      preview: url ? `${url.slice(0, 40)}…` : null,
    },
    NEXT_PUBLIC_SUPABASE_ANON_KEY: {
      present: !!anon,
      length: anon?.length ?? 0,
      starts_with_eyj: anon?.startsWith("eyJ") ?? false,
    },
    runtime: "nodejs",
    deployed_at: new Date().toISOString(),
  });
}
