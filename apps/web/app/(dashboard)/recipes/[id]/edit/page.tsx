import { PageFrame } from "@/app/(dashboard)/PageFrame";
import { RecipeEditorScreen } from "@/components/recipes";
import { ADD_INGREDIENT_QUERY_PARAMETER } from "@/lib/recipeRoutes";

type EditRecipePageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

// An assistant card's link for an unmatched ingredient arrives with the word to search for. A repeated
// parameter arrives as an array, so the first value is used.
export default async function EditRecipePage({ params, searchParams }: EditRecipePageProps) {
  const { id } = await params;
  const typedWord = (await searchParams)[ADD_INGREDIENT_QUERY_PARAMETER];
  const addIngredientQuery = Array.isArray(typedWord) ? typedWord[0] : typedWord;

  return (
    <PageFrame variant="recipeEditor">
      <RecipeEditorScreen id={id} addIngredientQuery={addIngredientQuery} />
    </PageFrame>
  );
}
