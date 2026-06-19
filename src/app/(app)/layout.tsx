import { redirect } from "next/navigation";
import { Sidebar } from "@/components/layout/sidebar";
import { BottomNav } from "@/components/layout/bottom-nav";
import { QueryProvider } from "@/lib/query/provider";
import { Toaster } from "@/components/ui/sonner";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Doppelte Absicherung zur Middleware: Server-Session prüfen.
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  return (
    <QueryProvider>
      <div className="flex flex-1 flex-col md:flex-row">
        <Sidebar />
        <div className="flex flex-1 flex-col">
          <main className="flex-1 px-4 py-6 md:px-8 md:py-10">{children}</main>
          <BottomNav />
        </div>
      </div>
      <Toaster
        richColors
        position="bottom-right"
        closeButton
        duration={4000}
      />
    </QueryProvider>
  );
}
