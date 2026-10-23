import { DEFAULT_RATE_PCT_PER_WEEK } from "./presets";
import { GOALS } from "./types";

import type { SetupDraft, SetupGoal } from "./types";

const ADULT_AGE_YEARS = 18;

/**
 * The goals offered at this age (ADR 0002 Amendment 1, "Safety rules"): all three from 18, and
 * under 18 no lose. The program screen's edit applies the same rule.
 */
export function goalsAllowed(ageYears: number): readonly SetupGoal[] {
  return ageYears >= ADULT_AGE_YEARS ? GOALS : GOALS.filter((goal) => goal !== "lose");
}

/**
 * The answers with this goal chosen. Choosing a different goal brings that goal's default rate back,
 * because a rate from another goal may not exist for it. Choosing the same goal again changes nothing.
 */
export function withGoal(answers: SetupDraft, goal: SetupGoal): SetupDraft {
  if (answers.goal === goal) {
    return answers;
  }
  return { ...answers, goal, ratePctPerWeek: DEFAULT_RATE_PCT_PER_WEEK[goal] };
}

/** The goal preselected at this age: lose from 18, and maintain under 18, where lose is not offered. */
export function defaultGoalForAge(ageYears: number): SetupGoal {
  return ageYears >= ADULT_AGE_YEARS ? "lose" : "maintain";
}

/**
 * The answers with a goal that the age no longer allows (the birth date was edited to under 18 after
 * lose was chosen) reset to the default goal for the age, with its default rate. Any other draft is
 * returned as it is.
 */
export function resetGoalForAge(answers: SetupDraft, ageYears: number): SetupDraft {
  if (answers.goal === undefined || goalsAllowed(ageYears).includes(answers.goal)) {
    return answers;
  }
  return withGoal(answers, defaultGoalForAge(ageYears));
}
