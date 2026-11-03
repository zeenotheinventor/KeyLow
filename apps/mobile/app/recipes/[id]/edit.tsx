import { useLocalSearchParams } from "expo-router";

import { RecipeEditorScreen } from "../../../components/RecipeEditorScreen";
import { ADD_INGREDIENT_QUERY_PARAMETER } from "../../../lib/recipeRoutes";

// A standard stack push over the tabs, opened from a library row or from an assistant card's link. The root
// layout's AuthGate covers it and the root stack gives it no header. An imported line that matched no food
// arrives as the word to search for; a repeated parameter arrives as an array, so the first value is used.
export default function EditRecipeRoute() {
  const parameters = useLocalSearchParams<{
    id: string;
    [ADD_INGREDIENT_QUERY_PARAMETER]?: string | string[];
  }>();
  const typedWord = parameters[ADD_INGREDIENT_QUERY_PARAMETER];
  const addIngredientQuery = Array.isArray(typedWord) ? typedWord[0] : typedWord;

  return <RecipeEditorScreen addIngredientQuery={addIngredientQuery} id={parameters.id} />;
}
