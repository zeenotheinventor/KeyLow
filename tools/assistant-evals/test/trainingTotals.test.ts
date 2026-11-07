import { readFileSync } from "node:fs";

import { addCalendarDays } from "@keylow/core/dates";
import { GOAL_PRESETS_V1, MUSCLE_IDS, deriveMusclePriority } from "@keylow/core/training";
import { describe, expect, it } from "vitest";

import {
  CURRENT_GOAL,
  LIBRARY_EXERCISES,
  LIBRARY_EXERCISE_KEYS,
  trainingSessions,
} from "../fixtures/training.ts";
import {
  LIBRARY_EXERCISE_VALUES,
  expectedMuscleState,
  expectedSets,
  expectedSuggestion,
  expectedTrend,
  referenceNow,
} from "../fixtures/trainingTotals.ts";

const MIGRATION = readFileSync(
  new URL(
    "../../../packages/db/supabase/migrations/20261019030000_exercise_library.sql",
    import.meta.url,
  ),
  "utf8",
);

// The line of an exercise in the generated migration: one `import_exercises` call holds one exercise.
function libraryLine(sourceRef: string): string {
  const line = MIGRATION.split("\n").find((candidate) =>
    candidate.includes(`'[{"source_ref":"${sourceRef}",`),
  );
  if (line === undefined) {
    throw new Error(`The exercise library has no row for ${sourceRef}`);
  }
  return line;
}

// Fourteen days in a row cover every weekday twice, so the story cannot depend on the day it is written.
const ANCHORS = Array.from({ length: 14 }, (_, offset) => addCalendarDays("2030-01-01", offset));

describe("the library exercises the history uses", () => {
  it.each(LIBRARY_EXERCISE_KEYS)("should be the row of the exercise library for %s", (exercise) => {
    const sourceRef = LIBRARY_EXERCISES[exercise];
    const { name, equipment, mechanic, muscles } = LIBRARY_EXERCISE_VALUES[exercise];
    const line = libraryLine(sourceRef);

    expect(line).toContain(
      `{"source_ref":"${sourceRef}","name":"${name}","equipment":"${equipment}","mechanic":"${mechanic}","muscles":[`,
    );
    // A set freezes the whole map, so the entries must be these and no others, in any order.
    expect(line.split('"muscle_id":').length - 1).toBe(muscles.length);
    for (const entry of muscles) {
      expect(line).toContain(JSON.stringify(entry));
    }
  });
});

describe("the sets the history adds up from", () => {
  it("should be every planned set once, with a snapshot of its exercise", () => {
    const planned = trainingSessions().flatMap(({ exercises }) =>
      exercises.flatMap(({ sets }) => sets),
    );

    const sets = expectedSets("2030-06-15");

    expect(sets).toHaveLength(planned.length);
    expect(sets.every(({ snapshot }) => snapshot.muscles.length > 0)).toBe(true);
  });

  it("should date the sets from the anchor and nothing else", () => {
    const first = expectedSets("2030-06-15").map(({ local_date }) => local_date);
    const later = expectedSets("2030-06-22").map(({ local_date }) =>
      addCalendarDays(local_date, -7),
    );

    expect(later).toEqual(first);
  });
});

describe.each(ANCHORS)("the story, written on %s", (anchorDate) => {
  const now = referenceNow(anchorDate);

  it("should show a bench press with no gain in its last three trained weeks", () => {
    const trained = expectedTrend(anchorDate, "benchPress", { range: "3m", now }).weeks.filter(
      ({ value }) => value !== null,
    );

    expect(trained.slice(-3).map(({ change }) => change?.kind)).toEqual(["same", "same", "same"]);
    expect(trained.slice(-4, -3).map(({ change }) => change?.kind)).toEqual(["load"]);
  });

  it("should show a squat that gained in every trained week after the first", () => {
    const trained = expectedTrend(anchorDate, "squat", { range: "3m", now }).weeks.filter(
      ({ value }) => value !== null,
    );

    expect(trained).toHaveLength(6);
    expect(trained.slice(1).map(({ change }) => change?.kind)).toEqual(Array(5).fill("load"));
  });

  it("should keep the warm-ups out of the best set of a week", () => {
    const { latest } = expectedTrend(anchorDate, "squat", { range: "4w", now });

    expect(latest?.value).toEqual({ loadKg: 112.5, reps: 5 });
  });

  it("should give the quads the highest heat, and a high one", () => {
    const state = expectedMuscleState(anchorDate, now);
    const hottest = MUSCLE_IDS.reduce((best, muscle) =>
      state[muscle].heat > state[best].heat ? muscle : best,
    );

    expect(hottest).toBe("quads");
    expect(state.quads.heat).toBeGreaterThanOrEqual(0.5);
  });

  it("should leave the lats barely trained", () => {
    const state = expectedMuscleState(anchorDate, now);

    expect(state.lats.volumeStatus).toBe("maintaining");
    expect(state.lats.weeklySets).toBeLessThan(state.chest_lower.weeklySets);
  });
});

describe("the reference moment", () => {
  it("should fall the day after yesterday's session, at midday", () => {
    expect(referenceNow("2030-06-15")).toBe("2030-06-15T12:00:00.000Z");
  });
});

describe("the next session suggested to the eval user", () => {
  const anchorDate = "2030-06-15";
  const now = referenceNow(anchorDate);
  const library = LIBRARY_EXERCISE_KEYS.map((key, index) => ({
    id: `11b00000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
    ...LIBRARY_EXERCISE_VALUES[key],
  }));
  const goal = {
    ...CURRENT_GOAL,
    muscle_priority: deriveMusclePriority(CURRENT_GOAL, GOAL_PRESETS_V1),
  };

  it("should be a fresh session when the user has no routine day for it", () => {
    const read = expectedSuggestion(anchorDate, {
      now,
      day: anchorDate,
      goal,
      library,
      activeRoutine: null,
    });

    expect(read.kind).toBe("session");
  });

  it("should leave out the exercises of the hot quads", () => {
    const read = expectedSuggestion(anchorDate, {
      now,
      day: anchorDate,
      goal,
      library,
      activeRoutine: null,
    });

    const quadsExercises = library.filter(({ muscles }) =>
      muscles.some(({ muscle_id, role }) => muscle_id === "quads" && role === "primary"),
    );
    const suggested = read.suggestion?.kind === "session" ? read.suggestion.exercises : [];
    expect(suggested.length).toBeGreaterThan(0);
    expect(
      suggested.filter(({ exercise_id }) => quadsExercises.some(({ id }) => id === exercise_id)),
    ).toEqual([]);
  });

  it("should say there is no goal when the user has not answered the questionnaire", () => {
    const read = expectedSuggestion(anchorDate, {
      now,
      day: anchorDate,
      goal: null,
      library,
      activeRoutine: null,
    });

    expect(read.unavailable).toBe("no_goal");
  });
});
