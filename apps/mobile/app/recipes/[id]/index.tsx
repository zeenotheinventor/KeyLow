import { useLocalSearchParams } from "expo-router";

import { RecipeViewScreen } from "../../../components/RecipeViewScreen";

// A standard stack push over the tabs, opened from a library row. It is a full-height screen outside the
// tabs group, so the tab bar is hidden, as the editor's and the entry screen's is. The root layout's
// AuthGate covers it and the root stack gives it no header.
export default function RecipeViewRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();

  return <RecipeViewScreen id={id} />;
}
