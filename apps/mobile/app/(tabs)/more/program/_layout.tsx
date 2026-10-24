import { Stack } from "expo-router";

import { useTheme } from "../../../../lib/theme";

// The screens of the Programme feature are files in this folder, pushed over the More tab's stack. This layout
// is the whole of the stack, so a screen is added as a file and this one is not edited.
export default function ProgramLayout() {
  const { colors } = useTheme();

  return (
    <Stack
      screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}
    />
  );
}
