import { useCallback, useMemo, useReducer, useState } from "react";

import { GoalDraftContext } from "../goalDraftContext";
import { goalDraftReducer, hasGoalDraftChanged, initialGoalDraft } from "../goalDraftReducer";

import type { GoalDraftProviderProps } from "./types";
import type { GoalDraftContextValue } from "../goalDraftContext";

/**
 * The answers of one goal questionnaire, shared by every question of the flow's stack. They live exactly
 * as long as the flow, so closing it drops them, and nothing is stored or logged. The summary saves
 * them at the end. It also says whether they differ from those the flow opened with.
 */
export function GoalDraftProvider({ children, initialAnswers }: GoalDraftProviderProps) {
  const [openedDraft] = useState(() => initialGoalDraft(initialAnswers));
  const [draft, dispatch] = useReducer(goalDraftReducer, openedDraft);

  const answer: GoalDraftContextValue["answer"] = useCallback((answers) => {
    dispatch({ type: "answered", answers });
  }, []);

  const value = useMemo(
    () => ({ draft, hasChanges: hasGoalDraftChanged(draft, openedDraft), answer }),
    [draft, openedDraft, answer],
  );

  return <GoalDraftContext.Provider value={value}>{children}</GoalDraftContext.Provider>;
}
