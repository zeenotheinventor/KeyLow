import { createContext } from "react";

import type { GoalDraft, GoalDraftAnswers } from "@keylow/core/training";

export type GoalDraftContextValue = Readonly<{
  /** The answers given so far, which the steps read and the summary will save. */
  draft: GoalDraft;
  /** Whether the answers differ from those the flow opened with, which is what closing would lose. */
  hasChanges: boolean;
  /** Gives answers, each replacing any earlier answer to the same question. */
  answer: (answers: GoalDraftAnswers) => void;
  /**
   * Starts the draft over from these answers, which also become the ones it counts changes against. The Goal
   * screen does it with the stored goal, so every way into the questions starts from the goal as stored.
   */
  restart: (answers: GoalDraftAnswers) => void;
}>;

export const GoalDraftContext = createContext<GoalDraftContextValue | undefined>(undefined);
