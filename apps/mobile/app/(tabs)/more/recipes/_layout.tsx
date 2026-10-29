import { Stack } from "expo-router";

import { useTheme } from "../../../../lib/theme";

// The recipe library is a stack inside the More tab, so the archived recipes are pushed inside it and the tab
// bar stays with More current. The editor and the recipe view are pushed over the tabs instead, and hide the bar.
export default function RecipesLayout() {
  const { colors } = useTheme();

  return (
    <Stack
      screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}
    />
  );
}
