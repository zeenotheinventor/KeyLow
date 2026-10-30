import { SUGGEST_PARAMS_V2, toAcceptedExercises } from "@keylow/core/training";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { saveExercise, saveRoutine, dayIdsOf } from "./support/training";
import { createTestUser, deleteCreatedTestUsers } from "./support/users";
import {
  acceptSuggestion,
  listAcceptedSuggestions,
  undoAcceptedSuggestion,
} from "../../src/repos/acceptedSuggestions";

import type { SavedExercise } from "./support/training";
import type { TestUser } from "./support/users";
import type { AcceptSuggestion } from "../../src/repos/acceptedSuggestions";
import type { ExerciseMuscleEntry } from "@keylow/core/schemas";
import type { SuggestedSession, SuggestExercise } from "@keylow/core/training";

// The accepted suggestions over the real tables with real user JWTs. Each describe makes its own users,
// named key406, so the reads see exactly what the test wrote. The exercise is the user's own, named
// key406-, and the week is Monday 12 to Sunday 18 October 2026.

const WEEK_START = "2026-10-12";
const THURSDAY = "2026-10-15";
const FRIDAY = "2026-10-16";
const NEXT_MONDAY = "2026-10-19";

const PRESS_MUSCLES: ExerciseMuscleEntry[] = [
  { muscle_id: "chest_upper", role: "primary", weight: 1 },
  { muscle_id: "triceps", role: "secondary", weight: 0.5 },
];

afterAll(async () => {
  // The users' rows go with them (on delete cascade).
  await deleteCreatedTestUsers();
});

const libraryOf = (exercise: SavedExercise): SuggestExercise[] => [
  {
    id: exercise.id,
    name: exercise.name,
    equipment: "barbell",
    mechanic: "compound",
    muscles: PRESS_MUSCLES,
  },
];

/** Three sets of the exercise as a fresh session, the shape of the suggestion the user accepts. */
const suggestionOf = (exercise: SavedExercise): SuggestedSession => ({
  kind: "session",
  exercises: [
    {
      exercise_id: exercise.id,
      sets: 3,
      rep_min: 8,
      rep_max: 10,
      target_rir: 2,
      origin: "added",
      reasons: [
        {
          muscle_id: "chest_upper",
          priority: 3,
          weekly_sets: 1.5,
          logged_sets: 1.5,
          mav_low: 10,
          heat: 0.25,
          score: 18.79,
        },
      ],
    },
  ],
  sets: 3,
  minutes: 15,
  skipped: [],
  no_room: null,
});

const acceptInput = (
  exercise: SavedExercise,
  localDate: string,
  routineDayId: string | null = null,
): AcceptSuggestion => ({
  suggestion: suggestionOf(exercise),
  library: libraryOf(exercise),
  localDate,
  routineDayId,
});

// The service role has no grant on the table, so the rows are read as their owner, who sees the soft
// deleted ones too.
const rowsOf = async (user: TestUser) => {
  const { data, error } = await user.client
    .from("accepted_suggestions")
    .select("id,local_date,routine_day_id,exercises,reasons,params_version,deleted_at")
    .order("created_at");
  if (error) {
    throw new Error(`Could not read the test rows (${error.code})`);
  }
  return data;
};

