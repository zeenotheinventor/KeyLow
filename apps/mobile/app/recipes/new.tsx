import { useLocalSearchParams } from "expo-router";

import { RecipeEditor } from "../../components/RecipeEditor";
import { NEW_RECIPE_NAME_PARAMETER } from "../../lib/recipeRoutes";

// A standard stack push over the tabs, opened from the library's New recipe. The root layout's AuthGate
// covers it and the root stack gives it no header. A word typed into the library's search arrives as the
// name; a repeated parameter arrives as an array, so the first value is used.
export default function NewRecipeRoute() {
  const parameters = useLocalSearchParams<{ [NEW_RECIPE_NAME_PARAMETER]?: string | string[] }>();
  const typedName = parameters[NEW_RECIPE_NAME_PARAMETER];
  const initialName = Array.isArray(typedName) ? typedName[0] : typedName;

  return <RecipeEditor initialName={initialName} />;
}
