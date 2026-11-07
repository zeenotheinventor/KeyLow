import { currentMuscleState } from "./currentMuscleState";
import { plannedDayOf } from "./plannedDayOf";
import { planRoutineOf } from "./planRoutineOf";
import { SUGGEST_PARAMS_V2 } from "./suggestParams";
import { suggestSession } from "./suggestSession";
import { isCalendarDay } from "../../dates/calendarDay";

import type { StoredPlanRoutine } from "./planRoutineOf";
import type { SuggestConstraints, SuggestExercise, SuggestGoals, Suggestion } from "./suggestTypes";
import type { HeatSet } from "../muscleState";

/** Why there is no suggestion to show: the user has not answered the questionnaire, or the library has not been read. */
export type SuggestionUnavailableReason = "no_goal" | "no_library";

/**
 * What `nextSessionSuggestion` gives. `kind` is the suggestion's (`session`, `plan_adjusted` or `nothing`),
 * and `unavailable` says why there is none, so a screen can show the right state: `no_goal` offers the
 * questionnaire, `no_library` shows no card.
 */
export type SuggestionRead =
  | { kind: Suggestion["kind"]; suggestion: Suggestion; unavailable: null }
  | { kind: null; suggestion: null; unavailable: SuggestionUnavailableReason };

export type NextSessionSuggestionInput = {
  /** The live sets of the heat window, as `listSetsFrom` reads them. */
  sets: readonly HeatSet[];
  /** The moment to work the suggestion out at, an ISO timestamp with a zone. */
  now: string;
  /** The current training goal, or null when the user has not answered the questionnaire. */
  goal: SuggestGoals | null;
  /** The exercises to choose from, or null when they have not been read. */
  library: readonly SuggestExercise[] | null;
  /** The active routine, or null when there is none. */
  activeRoutine: StoredPlanRoutine | null;
  /** The user's IANA time zone, which the day the routine was made active is read in. */
  timeZone: string;
  /** The local calendar day the suggestion is for, `YYYY-MM-DD` in the user's zone. */
  day: string;
  /** Narrows the goal's equipment and minutes. The planned day is the routine's, never given here. */
  constraints?: Omit<SuggestConstraints, "plannedDay">;
};

const NO_GOAL: SuggestionRead = { kind: null, suggestion: null, unavailable: "no_goal" };
const NO_LIBRARY: SuggestionRead = { kind: null, suggestion: null, unavailable: "no_library" };

/**
 * The next session for the local day `day`, worked out at `now` (core's `suggestSession`): the routine
 * day planned for `day` kept and added to (`plan_adjusted`), a fresh `session` when the routine has none,
 * or `nothing`. With no goal it gives `no_goal` and never guesses priorities, and with no library it gives
 * `no_library`. Pure under the ADR 0002 rule: `now` is given and nothing is read, so the app and the
 * assistant's tools, which read the rows differently, give the same answer from the same rows.
 *
 * A `day` that is not a calendar day is a `RangeError` that does not quote it, checked before the goal.
 */
export function nextSessionSuggestion({
  sets,
  now,
  goal,
  library,
  activeRoutine,
  timeZone,
  day,
  constraints = {},
}: NextSessionSuggestionInput): SuggestionRead {
  if (!isCalendarDay(day)) {
    throw new RangeError("A suggestion day must be a calendar date written YYYY-MM-DD");
  }
  if (goal === null) {
    return NO_GOAL;
  }
  if (library === null) {
    return NO_LIBRARY;
  }
  const plannedDay = plannedDayOf(planRoutineOf(activeRoutine, timeZone), day);
  const suggestion = suggestSession(
    currentMuscleState(sets, now),
    goal,
    library,
    plannedDay === undefined ? constraints : { ...constraints, plannedDay },
    SUGGEST_PARAMS_V2,
  );
  return { kind: suggestion.kind, suggestion, unavailable: null };
}
