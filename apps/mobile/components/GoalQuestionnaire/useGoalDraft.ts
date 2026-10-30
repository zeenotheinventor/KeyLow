import { useContext } from "react";

import { GoalDraftContext } from "./goalDraftContext";

import type { GoalDraftContextValue } from "./goalDraftContext";

/** The answers of the goal questionnaire that is open. Only a screen inside the flow's stack may call it. */
export function useGoalDraft(): GoalDraftContextValue {
  const context = useContext(GoalDraftContext);
  if (context === undefined) {
    throw new Error("useGoalDraft must be used inside a GoalDraftProvider");
  }

  return context;
}
