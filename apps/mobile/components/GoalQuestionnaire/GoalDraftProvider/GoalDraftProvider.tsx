import { useCallback, useMemo, useReducer } from "react";

import { GoalDraftContext } from "../goalDraftContext";
import { goalDraftReducer, initialGoalDraft } from "../goalDraftReducer";

import type { GoalDraftProviderProps } from "./types";
import type { GoalDraftContextValue } from "../goalDraftContext";

/**
 * The answers of one goal questionnaire, shared by every question of the flow's stack. They live exactly
 * as long as the flow, so closing it drops them, and nothing is stored or logged. The summary will save
 * them at the end.
 */
export function GoalDraftProvider({ children, initialAnswers }: GoalDraftProviderProps) {
  const [draft, dispatch] = useReducer(goalDraftReducer, initialAnswers, initialGoalDraft);

  const answer: GoalDraftContextValue["answer"] = useCallback((answers) => {
    dispatch({ type: "answered", answers });
  }, []);

  const value = useMemo(() => ({ draft, answer }), [draft, answer]);

  return <GoalDraftContext.Provider value={value}>{children}</GoalDraftContext.Provider>;
}
