/**
 * Temporäre Debug-Route — gibt aus, ob die kritischen ENV-Variablen
 * im Vercel-Build angekommen sind, OHNE die Werte zu leaken.
 *
 * Außerdem: testet, ob der Vercel-Server das Supabase-Backend erreichen kann.
 *
 * Nach erfolgreicher Diagnose wieder löschen.
 */
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // Versuche, Supabase tatsächlich zu erreichen.
  let connectivity: Record<string, unknown> = { tried: false };
  if (url && anon) {
    const target = `${url}/auth/v1/health`;
    try {
      const res = await fetch(target, {
        method: "GET",
        headers: { apikey: anon },
        // Kurzer Timeout, sonst hängt die Route ewig.
        signal: AbortSignal.timeout(8000),
      });
      const body = await res.text().catch(() => "(could not read body)");
      connectivity = {
        tried: true,
        target,
        ok: res.ok,
        status: res.status,
        statusText: res.statusText,
        body_preview: body.slice(0, 200),
      };
    } catch (e) {
      connectivity = {
        tried: true,
        target,
        ok: false,
        error_name: e instanceof Error ? e.name : "unknown",
        error_message: e instanceof Error ? e.message : String(e),
        cause:
          e instanceof Error && "cause" in e
            ? String((e as { cause?: unknown }).cause)
            : null,
      };
    }
  }

  return NextResponse.json({
    NEXT_PUBLIC_SUPABASE_URL: {
      present: !!url,
      length: url?.length ?? 0,
      starts_with_https: url?.startsWith("https://") ?? false,
      preview: url ? `${url.slice(0, 40)}…` : null,
    },
    NEXT_PUBLIC_SUPABASE_ANON_KEY: {
      present: !!anon,
      length: anon?.length ?? 0,
      starts_with_eyj: anon?.startsWith("eyJ") ?? false,
    },
    connectivity,
    runtime: "nodejs",
    deployed_at: new Date().toISOString(),
  });
}
