import { createContext } from "react";

import type { GoalDraft, GoalDraftAnswers } from "@keylow/core/training";

export type GoalDraftContextValue = Readonly<{
  /** The answers given so far, which the steps read. */
  draft: GoalDraft;
  /** Whether the answers differ from those the flow opened with, which is what closing would lose. */
  hasChanges: boolean;
  /** Gives answers, each replacing any earlier answer to the same question. */
  answer: (answers: GoalDraftAnswers) => void;
}>;

export const GoalDraftContext = createContext<GoalDraftContextValue | undefined>(undefined);
