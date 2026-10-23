import { Stack } from "expo-router";

import { useTheme } from "../../../lib/theme";

// The More tab is a stack, so the Weight screen is pushed inside it and the tab bar stays with More current,
// as the Weight boards draw it.
export default function MoreLayout() {
  const { colors } = useTheme();

  return (
    <Stack
      screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}
    />
  );
}
