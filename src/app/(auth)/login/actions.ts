"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
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
