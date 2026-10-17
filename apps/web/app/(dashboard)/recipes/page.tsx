import { PageFrame } from "@/app/(dashboard)/PageFrame";
import { RecipeLibrary } from "@/components/recipes";

export default function RecipesPage() {
  return (
    <PageFrame variant="diary">
      <RecipeLibrary />
    </PageFrame>
  );
}
