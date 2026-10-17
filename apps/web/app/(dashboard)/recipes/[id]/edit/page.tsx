import { PageFrame } from "@/app/(dashboard)/PageFrame";
import { RecipeEditorScreen } from "@/components/recipes";

export default async function EditRecipePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  return (
    <PageFrame variant="recipeEditor">
      <RecipeEditorScreen id={id} />
    </PageFrame>
  );
}
