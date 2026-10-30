import { createContext } from "react";

import type { GoalDraft, GoalDraftAnswers } from "./goalDraftReducer";

export type GoalDraftContextValue = Readonly<{
  /** The answers given so far, which the steps read and the summary will save. */
  draft: GoalDraft;
  /** Gives answers, each replacing any earlier answer to the same question. */
  answer: (answers: GoalDraftAnswers) => void;
}>;

export const GoalDraftContext = createContext<GoalDraftContextValue | undefined>(undefined);
