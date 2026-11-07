import * as copy from "../../../src/copy";

// Every function `src/copy/assistantTrainingCards.ts` exports, called with representative arguments. The
// voice test fails when a function has no row, so no sentence escapes the sweep.
export const samples: Record<string, () => string[]> = {
  describeGoalWas: () => [copy.describeGoalWas("Look better")],
  describeGoalsChangeDetail: () => [
    copy.describeGoalsChangeDetail(["Goal", "Days a week"]),
    copy.describeGoalsChangeDetail(["Session"]),
  ],
  describeGoalDays: () => [copy.describeGoalDays(3), copy.describeGoalDays(1)],
  describeGoalMinutes: () => [copy.describeGoalMinutes(60), copy.describeGoalMinutes(1)],
  describeGoalsStartedNote: () => [
    copy.describeGoalsStartedNote(["3 days a week", "60 minutes", "full gym"]),
    copy.describeGoalsStartedNote(["3 days a week"]),
  ],
  describeGoalsPutBack: () => [
    copy.describeGoalsPutBack(["4 days a week"]),
    copy.describeGoalsPutBack(["your goal, Look better", "4 days a week"]),
    copy.describeGoalsPutBack(["your goal, Look better", "4 days a week", "45 minutes a session"]),
  ],
  describeGoalMinutesPutBack: () => [copy.describeGoalMinutesPutBack(45)],
  describeGoalAnswerPutBack: () => [copy.describeGoalAnswerPutBack("Goal", "Look better")],
};
