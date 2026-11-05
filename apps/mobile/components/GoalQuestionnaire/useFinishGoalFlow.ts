import { useNavigation, useRouter } from "expo-router";
import { useCallback } from "react";

import { useCloseGoalFlow } from "./useCloseGoalFlow";
import { goalPath } from "../../lib/goalRoutes";

/**
 * Returns what ends the flow once a goal is saved. When the flow was opened from the Goal screen, that screen
 * is the first of the flow's stack, and the person lands back on it, where the new answers show. A flow with
 * no Goal screen under it, which is the first goal being set or a link into the questions, ends where closing
 * it does.
 */
export function useFinishGoalFlow(): () => void {
  const navigation = useNavigation();
  const router = useRouter();
  const closeFlow = useCloseGoalFlow();

  return useCallback(() => {
    const hasGoalScreen = navigation.getState()?.routes.some((route) => route.name === "index");

    if (hasGoalScreen === true) {
      router.dismissTo(goalPath());
    } else {
      closeFlow();
    }
  }, [navigation, router, closeFlow]);
}
