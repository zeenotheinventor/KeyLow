import { PageFrame } from "@/app/(dashboard)/PageFrame";
import { ShoppingListScreen } from "@/components/recipes";

export default function ShoppingListPage() {
  return (
    <PageFrame variant="diary">
      <ShoppingListScreen />
    </PageFrame>
  );
}
