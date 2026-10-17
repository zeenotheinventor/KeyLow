import { PageFrame } from "@/app/(dashboard)/PageFrame";
import { RecipeViewScreen } from "@/components/recipes";

export default async function RecipePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  return (
    <PageFrame variant="recipeEditor">
      <RecipeViewScreen id={id} />
    </PageFrame>
  );
}
