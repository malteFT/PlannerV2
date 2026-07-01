"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Verhindert Open-Redirect: nur Pfade akzeptieren, die mit '/' anfangen
 * und nicht mit '//' oder einem Schema. Sonst Fallback auf '/plan'.
 */
function safeRedirect(target: string): string {
  if (!target || typeof target !== "string") return "/plan";
  // Externe URLs wie "https://evil.com" oder "//evil.com" abwehren.
  if (!target.startsWith("/")) return "/plan";
  if (target.startsWith("//")) return "/plan";
  return target;
}

export async function signIn(formData: FormData) {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
  const redirectTo = safeRedirect(String(formData.get("redirect") ?? "/plan"));

  if (!email || !password) {
    return { error: "E-Mail und Passwort sind erforderlich." };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/", "layout");
  redirect(redirectTo);
}

export async function signOut() {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/login");
}

/**
 * Signup mit Email + Passwort. Supabase schickt automatisch eine
 * Bestätigungsmail — der Nutzer kann sich erst nach Klick auf den Link
 * einloggen. Der Confirm-Link führt zurück auf /auth/callback, wo die
 * Session gesetzt wird.
 *
 * Rückgabe:
 *   - { error: string } → Formular zeigt Fehler an
 *   - { success: true } → Formular zeigt Success-State ("Prüfe deine Mail")
 */
export async function signUp(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const passwordConfirm = String(formData.get("password_confirm") ?? "");

  if (!email || !password) {
    return { error: "E-Mail und Passwort sind erforderlich." };
  }
  if (password.length < 8) {
    return { error: "Passwort muss mindestens 8 Zeichen haben." };
  }
  if (password !== passwordConfirm) {
    return { error: "Passwörter stimmen nicht überein." };
  }

  const supabase = await createSupabaseServerClient();

  // Origin dynamisch vom Request nehmen, damit Local-Dev und Prod
  // dieselbe Server-Action nutzen können.
  const hdrs = await headers();
  const origin =
    hdrs.get("origin") ??
    (hdrs.get("host")
      ? `https://${hdrs.get("host")}`
      : "");

  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: origin ? `${origin}/auth/callback` : undefined,
    },
  });

  if (error) {
    return { error: error.message };
  }

  return { success: true as const };
}
