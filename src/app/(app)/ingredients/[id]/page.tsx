import { IngredientEditClient } from "@/components/ingredient/ingredient-edit-client";

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <IngredientEditClient id={id} />;
}
