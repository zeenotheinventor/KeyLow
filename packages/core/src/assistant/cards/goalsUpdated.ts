import {
  GOALS_CLEARED_UNDONE,
  GOALS_SAVED_TITLE,
  GOALS_UPDATED_NOTE,
  GOALS_UPDATED_TITLE,
  describeGoalAnswerPutBack,
  describeGoalDays,
  describeGoalMinutes,
  describeGoalMinutesPutBack,
  describeGoalWas,
  describeGoalsChangeDetail,
  describeGoalsPutBack,
  describeGoalsStartedNote,
} from "../../copy/assistantTrainingCards";
import { FULL_GYM, describeGoalAnswerRows } from "../../copy/goals";
import { changedGoalAnswers } from "../../training/goalDraft";

import type { AssistantCardDraft } from "./entryCardEntry";
import type { GoalAnswerRow, GoalQuestionStep } from "../../copy/goals";
import type { GoalAnswers } from "../../training/goalAnswers";
import type { AssistantCardRow } from "../card";

/** The answers a first goal can have from the person, besides the goal and the experience it needs. */
export type GoalAnswerGiven = Exclude<keyof GoalAnswers, "goal" | "experience">;

export type GoalsUpdatedCardChange =
  | {
      /** The goal the person had, and the goal now. At least one answer differs. */
      before: GoalAnswers;
      after: GoalAnswers;
    }
  | {
      /** No goal before. `given` names the answers the person gave besides the goal and experience. */
      before: null;
      after: GoalAnswers;
      given: readonly GoalAnswerGiven[];
    };

const stepOfAnswer: Readonly<Record<keyof GoalAnswers, GoalQuestionStep>> = {
  goal: "goal",
  focus: "focus",
  days_per_week: "days",
  session_minutes: "minutes",
  equipment: "equipment",
  experience: "experience",
};

const rowOf = (answer: GoalAnswerRow, detail: string | null): AssistantCardRow => ({
  name: answer.label,
  amountText: detail,
  time: null,
  kcalText: answer.value,
  match: null,
  matchedFood: null,
  estimate: false,
});

/** The card for a first goal: the answers the person gave as rows, and a note for the ones chosen for them. */
function buildFirstGoalCard(
  after: GoalAnswers,
  given: readonly GoalAnswerGiven[],
): AssistantCardDraft {
  // The days are named in the note and not drawn as a row, which is the board's: two rows for a first goal.
  const shown = new Set<GoalQuestionStep>([
    "goal",
    "experience",
    ...given.filter((key) => key !== "days_per_week").map((key) => stepOfAnswer[key]),
  ]);
  const rows = describeGoalAnswerRows(after)
    .filter(({ step }) => shown.has(step))
    .map((answer) => rowOf(answer, null));
  const chosen = [
    describeGoalDays(after.days_per_week),
    ...(given.includes("session_minutes") ? [] : [describeGoalMinutes(after.session_minutes)]),
    ...(given.includes("equipment") ? [] : [FULL_GYM.label.toLowerCase()]),
  ];
  return {
    kind: "goals_updated",
    title: GOALS_SAVED_TITLE,
    sub: null,
    rows,
    changeDetail: describeGoalsChangeDetail(rows.map(({ name }) => name)),
    totalText: null,
    note: describeGoalsStartedNote(chosen),
    link: null,
    undo: "available",
    undoneSub: GOALS_CLEARED_UNDONE,
  };
}

/** One changed answer as it was, for the line under "Undone": "your goal, Look better" or "4 days a week". */
function describePutBack(step: GoalQuestionStep, before: GoalAnswers, was: GoalAnswerRow): string {
  switch (step) {
    case "days":
      return describeGoalDays(before.days_per_week);
    case "minutes":
      return describeGoalMinutesPutBack(before.session_minutes);
    default:
      return describeGoalAnswerPutBack(was.label, was.value);
  }
}

/**
 * The card after an `update_training_goals` (`assistant-card · goals-updated`). An update has one row for
 * each answer that changed, with what it was. A first goal has a row for each answer the person gave, and a
 * note that says what was chosen for them. Undo of either puts the person's goal back as it was, so the
 * card's line names it, and for a first goal says the goals are cleared.
 */
export function buildGoalsUpdatedCard(change: GoalsUpdatedCardChange): AssistantCardDraft {
  const { before, after } = change;
  if (before === null) {
    return buildFirstGoalCard(after, change.given);
  }
  const changed = new Set(changedGoalAnswers(before, after).map((key) => stepOfAnswer[key]));
  if (changed.size === 0) {
    // The tool saves nothing for a goal that did not change, so a card for it is a mistake.
    throw new RangeError("A goals card needs at least one answer that changed");
  }
  const wasRows = describeGoalAnswerRows(before);
  const changes = describeGoalAnswerRows(after).flatMap((answer, index) => {
    const was = wasRows[index];
    return was !== undefined && changed.has(answer.step) ? [{ answer, was }] : [];
  });
  return {
    kind: "goals_updated",
    title: GOALS_UPDATED_TITLE,
    sub: null,
    rows: changes.map(({ answer, was }) => rowOf(answer, describeGoalWas(was.value))),
    changeDetail: describeGoalsChangeDetail(changes.map(({ answer }) => answer.label)),
    totalText: null,
    note: GOALS_UPDATED_NOTE,
    link: null,
    undo: "available",
    undoneSub: describeGoalsPutBack(
      changes.map(({ answer, was }) => describePutBack(answer.step, before, was)),
    ),
  };
}
