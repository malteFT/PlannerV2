"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { ChevronLeft } from "lucide-react";

import { Button } from "@/components/ui/button";
import { IngredientForm } from "@/components/ingredient/ingredient-form";
import { useCreateIngredient } from "@/lib/queries/ingredients";
import type { IngredientFormValues } from "@/lib/validators";

export default function NewIngredientPage() {
  const router = useRouter();
  const create = useCreateIngredient();

  async function handleSubmit(values: IngredientFormValues) {
    await create.mutateAsync(values);
    toast.success("Zutat angelegt");
    router.push("/ingredients");
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon-sm" render={<Link href="/ingredients" />}>
          <ChevronLeft />
        </Button>
        <h1 className="text-2xl font-semibold tracking-tight">Neue Zutat</h1>
      </div>
      <IngredientForm onSubmit={handleSubmit} submitLabel="Anlegen" />
    </div>
  );
}
