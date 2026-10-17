import { useLocalSearchParams } from "expo-router";

import { RecipeEditorScreen } from "../../../components/RecipeEditorScreen";

// A standard stack push over the tabs, opened from a library row. The root layout's AuthGate covers it and
// the root stack gives it no header.
export default function EditRecipeRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();

  return <RecipeEditorScreen id={id} />;
}
