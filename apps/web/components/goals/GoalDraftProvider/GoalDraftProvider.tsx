"use client";

import { goalDraftReducer, hasGoalDraftChanged, initialGoalDraft } from "@keylow/core/training";
import { useCallback, useMemo, useReducer, useState } from "react";

import { GoalDraftContext } from "./goalDraftContext";

import type { GoalDraftContextValue } from "./goalDraftContext";
import type { GoalDraftProviderProps } from "./types";

/**
 * The answers of one goal questionnaire, shared by every question of the flow. They live exactly as long as
 * the flow's layout does, so Back keeps them and leaving the flow drops them, and nothing is stored or
 * logged. It also says whether they differ from those the flow opened with.
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
