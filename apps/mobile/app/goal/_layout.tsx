import { Stack } from "expo-router";

import { GoalDraftProvider } from "../../components/GoalQuestionnaire";
import { useTheme } from "../../lib/theme";

// The root layout's AuthGate already covers these routes, so the stack needs no guard of its own. The flow
// is a standard push over the tabs, as Setup is, and the questions draw their own header. The answers live
// in the provider for as long as the stack does, so Back keeps them and closing drops them. The iOS edge
// swipe is off for the flow and for each question, so it cannot leave without Close asking first.
export default function GoalLayout() {
  const { colors } = useTheme();

  return (
    <GoalDraftProvider>
      <Stack.Screen options={{ gestureEnabled: false }} />
      <Stack
        screenOptions={{
          headerShown: false,
          gestureEnabled: false,
          contentStyle: { backgroundColor: colors.background },
        }}
      />
    </GoalDraftProvider>
  );
}
