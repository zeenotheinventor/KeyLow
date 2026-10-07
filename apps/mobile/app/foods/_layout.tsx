import { colors } from "@keylow/tokens";
import { Stack } from "expo-router";

// The root layout's AuthGate already covers these routes, so the stack needs no guard of its own.
export default function FoodsLayout() {
  return (
    <Stack screenOptions={{ headerTintColor: colors.brand["600"] }}>
      <Stack.Screen name="new" options={{ title: "New food" }} />
      <Stack.Screen name="[id]/edit" options={{ title: "Edit food" }} />
    </Stack>
  );
}
