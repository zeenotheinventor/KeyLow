import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";

import { useTheme } from "../../lib/theme";

// The root layout's AuthGate already covers these routes, so the stack needs no guard of its own.
// The sheet draws its own header, so the root has none, and neither have the scanner and the food form. The
// food screen keeps a native header, now in the theme's colours, though what is under it is still the old
// light look until its own restyle lands.
export default function FoodsLayout() {
  const { scheme, colors } = useTheme();

  return (
    <>
      {/* Light content on the dark sheet, dark on the light one. */}
      <StatusBar style={scheme === "dark" ? "light" : "dark"} />
      <Stack
        screenOptions={{
          headerTintColor: colors["text-primary"],
          headerStyle: { backgroundColor: colors.background },
          headerTitleStyle: { color: colors["text-primary"] },
          contentStyle: { backgroundColor: colors.background },
        }}
      >
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="[id]/index" options={{ title: "Food" }} />
        <Stack.Screen name="new" options={{ headerShown: false }} />
        <Stack.Screen name="[id]/edit" options={{ headerShown: false }} />
        <Stack.Screen name="scan" options={{ headerShown: false }} />
      </Stack>
    </>
  );
}
