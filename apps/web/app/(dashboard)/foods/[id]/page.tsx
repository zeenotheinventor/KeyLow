import { isFoodId } from "@keylow/core/foods";
import { notFound } from "next/navigation";

import { PageFrame } from "@/app/(dashboard)/PageFrame";
import { FoodDetail } from "@/components/foods/FoodDetail";

export default async function FoodPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  if (!isFoodId(id)) {
    notFound();
  }

  return (
    <PageFrame variant="foodRecord">
      <FoodDetail id={id} />
    </PageFrame>
  );
}
