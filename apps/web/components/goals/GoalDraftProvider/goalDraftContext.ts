import { createContext } from "react";

import type { GoalDraft, GoalDraftAnswers } from "@keylow/core/training";

export type GoalDraftContextValue = Readonly<{
  /** The answers given so far, which the steps read. */
  draft: GoalDraft;
  /** Whether the answers differ from those the flow opened with, which is what closing would lose. */
  hasChanges: boolean;
  /** Gives answers, each replacing any earlier answer to the same question. */
  answer: (answers: GoalDraftAnswers) => void;
  /** Whether a goal was stored when the flow opened, which decides where a save or a close leaves to. */
  hasStoredGoal: boolean;
  /** Starts over from the stored goal: every answer is given again and none is counted as changed. */
  restart: (answers: GoalDraftAnswers) => void;
}>;

export const GoalDraftContext = createContext<GoalDraftContextValue | undefined>(undefined);
