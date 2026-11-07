import { describe, expect, it } from "vitest";

import { loggedSets, routine, GOLDEN_TIME_ZONE } from "./goldenWeekInputs";
import { heatSet, repeat, MORNING, at } from "./heatSets";
import {
  GOLDEN_LIBRARY,
  V_TAPER_GOALS,
  WEDNESDAY_NOON,
  WEDNESDAY_STATE,
  idOf,
} from "./suggestGolden";
import {
  SUGGEST_PARAMS_V2,
  currentMuscleState,
  nextSessionSuggestion,
  suggestSession,
} from "../../src/training";

import type { NextSessionSuggestionInput } from "../../src/training";

/*
 * `nextSessionSuggestion` is the calculation `useSuggestion` and the assistant's tools share: rows in, the
 * answer out. The rows are the golden week's (KEY-353) and the inputs the golden suggestions of KEY-396
 * are worked from, so what is agreed there is pinned here from rows, with nothing set aside as state.
 */

// 14 October 2026 is a Wednesday and the golden routine has no Wednesday, 15 October is the Thursday it
// plans Legs on.
const WEDNESDAY = "2026-10-14";
const THURSDAY = "2026-10-15";
const THURSDAY_WEEKDAY = 3;

const goldenInput: NextSessionSuggestionInput = {
  sets: loggedSets,
  now: WEDNESDAY_NOON,
  goal: V_TAPER_GOALS,
  library: GOLDEN_LIBRARY,
  activeRoutine: routine,
  timeZone: GOLDEN_TIME_ZONE,
  day: THURSDAY,
};

const withInput = (overrides: Partial<NextSessionSuggestionInput>): NextSessionSuggestionInput => ({
  ...goldenInput,
  ...overrides,
});

