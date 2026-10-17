import { PageFrame } from "@/app/(dashboard)/PageFrame";
import { ArchivedRecipes } from "@/components/recipes";

export default function ArchivedRecipesPage() {
  return (
    <PageFrame variant="diary">
      <ArchivedRecipes />
    </PageFrame>
  );
}
