import { Stack, useLocalSearchParams } from "expo-router";

import { readSetupMode, SetupScreen } from "../components/SetupScreen";

// A standard stack push over the tabs, as Targets is. The root layout's AuthGate covers it and the root stack
// gives it no header. `mode` is `first-run` or `recalculate`, and anything else reads as `recalculate`. The iOS
// edge swipe is off, so it cannot leave the wizard from a middle step: Back and Close are the ways out.
export default function SetupRoute() {
  const { mode } = useLocalSearchParams<{ mode?: string | string[] }>();

  return (
    <>
      <Stack.Screen options={{ gestureEnabled: false }} />
      <SetupScreen mode={readSetupMode(mode)} />
    </>
  );
}
