import { SUGGEST_PARAMS_V2, draftOfStoredRoutine, routineFingerprint } from "@keylow/core/training";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { dayIdsOf, saveExercise, saveRoutine as saveRoutineRows } from "./support/training";
import { createTestUser, deleteCreatedTestUsers } from "./support/users";
import { acceptSuggestion, listAcceptedSuggestions } from "../../src/repos/acceptedSuggestions";
import { readExercisesById } from "../../src/repos/exercises";
import { getRoutine } from "../../src/repos/routines";
import { saveRoutine } from "../../src/repos/routineWrites";

import type { SavedExercise } from "./support/training";
import type { TestUser } from "./support/users";
import type { ExerciseMuscleEntry } from "@keylow/core/schemas";
import type { SuggestedSession, SuggestExercise } from "@keylow/core/training";

// What the assistant's `edit_routine` relies on in the database, with real user JWTs (KEY-902). The tool runs
// in Deno and cannot be imported here, so these are the repo calls it makes. Another person's routine and
// private exercise must read as missing, and a routine saved again, as an edit and as an Undo both do, must
// leave an accepted suggestion where it was. Rows are named key902-, and each describe makes its own users.

const WEEK_START = "2026-10-12";
const THURSDAY = "2026-10-15";

const PRESS_MUSCLES: ExerciseMuscleEntry[] = [
  { muscle_id: "chest_upper", role: "primary", weight: 1 },
  { muscle_id: "triceps", role: "secondary", weight: 0.5 },
];

afterAll(async () => {
  // The users' rows go with them (on delete cascade).
  await deleteCreatedTestUsers();
});

describe("a routine and an exercise of another user", () => {
  let owner: TestUser;
  let stranger: TestUser;
  let ownerRoutineId: string;
  let strangerExercise: SavedExercise;

  beforeAll(async () => {
    [owner, stranger] = await Promise.all([createTestUser("key902"), createTestUser("key902")]);
    strangerExercise = await saveExercise(stranger, "private", PRESS_MUSCLES);
    const ownerExercise = await saveExercise(owner, "press", PRESS_MUSCLES);
    ownerRoutineId = await saveRoutineRows(owner, null, [
      { weekday: 0, name: "key902-push", exerciseIds: [ownerExercise.id] },
    ]);
  });

  it("should read the owner's routine for the owner and as missing for the stranger", async () => {
    expect((await getRoutine(owner.client, ownerRoutineId))?.id).toBe(ownerRoutineId);
    expect(await getRoutine(stranger.client, ownerRoutineId)).toBeNull();
  });

  it("should leave another user's private exercise out of the read that checks an exercise exists", async () => {
    expect((await readExercisesById(stranger.client, [strangerExercise.id])).length).toBe(1);
    expect(await readExercisesById(owner.client, [strangerExercise.id])).toEqual([]);
  });
});

describe("an accepted suggestion and a routine saved again", () => {
  let owner: TestUser;
  let press: SavedExercise;
  let curl: SavedExercise;
  let routineId: string;
  let dayId: string;

  const suggestion = (): SuggestedSession => ({
    kind: "session",
    exercises: [
      {
        exercise_id: press.id,
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

  const library = (): SuggestExercise[] => [
    {
      id: press.id,
      name: press.name,
      equipment: "barbell",
      mechanic: "compound",
      muscles: PRESS_MUSCLES,
    },
  ];

  beforeAll(async () => {
    owner = await createTestUser("key902");
    [press, curl] = await Promise.all([
      saveExercise(owner, "press", PRESS_MUSCLES),
      saveExercise(owner, "curl", PRESS_MUSCLES),
    ]);
    routineId = await saveRoutineRows(owner, null, [
      { weekday: 3, name: "key902-legs", exerciseIds: [press.id] },
    ]);
    const [first] = await dayIdsOf(owner, routineId);
    if (first === undefined) {
      throw new Error("The test routine has a day");
    }
    dayId = first;
  });

  it("should keep the accepted suggestion, with its day, when the routine is edited and then put back", async () => {
    await acceptSuggestion(owner.client, {
      suggestion: suggestion(),
      library: library(),
      localDate: THURSDAY,
      routineDayId: dayId,
    });
    const before = await getRoutine(owner.client, routineId);
    const draft = {
      name: before?.name ?? "",
      days: (before?.days ?? []).map((day) => ({
        id: day.id,
        weekday: day.weekday,
        name: day.name,
        exercises: day.exercises.map((planned) => ({
          exercise_id: planned.exercise_id,
          target_sets: planned.target_sets,
          rep_min: planned.rep_min,
          rep_max: planned.rep_max,
          target_rir: planned.target_rir,
        })),
      })),
    };
    const edited = {
      ...draft,
      days: draft.days.map((day) => ({
        ...day,
        exercises: [
          ...day.exercises,
          { exercise_id: curl.id, target_sets: 3, rep_min: 10, rep_max: 12, target_rir: 1 },
        ],
      })),
    };

    await saveRoutine(owner.client, { id: routineId, draft: edited });
    const afterEdit = await getRoutine(owner.client, routineId);
    await saveRoutine(owner.client, { id: routineId, draft });
    const afterUndo = await getRoutine(owner.client, routineId);

    // Every save replaces the day's planned rows, so their ids change, and the days keep theirs.
    const plannedIds = (routine: typeof before) =>
      (routine?.days ?? []).flatMap((day) => day.exercises.map(({ id }) => id));
    expect(plannedIds(afterUndo).some((id) => plannedIds(before).includes(id))).toBe(false);
    expect(afterEdit?.days.map(({ id }) => id)).toEqual([dayId]);
    expect(afterUndo?.days.map(({ id }) => id)).toEqual([dayId]);
    const read = await listAcceptedSuggestions(owner.client, WEEK_START);
    expect(read.skipped).toEqual([]);
    expect(read.suggestions).toHaveLength(1);
    expect(read.suggestions[0]).toMatchObject({
      local_date: THURSDAY,
      routine_day_id: dayId,
      params_version: SUGGEST_PARAMS_V2.version,
    });
    expect(read.suggestions[0]?.exercises[0]?.exercise_id).toBe(press.id);
  });

  it("should give the fingerprint of the draft the tool saved the same text as the fingerprint of the routine read back", async () => {
    // What Undo depends on: `edit_routine` stores the fingerprint of the draft it saved, without reading the
    // routine back, and Undo compares it to the fingerprint of the routine it reads later.
    const stored = await getRoutine(owner.client, routineId);
    const saved = {
      name: stored?.name ?? "",
      days: (stored?.days ?? []).map((day) => ({
        id: day.id,
        weekday: day.weekday,
        name: day.name,
        exercises: [
          ...day.exercises.map((planned) => ({
            exercise_id: planned.exercise_id,
            target_sets: planned.target_sets,
            rep_min: planned.rep_min,
            rep_max: planned.rep_max,
            target_rir: planned.target_rir,
          })),
          { exercise_id: curl.id, target_sets: 4, rep_min: 6, rep_max: 10, target_rir: null },
        ],
      })),
    };

    await saveRoutine(owner.client, { id: routineId, draft: saved });

    const readBack = await getRoutine(owner.client, routineId);
    expect(readBack).not.toBeNull();
    expect(routineFingerprint(saved)).toBe(
      routineFingerprint(draftOfStoredRoutine(readBack ?? { name: "", days: [] })),
    );
  });
});
