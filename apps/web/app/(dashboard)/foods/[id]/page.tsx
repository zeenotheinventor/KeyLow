import { notFound } from "next/navigation";

import { FoodDetail } from "@/components/foods/FoodDetail";
import { isFoodId } from "@/components/foods/isFoodId";

export default async function FoodPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  if (!isFoodId(id)) {
    notFound();
  }

  return <FoodDetail id={id} />;
}