describe("nextSessionSuggestion", () => {
  describe("a session", () => {
    it("should suggest a fresh session on a day the routine has nothing planned for", () => {
      const read = nextSessionSuggestion(withInput({ day: WEDNESDAY }));

      expect(read.unavailable).toBeNull();
      expect(read.kind).toBe("session");
      expect(read.suggestion).toStrictEqual(
        suggestSession(WEDNESDAY_STATE, V_TAPER_GOALS, GOLDEN_LIBRARY, {}, SUGGEST_PARAMS_V2),
      );
    });

    it("should suggest a fresh session when the user has no routine", () => {
      const read = nextSessionSuggestion(withInput({ activeRoutine: null }));

      expect(read.kind).toBe("session");
    });
  });

  describe("a planned day", () => {
    it("should keep Thursday's Legs and add 3 sets of incline dumbbell press, the agreed answer", () => {
      const read = nextSessionSuggestion(goldenInput);

      if (read.suggestion?.kind !== "plan_adjusted") {
        throw new Error("Expected the planned day kept and added to");
      }
      expect(read.kind).toBe("plan_adjusted");
      expect(read.suggestion.exercises).toHaveLength(6);
      expect(read.suggestion.added).toBe(1);
      expect(read.suggestion.exercises[5]).toMatchObject({
        exercise_id: idOf("Incline Dumbbell Press"),
        sets: 3,
        origin: "added",
      });
    });

    it("should give what suggestSession gives for the day planned and the state of the rows", () => {
      const legs = routine.days.find((each) => each.weekday === THURSDAY_WEEKDAY);
      if (legs === undefined) {
        throw new Error("The golden routine has a Thursday");
      }

      const read = nextSessionSuggestion(goldenInput);

      expect(read.suggestion).toStrictEqual(
        suggestSession(
          WEDNESDAY_STATE,
          V_TAPER_GOALS,
          GOLDEN_LIBRARY,
          { plannedDay: legs },
          SUGGEST_PARAMS_V2,
        ),
      );
    });

    it("should plan from the day the routine was made active, in the user's zone", () => {
      // 23:30 UTC on Thursday is already Friday in London (BST), so the plan starts on the Friday.
      const activeRoutine = { ...routine, activatedAt: "2026-10-15T23:30:00Z" };

      expect(nextSessionSuggestion(withInput({ activeRoutine, timeZone: "UTC" })).kind).toBe(
        "plan_adjusted",
      );
      expect(
        nextSessionSuggestion(withInput({ activeRoutine, timeZone: "Europe/London" })).kind,
      ).toBe("session");
    });

    it("should plan the whole week for a routine with no recorded activation", () => {
      const activeRoutine = { ...routine, activatedAt: null };

      expect(nextSessionSuggestion(withInput({ activeRoutine })).kind).toBe("plan_adjusted");
    });
  });

  describe("when there is nothing to show", () => {
    it("should say there is no goal, and never guess priorities", () => {
      expect(nextSessionSuggestion(withInput({ goal: null }))).toStrictEqual({
        kind: null,
        suggestion: null,
        unavailable: "no_goal",
      });
    });

    it("should say the library is not there when it has not been read", () => {
      expect(nextSessionSuggestion(withInput({ library: null }))).toStrictEqual({
        kind: null,
        suggestion: null,
        unavailable: "no_library",
      });
    });

    it("should say there is no goal before it says the library is missing", () => {
      expect(nextSessionSuggestion(withInput({ goal: null, library: null })).unavailable).toBe(
        "no_goal",
      );
    });

    it.each(["2026-13-01", "Thursday", ""])(
      "should throw a RangeError that does not quote the day %j, even with no goal",
      (day) => {
        expect(() => nextSessionSuggestion(withInput({ day, goal: null }))).toThrow(
          new RangeError("A suggestion day must be a calendar date written YYYY-MM-DD"),
        );
      },
    );
  });

  describe("each reason for nothing", () => {
    const chestOnly = { ...V_TAPER_GOALS, muscle_priority: { chest_upper: 3 } };

    const nothingFor = (overrides: Partial<NextSessionSuggestionInput>) => {
      const read = nextSessionSuggestion(withInput({ activeRoutine: null, ...overrides }));
      if (read.suggestion?.kind !== "nothing") {
        throw new Error("Expected nothing to suggest");
      }
      return read.suggestion;
    };

    it("should say the priorities are covered when the goal ranks no muscle", () => {
      const suggestion = nothingFor({ goal: { ...V_TAPER_GOALS, muscle_priority: {} } });

      expect(suggestion.why).toBe("priorities_covered");
    });

    it("should say every muscle with a gap is hot, from the sets just logged", () => {
      // 8 sets of upper chest an hour ago: a gap of 2 sets left and a muscle that has not recovered.
      const justTrained = repeat(
        8,
        heatSet([{ muscle_id: "chest_upper", role: "primary", weight: 1 }]),
      );

      const suggestion = nothingFor({
        sets: justTrained,
        now: at(MORNING + 3_600_000),
        goal: chestOnly,
      });

      expect(suggestion.why).toBe("all_hot");
      expect(suggestion.skipped.map((each) => each.muscle_id)).toStrictEqual(["chest_upper"]);
    });

    it("should say there is no exercise when the constraints and the goal share no equipment", () => {
      const suggestion = nothingFor({
        goal: { ...chestOnly, equipment: ["dumbbell"] },
        constraints: { equipment: ["cable"] },
      });

      expect(suggestion.why).toBe("no_exercise");
    });

    it("should say there is no room when not even the first exercise fits the minutes", () => {
      // Nothing logged: upper chest leads, and its exercise reads 10 minutes against 5.
      const suggestion = nothingFor({ sets: [], goal: chestOnly, constraints: { minutes: 5 } });

      expect(suggestion).toMatchObject({
        why: "no_room",
        no_room: { muscle_id: "chest_upper", minutes_if_added: 10 },
      });
    });
  });
});

describe("currentMuscleState", () => {
  it("should give each muscle's heat and weekly sets from the sets, under the current training parameters", () => {
    expect(currentMuscleState(loggedSets, WEDNESDAY_NOON)).toStrictEqual(WEDNESDAY_STATE);
  });
});
