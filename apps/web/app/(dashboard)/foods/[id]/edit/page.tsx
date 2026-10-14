import { notFound } from "next/navigation";

import { EditFoodScreen } from "./EditFoodScreen";

import { PageFrame } from "@/app/(dashboard)/PageFrame";
import { isFoodId } from "@/components/foods/isFoodId";

export default async function EditFoodPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  if (!isFoodId(id)) {
    notFound();
  }

  return (
    <PageFrame variant="foodRecord">
      <EditFoodScreen id={id} />
    </PageFrame>
  );
}
