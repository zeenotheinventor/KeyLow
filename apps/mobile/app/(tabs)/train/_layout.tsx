import { Stack } from "expo-router";

import { useTheme } from "../../../lib/theme";

// The Train tab is a stack, so the screens pushed from it, such as the routines and the history, open inside
// it and the tab bar stays, as the Recipes tab does.
export default function TrainLayout() {
  const { colors } = useTheme();

  return (
    <Stack
      screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}
    />
  );
}
