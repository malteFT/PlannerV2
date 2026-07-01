"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { signUp } from "../login/actions";

export function SignupForm() {
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await signUp(formData);
      if (result?.error) {
        setError(result.error);
        return;
      }
      if (result?.success) {
        setSuccess(true);
      }
    });
  }

  if (success) {
    return (
      <Card className="w-full max-w-sm shadow-card">
        <CardHeader className="space-y-1">
          <CardTitle className="text-xl">Fast geschafft</CardTitle>
          <p className="text-sm text-muted-foreground">
            Wir haben dir einen Bestätigungslink geschickt. Öffne dein
            Postfach und klicke den Link, um deinen Account zu aktivieren.
          </p>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Schon bestätigt?{" "}
            <Link href="/login" className="text-primary underline-offset-4 hover:underline">
              Zur Anmeldung
            </Link>
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-sm shadow-card">
      <CardHeader className="space-y-1">
        <CardTitle className="text-xl">Konto erstellen</CardTitle>
        <p className="text-sm text-muted-foreground">
          Mit deiner E-Mail und einem Passwort (mind. 8 Zeichen).
        </p>
      </CardHeader>
      <CardContent>
        <form action={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="email">E-Mail</Label>
            <Input
              id="email"
              name="email"
              type="email"
              required
              autoComplete="email"
              disabled={isPending}
              className="h-11"
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="password">Passwort</Label>
            <Input
              id="password"
              name="password"
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
              disabled={isPending}
              className="h-11"
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="password_confirm">Passwort bestätigen</Label>
            <Input
              id="password_confirm"
              name="password_confirm"
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
              disabled={isPending}
              className="h-11"
            />
          </div>
          {error && (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          )}
          <Button type="submit" disabled={isPending} className="w-full h-11">
            {isPending ? "Registriere…" : "Registrieren"}
          </Button>
          <p className="text-center text-sm text-muted-foreground">
            Schon ein Konto?{" "}
            <Link href="/login" className="text-primary underline-offset-4 hover:underline">
              Anmelden
            </Link>
          </p>
        </form>
      </CardContent>
    </Card>
  );
}
