import { colors } from "@keylow/tokens";
import { Stack } from "expo-router";

// The root layout's AuthGate already covers these routes, so the stack needs no guard of its own.
export default function FoodsLayout() {
  return (
    <Stack screenOptions={{ headerTintColor: colors.brand["600"] }}>
      <Stack.Screen name="index" options={{ title: "Find food" }} />
      <Stack.Screen name="[id]/index" options={{ title: "Food" }} />
      <Stack.Screen name="new" options={{ title: "New food" }} />
      <Stack.Screen name="[id]/edit" options={{ title: "Edit food" }} />
      <Stack.Screen name="scan" options={{ title: "Scan barcode" }} />
    </Stack>
  );
}
