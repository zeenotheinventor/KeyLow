import { useLocalSearchParams } from "expo-router";

import { AddToListScreen } from "../../../components/AddToListScreen";
import { ADD_TO_LIST_SERVINGS_PARAMETER } from "../../../lib/recipeRoutes";

// A standard stack push over the recipe view or the shopping list, opened from the view's More menu or the
// list's recipe picker. The root layout's AuthGate covers it and the root stack gives it no header. A
// repeated parameter arrives as an array, so the first value is used.
export default function AddToListRoute() {
  const parameters = useLocalSearchParams<{
    id: string;
    [ADD_TO_LIST_SERVINGS_PARAMETER]?: string | string[];
  }>();
  const servings = parameters[ADD_TO_LIST_SERVINGS_PARAMETER];

  return (
    <AddToListScreen
      id={parameters.id}
      servingsText={Array.isArray(servings) ? servings[0] : servings}
    />
  );
}
