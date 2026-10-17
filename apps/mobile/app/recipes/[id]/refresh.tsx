import { useLocalSearchParams } from "expo-router";

import { RecipeRefreshScreen } from "../../../components/RecipeRefreshScreen";

// A standard stack push over the recipe view, opened from its More menu. It is a full-height screen outside
// the tabs group, so the tab bar is hidden, as the view's and the editor's is. The root layout's AuthGate
// covers it and the root stack gives it no header.
export default function RefreshRecipeRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();

  return <RecipeRefreshScreen id={id} />;
}
