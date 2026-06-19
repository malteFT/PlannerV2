import { signOut } from "@/app/(auth)/login/actions";
import { Button } from "@/components/ui/button";

export default function SettingsPage() {
  return (
    <div className="space-y-6 max-w-xl">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="text-muted-foreground">
          Globales Profil — Energie, Makros, Mahlzeiten, Ausschluss.
        </p>
      </div>
      <form action={signOut}>
        <Button type="submit" variant="outline">
          Abmelden
        </Button>
      </form>
    </div>
  );
}
