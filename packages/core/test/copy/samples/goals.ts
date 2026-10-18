import * as copy from "../../../src/copy";

import type { GoalAnswers, PrioritySummary } from "../../../src/training";

// Every function `src/copy/goals.ts` exports, called with representative arguments. The voice test fails
// when a function has no row, so no sentence escapes the sweep.
const answers: GoalAnswers = {
  goal: "aesthetic",
  focus: ["v_taper"],
  days_per_week: 4,
  session_minutes: 60,
  equipment: ["barbell", "dumbbell", "cable"],
  experience: "intermediate",
};
const everyEquipment: GoalAnswers["equipment"] = [
  "barbell",
  "dumbbell",
  "kettlebell",
  "cable",
  "machine",
  "smith_machine",
  "ez_bar",
  "band",
  "bodyweight",
];
const summary: PrioritySummary = {
  first: ["chest_upper", "delt_side", "lats"],
  keptUp: ["biceps", "quads"],
  notTargeted: ["obliques"],
  answers,
};

export const samples: Record<string, () => string[]> = {
  describeQuestionStep: () => [1, 2, 3, 4, 5, 6].map(copy.describeQuestionStep),
  describeQuestionStepName: () => [1, 2, 3, 4, 5, 6].map(copy.describeQuestionStepName),
  describeOptionName: () => Object.values(copy.GOAL_OPTIONS).map(copy.describeOptionName),
  describeMinutesOption: () => copy.MINUTES_PRESETS.map(copy.describeMinutesOption),
  describeGoalAnswersSentence: () => {
    const variants: GoalAnswers[] = [
      answers,
      { ...answers, goal: "hybrid", focus: ["v_taper", "chest"], equipment: everyEquipment },
      { ...answers, goal: "strength", focus: [], equipment: [], days_per_week: 1 },
    ];
    return variants.map(copy.describeGoalAnswersSentence);
  },
  describePriorities: () => {
    const summaries: PrioritySummary[] = [
      summary,
      { ...summary, first: ["lats"], notTargeted: ["neck", "abs"] },
    ];
    return summaries.flatMap((prioritySummary) => {
      const priorities = copy.describePriorities(prioritySummary);
      return [
        priorities.answers,
        ...priorities.rows.flatMap((row) => [
          row.title,
          ...(row.detail === null ? [] : [row.detail]),
        ]),
        priorities.legend,
      ];
    });
  },
  describeGoalAnswerRows: () => {
    const variants: GoalAnswers[] = [answers, { ...answers, focus: [], equipment: [] }];
    return variants.flatMap((rowAnswers) =>
      copy.describeGoalAnswerRows(rowAnswers).flatMap((row) => [row.label, row.value, row.name]),
    );
  },
  describeGoalSetOn: () => [copy.describeGoalSetOn("2026-09-21")],
};
