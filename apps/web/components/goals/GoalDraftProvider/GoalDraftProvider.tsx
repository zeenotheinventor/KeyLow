"use client";

import { goalDraftReducer, hasGoalDraftChanged, initialGoalDraft } from "@keylow/core/training";
import { useCallback, useMemo, useReducer, useState } from "react";

import { GoalDraftContext } from "./goalDraftContext";

import type { GoalDraftContextValue } from "./goalDraftContext";
import type { GoalDraftProviderProps } from "./types";

/**
 * The answers of one goal questionnaire, shared by every question of the flow. They live exactly as long as
 * the flow's layout does, so Back keeps them and leaving the flow drops them, and nothing is stored or
 * logged. It also says whether they differ from those the flow opened with, and can be told to start over
 * from the stored goal, which the Goal page does each time it is in front.
 */
export function GoalDraftProvider({ children, initialAnswers }: GoalDraftProviderProps) {
  const [openedDraft, setOpenedDraft] = useState(() => initialGoalDraft(initialAnswers));
  const [draft, dispatch] = useReducer(goalDraftReducer, openedDraft);
  const [hasStoredGoal] = useState(initialAnswers !== undefined);

  const answer: GoalDraftContextValue["answer"] = useCallback((answers) => {
    dispatch({ type: "answered", answers });
  }, []);

  // Every answer of the new draft is given, so none of the old draft's is left behind.
  const restart: GoalDraftContextValue["restart"] = useCallback((answers) => {
    setOpenedDraft(initialGoalDraft(answers));
    dispatch({ type: "answered", answers });
  }, []);

  const value = useMemo(
    () => ({
      draft,
      hasChanges: hasGoalDraftChanged(draft, openedDraft),
      answer,
      hasStoredGoal,
      restart,
    }),
    [draft, openedDraft, answer, hasStoredGoal, restart],
  );

  return <GoalDraftContext.Provider value={value}>{children}</GoalDraftContext.Provider>;
}
