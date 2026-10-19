import { suggestSession, SUGGEST_PARAMS_V1 } from "../../src/training";
import goldenWeek from "../fixtures/training/goldenWeek.json";
import { routine } from "../training/goldenWeekInputs";
import {
  GOLDEN_LIBRARY,
  STRENGTH_GOALS,
  V_TAPER_GOALS,
  WEDNESDAY_STATE,
} from "../training/suggestGolden";

import type {
  SuggestionContext,
  SuggestionDetailContext,
  SuggestionRepRange,
} from "../../src/copy";
import type {
  NothingToSuggest,
  PlanAdjusted,
  PlanRoutineDay,
  SuggestedSession,
  Suggestion,
} from "../../src/training";

/*
 * The inputs of the suggestion copy tests: the suggestions `suggestSession` gives for the golden week on
 * Wednesday 14 October 2026, 12:00 (the cases of Zee's agreed document on KEY-396, Part 4), with the
 * names and rep ranges a screen would read from the library and the routine.
 */

export const WEDNESDAY = "2026-10-14";
export const THURSDAY = "2026-10-15";

const thursdaysLegs: PlanRoutineDay = (() => {
  const day = routine.days.find((each) => each.weekday === 3);
  if (day === undefined) {
    throw new Error("The golden routine has a Thursday");
  }
  return day;
})();

export const exerciseNames = new Map(
  GOLDEN_LIBRARY.map((exercise) => [exercise.id, exercise.name]),
);

export const plannedRepRanges = new Map<string, SuggestionRepRange>(
  (goldenWeek.routine.days.find((day) => day.name === "Legs")?.exercises ?? []).map((exercise) => [
    exercise.id,
    { repMin: exercise.targetRepsMin, repMax: exercise.targetRepsMax },
  ]),
);

export const vTaperGoals: SuggestionContext["goals"] = {
  goal: "aesthetic",
  focus: ["v_taper"],
  limit_minutes: 60,
};

export const strengthGoals: SuggestionContext["goals"] = {
  goal: "strength",
  focus: [],
  limit_minutes: 60,
};

/** Wednesday's suggestion for Thursday's Legs. */
export const forThursday: SuggestionContext = {
  localDate: THURSDAY,
  todayLocalDate: WEDNESDAY,
  routineDayName: "Legs",
  exerciseNames,
  goals: vTaperGoals,
};

/** The same suggestion for a day that is today. */
export const forToday: SuggestionContext = { ...forThursday, localDate: WEDNESDAY };

/** A fresh session for today: the day has no routine day. */
export const forFreshToday: SuggestionContext = { ...forToday, routineDayName: null };

export const detailForThursday: SuggestionDetailContext = { ...forThursday, plannedRepRanges };

export const detailForFreshToday: SuggestionDetailContext = {
  ...forFreshToday,
  plannedRepRanges: new Map(),
};

export const planAdjustedOf = (suggestion: Suggestion): PlanAdjusted => {
  if (suggestion.kind !== "plan_adjusted") {
    throw new Error("Expected a plan adjusted");
  }
  return suggestion;
};

export const sessionOf = (suggestion: Suggestion): SuggestedSession => {
  if (suggestion.kind !== "session") {
    throw new Error("Expected a session");
  }
  return suggestion;
};

export const nothingOf = (suggestion: Suggestion): NothingToSuggest => {
  if (suggestion.kind !== "nothing") {
    throw new Error("Expected nothing");
  }
  return suggestion;
};

export const onLegs = (minutes?: number): Suggestion =>
  suggestSession(
    WEDNESDAY_STATE,
    V_TAPER_GOALS,
    GOLDEN_LIBRARY,
    { plannedDay: thursdaysLegs, ...(minutes === undefined ? {} : { minutes }) },
    SUGGEST_PARAMS_V1,
  );

/** Case (a): 3 sets of incline dumbbell press added to Thursday's Legs, 16 to 19 sets, 60 minutes. */
export const goldenAdd = planAdjustedOf(onLegs());

/** With 75 minutes the side lateral raise is added as well, a second pick: 22 sets, 70 minutes. */
export const twoAdds = planAdjustedOf(onLegs(75));

/** Case (b2): the strength user with no routine for the day, whose first exercise is the deadlift. */
export const strengthSession = sessionOf(
  suggestSession(WEDNESDAY_STATE, STRENGTH_GOALS, GOLDEN_LIBRARY, {}, SUGGEST_PARAMS_V1),
);

/** Case (b1): the strength user with Thursday's Legs kept, whose added deadlift leads with lower back. */
export const strengthOnLegs = planAdjustedOf(
  suggestSession(
    WEDNESDAY_STATE,
    STRENGTH_GOALS,
    GOLDEN_LIBRARY,
    { plannedDay: thursdaysLegs },
    SUGGEST_PARAMS_V1,
  ),
);

/** Case (c): the V-taper user with no routine for the day. */
export const vTaperSession = sessionOf(
  suggestSession(WEDNESDAY_STATE, V_TAPER_GOALS, GOLDEN_LIBRARY, {}, SUGGEST_PARAMS_V1),
);

/** The V-taper user's Wednesday with 45 minute sessions: not even the first exercise fits. */
export const noRoomOnLegs = nothingOf(onLegs(45));

/** A band-only user: the library holds nothing for the muscles with a gap. */
export const bandsOnly = nothingOf(
  suggestSession(
    WEDNESDAY_STATE,
    V_TAPER_GOALS,
    GOLDEN_LIBRARY,
    { equipment: ["band"] },
    SUGGEST_PARAMS_V1,
  ),
);

export const prioritiesCovered: NothingToSuggest = {
  kind: "nothing",
  why: "priorities_covered",
  skipped: [],
  no_room: null,
};

export const allHot: NothingToSuggest = {
  kind: "nothing",
  why: "all_hot",
  skipped: [
    { muscle_id: "lats", heat: 0.63 },
    { muscle_id: "biceps", heat: 0.51 },
  ],
  no_room: null,
};
