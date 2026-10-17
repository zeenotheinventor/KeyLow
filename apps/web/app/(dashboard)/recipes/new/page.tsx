import { PageFrame } from "@/app/(dashboard)/PageFrame";
import { RecipeEditor } from "@/components/recipes";
import { NEW_RECIPE_NAME_PARAMETER } from "@/lib/recipeRoutes";

export default async function NewRecipePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const typedName = (await searchParams)[NEW_RECIPE_NAME_PARAMETER];

  return (
    <PageFrame variant="recipeEditor">
      <RecipeEditor initialName={typeof typedName === "string" ? typedName : undefined} />
    </PageFrame>
  );
}
