import { useNavigation, useRouter } from "expo-router";
import { useCallback } from "react";

import { trainPath } from "../../lib/routineRoutes";

/**
 * Returns what closes the whole goal questionnaire from any question. The flow is one screen of the root
 * stack and its questions sit deeper, in its own stack, so going back from one only returns to the question
 * before it. The flow is dismissed by going back in the navigator above, which leaves the user where it was
 * opened. When the flow is the only screen there is, as after a cold link, the user goes to the Train tab.
 */
export function useCloseGoalFlow(): () => void {
  const navigation = useNavigation();
  const router = useRouter();

  return useCallback(() => {
    const parent = navigation.getParent();

    if (parent?.canGoBack() === true) {
      parent.goBack();
    } else {
      router.replace(trainPath());
    }
  }, [navigation, router]);
}
