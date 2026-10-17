import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";

import { useTheme } from "../../lib/theme";

// The root layout's AuthGate already covers these routes, so the stack needs no guard of its own.
// The sheet draws its own header, so the root has none, and neither has any screen in it: the food, the
// scanner and the food form draw theirs.
export default function FoodsLayout() {
  const { scheme, colors } = useTheme();

  return (
    <>
      {/* Light content on the dark sheet, dark on the light one. */}
      <StatusBar style={scheme === "dark" ? "light" : "dark"} />
      <Stack
        screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}
      >
        <Stack.Screen name="index" />
        <Stack.Screen name="[id]/index" />
        <Stack.Screen name="[id]/log" />
        <Stack.Screen name="recipe/[id]/log" />
        <Stack.Screen name="new" />
        <Stack.Screen name="[id]/edit" />
        <Stack.Screen name="scan" />
        <Stack.Screen name="quick-add" />
      </Stack>
    </>
  );
}