describe("acceptSuggestion and listAcceptedSuggestions", () => {
  let owner: TestUser;
  let stranger: TestUser;
  let press: SavedExercise;
  let strangerPress: SavedExercise;
  let ownerDayId: string;

  beforeAll(async () => {
    [owner, stranger] = await Promise.all([createTestUser("key406"), createTestUser("key406")]);
    press = await saveExercise(owner, "press", PRESS_MUSCLES);
    strangerPress = await saveExercise(stranger, "press", PRESS_MUSCLES);
    const routineId = await saveRoutine(owner, null, [
      { weekday: 3, name: "key406-legs", exerciseIds: [press.id], targetSets: 3 },
    ]);
    const [dayId] = await dayIdsOf(owner, routineId);
    if (dayId === undefined) {
      throw new Error("The test routine has a day");
    }
    ownerDayId = dayId;
  });

  it("should store the added exercises, the reasons and the params version for the day, and read them back", async () => {
    const stored = await acceptSuggestion(owner.client, acceptInput(press, THURSDAY, ownerDayId));

    expect(stored).toMatchObject({
      local_date: THURSDAY,
      routine_day_id: ownerDayId,
      params_version: SUGGEST_PARAMS_V2.version,
    });
    const [row] = (await rowsOf(owner)).filter(({ id }) => id === stored.id);
    expect(row?.exercises).toEqual(
      JSON.parse(JSON.stringify(toAcceptedExercises(suggestionOf(press), libraryOf(press)))),
    );
    expect(row?.reasons).toMatchObject({
      picks: [{ exercise_id: press.id, reasons: [{ muscle_id: "chest_upper", priority: 3 }] }],
    });
    const read = await listAcceptedSuggestions(owner.client, WEEK_START);
    expect(read.skipped).toEqual([]);
    expect(read.suggestions.map(({ id }) => id)).toEqual([stored.id]);
    expect(read.suggestions[0]?.exercises[0]).toMatchObject({
      exercise_id: press.id,
      target_sets: 3,
      target_rir: 2,
    });
  });

  it("should replace the day's suggestion when it is accepted a second time, leaving one live row", async () => {
    const first = (await listAcceptedSuggestions(owner.client, WEEK_START)).suggestions[0];

    const second = await acceptSuggestion(owner.client, acceptInput(press, THURSDAY, ownerDayId));

    const rows = (await rowsOf(owner)).filter(({ local_date }) => local_date === THURSDAY);
    expect(rows).toHaveLength(2);
    expect(rows.filter(({ deleted_at }) => deleted_at === null).map(({ id }) => id)).toEqual([
      second.id,
    ]);
    expect(rows.find(({ id }) => id === first?.id)?.deleted_at).not.toBeNull();
    expect(
      (await listAcceptedSuggestions(owner.client, WEEK_START)).suggestions.map(({ id }) => id),
    ).toEqual([second.id]);
  });

  it("should keep a suggestion of another day of the week when a day is accepted again", async () => {
    const friday = await acceptSuggestion(owner.client, acceptInput(press, FRIDAY));

    await acceptSuggestion(owner.client, acceptInput(press, THURSDAY, ownerDayId));

    const days = (await listAcceptedSuggestions(owner.client, WEEK_START)).suggestions.map(
      ({ local_date }) => local_date,
    );
    expect(days).toEqual([THURSDAY, FRIDAY]);
    await undoAcceptedSuggestion(owner.client, friday.id);
  });

  it("should leave a suggestion of the next week out of this week's read", async () => {
    const next = await acceptSuggestion(owner.client, acceptInput(press, NEXT_MONDAY));

    const thisWeek = await listAcceptedSuggestions(owner.client, WEEK_START);
    const nextWeek = await listAcceptedSuggestions(owner.client, NEXT_MONDAY);

    expect(thisWeek.suggestions.map(({ id }) => id)).not.toContain(next.id);
    expect(nextWeek.suggestions.map(({ id }) => id)).toEqual([next.id]);
  });

  it("should never show another user's suggestions", async () => {
    expect(await listAcceptedSuggestions(stranger.client, WEEK_START)).toEqual({
      suggestions: [],
      skipped: [],
    });
  });

  it("should refuse a routine day that is another user's, with the code of the policy and nothing of the suggestion", async () => {
    const strangerOwn = await acceptSuggestion(
      stranger.client,
      acceptInput(strangerPress, THURSDAY),
    );

    const error = await acceptSuggestion(
      stranger.client,
      acceptInput(strangerPress, THURSDAY, ownerDayId),
    ).then(
      () => null,
      (caught: unknown) => (caught instanceof Error ? caught : new Error("(not an Error)")),
    );

    expect(error?.message).toBe("Could not accept the suggestion (42501)");
    expect(JSON.stringify({ message: error?.message, cause: error?.cause })).not.toContain(
      strangerPress.name,
    );
    // The refused accept leaves the day as it was: the earlier suggestion is live again.
    const live = (await listAcceptedSuggestions(stranger.client, WEEK_START)).suggestions;
    expect(live.map(({ id }) => id)).toEqual([strangerOwn.id]);
  });

  it("should settle two accepts made at once for a day: one live row is left", async () => {
    const racer = await createTestUser("key406");
    const racerPress = await saveExercise(racer, "press", PRESS_MUSCLES);

    const outcomes = await Promise.allSettled([
      acceptSuggestion(racer.client, acceptInput(racerPress, THURSDAY)),
      acceptSuggestion(racer.client, acceptInput(racerPress, THURSDAY)),
    ]);

    expect(outcomes.some(({ status }) => status === "fulfilled")).toBe(true);
    const live = (await rowsOf(racer)).filter(({ deleted_at }) => deleted_at === null);
    expect(live).toHaveLength(1);
  });
});

describe("undoAcceptedSuggestion", () => {
  let owner: TestUser;
  let stranger: TestUser;
  let press: SavedExercise;

  beforeAll(async () => {
    [owner, stranger] = await Promise.all([createTestUser("key406"), createTestUser("key406")]);
    press = await saveExercise(owner, "press", PRESS_MUSCLES);
  });

  it("should soft delete the row, which leaves the read but stays in the table", async () => {
    const stored = await acceptSuggestion(owner.client, acceptInput(press, THURSDAY));

    await undoAcceptedSuggestion(owner.client, stored.id);

    expect((await listAcceptedSuggestions(owner.client, WEEK_START)).suggestions).toEqual([]);
    const row = (await rowsOf(owner)).find(({ id }) => id === stored.id);
    expect(row?.deleted_at).not.toBeNull();
  });

  it("should change nothing for a row that is already undone", async () => {
    const [undone] = await rowsOf(owner);

    await undoAcceptedSuggestion(owner.client, String(undone?.id));

    const [after] = await rowsOf(owner);
    expect(after?.deleted_at).toBe(undone?.deleted_at);
  });

  it("should not undo another user's row: it fails with PGRST116 and the row stays live", async () => {
    const stored = await acceptSuggestion(owner.client, acceptInput(press, FRIDAY));

    await expect(undoAcceptedSuggestion(stranger.client, stored.id)).rejects.toThrow(
      "Could not undo adding the suggestion (PGRST116)",
    );

    expect((await listAcceptedSuggestions(owner.client, WEEK_START)).suggestions).toHaveLength(1);
  });

  it("should allow the day to be accepted again after an Undo", async () => {
    const stored = (await listAcceptedSuggestions(owner.client, WEEK_START)).suggestions[0];
    await undoAcceptedSuggestion(owner.client, String(stored?.id));

    const again = await acceptSuggestion(owner.client, acceptInput(press, FRIDAY));

    expect(
      (await listAcceptedSuggestions(owner.client, WEEK_START)).suggestions.map(({ id }) => id),
    ).toEqual([again.id]);
  });
});
