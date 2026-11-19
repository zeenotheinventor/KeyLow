import { Stack } from "expo-router";

import { useTheme } from "../../../../lib/theme";

// The Achievements screen and its badge sheet are files in this folder, pushed inside the More tab's stack, so the
// tab bar stays with More current. This layout is the whole of the stack.
export default function AchievementsLayout() {
  const { colors } = useTheme();

  return (
    <Stack
      screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}
    />
  );
}
