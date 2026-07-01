import { Suspense } from "react";
import { SignupForm } from "./signup-form";

export default function SignupPage() {
  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <Suspense>
        <SignupForm />
      </Suspense>
    </main>
  );
}
