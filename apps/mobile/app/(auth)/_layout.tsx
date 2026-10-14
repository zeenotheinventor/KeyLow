import { Stack } from "expo-router";

import { useTheme } from "../../lib/theme";

export default function AuthLayout() {
  const { colors } = useTheme();

  // The screen behind a change between sign in and sign up takes the screen's colour, so it never shows white.
  return (
    <Stack
      screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}
    />
  );
}
