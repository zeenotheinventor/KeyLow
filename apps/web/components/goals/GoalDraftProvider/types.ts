import type { GoalDraftAnswers } from "@keylow/core/training";
import type { ReactNode } from "react";

export type GoalDraftProviderProps = {
  children: ReactNode;
  /** The current goal's answers, so the flow opens filled. Read once, when the flow opens. */
  initialAnswers?: GoalDraftAnswers | undefined;
};
