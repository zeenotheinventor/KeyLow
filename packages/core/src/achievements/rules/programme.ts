import { dayNumber } from "../../dates/calendarDay";

import type { Measure } from "./types";

const DAYS_PER_WEEK = 7;

export const setupCompleted: Measure = ({ stats }) => (stats.setupCompletedAt === null ? 0 : 1);

export const checkIns: Measure = ({ stats }) => stats.checkinLocalDates.length;

/** The most check-ins within one programme, from the day it started to the day it ended (or still runs). */
export const checkInsOnOneProgramme: Measure = ({ stats }) =>
  Math.max(
    0,
    ...stats.programmes.map(
      (programme) =>
        stats.checkinLocalDates.filter(
          (date) =>
            date >= programme.startedOn &&
            (programme.endedOn === null || date <= programme.endedOn),
        ).length,
    ),
  );

/** The most whole weeks any one programme has run, a programme still running counted up to today. */
export const programmeWeeks: Measure = ({ stats, today }) =>
  Math.max(
    0,
    ...stats.programmes.map((programme) =>
      Math.floor(
        Math.max(0, dayNumber(programme.endedOn ?? today) - dayNumber(programme.startedOn)) /
          DAYS_PER_WEEK,
      ),
    ),
  );

/** Course Correct: the targets were edited after onboarding finished. */
export const targetsEdited: Measure = ({ stats }) =>
  stats.targetsUpdatedAt !== null &&
  stats.onboardingCompletedAt !== null &&
  Date.parse(stats.targetsUpdatedAt) > Date.parse(stats.onboardingCompletedAt)
    ? 1
    : 0;
