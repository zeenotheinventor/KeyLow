import { useTrainingGoals } from "@keylow/api-client";
import { Stack } from "expo-router";
import { View } from "react-native";

import { goalAnswersOfRow, GoalDraftProvider } from "../../components/GoalQuestionnaire";
import { useTheme } from "../../lib/theme";
import { useReadsEnabled } from "../../lib/useReadsEnabled";

// The root layout's AuthGate already covers these routes, so the stack needs no guard of its own. The flow
// is a standard push over the tabs, as Setup is, and the questions draw their own header. The answers live
// in the provider for as long as the stack does, so Back keeps them and closing drops them. The provider
// reads the current goal once, when it mounts, so the flow opens filled with it. It is mounted when the
// goal read has finished, or the questions would show empty and fill a moment later. The blank waits only
// while a request is running (a failing one is retried a few times first). A read that is paused because the
// phone is offline, or off because the Terms are not accepted yet, does not wait: the flow still opens, with
// nothing filled, since the draft is read once and a goal arriving later does not fill it. A goal that cannot
// be read opens the questions empty too: saving then replaces the goal. The iOS edge swipe is off for the
// flow and for each question, so it cannot leave without Close asking first. While the blank waits it is on,
// since nothing can be lost there and the blank has no other way out.
export default function GoalLayout() {
  const { colors } = useTheme();
  const goals = useTrainingGoals({ enabled: useReadsEnabled() });
  const isWaiting = goals.isPending && goals.fetchStatus === "fetching";

  return (
    <>
      <Stack.Screen options={{ gestureEnabled: isWaiting }} />
      {isWaiting ? (
        <View className="flex-1 bg-background" />
      ) : (
        <GoalDraftProvider
          initialAnswers={
            goals.data === null || goals.data === undefined
              ? undefined
              : goalAnswersOfRow(goals.data)
          }
        >
          <Stack
            screenOptions={{
              headerShown: false,
              gestureEnabled: false,
              contentStyle: { backgroundColor: colors.background },
            }}
          />
        </GoalDraftProvider>
      )}
    </>
  );
}
