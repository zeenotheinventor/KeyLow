import { initialSetupWizardState, savedAnswersOf, setupWizardReducer } from "@keylow/core/setup";
import { useEffect, useReducer } from "react";

import type { SetupState } from "../repos/setup";

/**
 * The wizard's answers and its step, in the reducer. The saved answers are laid under whatever has been
 * answered when they first arrive, and the reducer ignores them after that. `regionCode` is the device
 * region, which the body step's units start from when the profile has none.
 */
export function useSetupDraft(
  setupState: SetupState | undefined,
  today: string,
  regionCode: string | null | undefined,
) {
  const [state, dispatch] = useReducer(setupWizardReducer, initialSetupWizardState);

  useEffect(() => {
    if (setupState !== undefined) {
      dispatch({
        type: "savedAnswersLoaded",
        saved: savedAnswersOf(setupState, regionCode),
        today,
        weighInDate: setupState.latestWeighIn?.localDate,
      });
    }
  }, [regionCode, setupState, today]);

  return { state, dispatch };
}
