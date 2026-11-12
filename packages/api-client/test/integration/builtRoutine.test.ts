import {
  buildRoutineDraft,
  draftOfStoredRoutine,
  GOAL_PRESETS_V1,
  routineFingerprint,
  summariseBuiltRoutine,
  SESSION_TIME_PARAMS_V1,
} from "@keylow/core/training";
import { afterAll, describe, expect, it } from "vitest";

import { createTestUser, deleteCreatedTestUsers } from "./support/users";
import { readExercisesById } from "../../src/repos/exercises";
import { saveExercise } from "../../src/repos/exerciseWrites";
import { getRoutine } from "../../src/repos/routines";
import { saveRoutine } from "../../src/repos/routineWrites";

import type { CustomExerciseDraft } from "@keylow/core/training";

// A routine built from exercise ids alone saves through saveRoutine and reads back with the numbers core
// chose. The user is new for the run and its rows go with it (on delete cascade), so nothing else on the
// shared stack is touched. Every name is key919- plus a random suffix.

afterAll(async () => {
  await deleteCreatedTestUsers();
});

const customExercise = (label: string, muscles: CustomExerciseDraft["muscles"]) => ({
  name: `key919-${label}-${crypto.randomUUID()}`,
  equipment: "barbell" as const,
  muscles,
});

describe("a built routine", () => {
  it("should save through saveRoutine and read back the same sets, reps and target RIR", async () => {
    const owner = await createTestUser("key919");
    const squat = await saveExercise(owner.client, {
      draft: customExercise("squat", [
        { muscle_id: "quads", role: "primary" },
        { muscle_id: "glute_max", role: "primary" },
      ]),
    });
    const curl = await saveExercise(owner.client, {
      draft: customExercise("curl", [{ muscle_id: "biceps", role: "primary" }]),
    });

    const found = await readExercisesById(owner.client, [squat.id, curl.id]);
    const built = buildRoutineDraft(
      {
        name: "key919-built",
        days: [
          { name: "Legs", weekday: 0, exerciseIds: [squat.id, curl.id] },
          { name: "Arms", weekday: null, exerciseIds: [curl.id] },
        ],
      },
      new Map(found.map(({ id, mechanic }) => [id, { mechanic }])),
      { goal: "strength", experience: "advanced" },
      GOAL_PRESETS_V1,
    );
    if (!built.ok) {
      throw new Error("The draft should build");
    }

    const saved = await saveRoutine(owner.client, { id: null, draft: built.draft });

    const stored = draftOfStoredRoutine(saved);
    expect(stored.days.map(({ id }) => typeof id)).toEqual(["string", "string"]);
    expect({ ...stored, days: stored.days.map((day) => ({ ...day, id: null })) }).toStrictEqual(
      built.draft,
    );
    expect(stored.days[0]?.exercises).toStrictEqual([
      { exercise_id: squat.id, target_sets: 4, rep_min: 3, rep_max: 5, target_rir: 2 },
      { exercise_id: curl.id, target_sets: 4, rep_min: 8, rep_max: 12, target_rir: 2 },
    ]);
    expect(summariseBuiltRoutine(built.draft, SESSION_TIME_PARAMS_V1)).toMatchObject({
      dayCount: 2,
      setsPerWeek: 12,
    });
  });

  // The assistant's `create_routine` stores this text beside its card, and its Undo compares it with a later
  // read. A text that differed on read would make Undo always answer changed. `fingerprintOfStoredRoutine`
  // of the functions is exactly this expression over a read routine.
  it("should give a read of the saved routine the fingerprint of the draft it was saved from", async () => {
    const owner = await createTestUser("key920");
    const squat = await saveExercise(owner.client, {
      draft: customExercise("squat", [{ muscle_id: "quads", role: "primary" }]),
    });
    const curl = await saveExercise(owner.client, {
      draft: customExercise("curl", [{ muscle_id: "biceps", role: "primary" }]),
    });
    const found = await readExercisesById(owner.client, [squat.id, curl.id]);
    const built = buildRoutineDraft(
      {
        name: "  key920-fingerprint  ",
        days: [
          { name: "Legs", weekday: 0, exerciseIds: [squat.id, curl.id] },
          { name: "Arms", weekday: 4, exerciseIds: [curl.id] },
          { name: "Any", weekday: null, exerciseIds: [squat.id] },
        ],
      },
      new Map(found.map(({ id, mechanic }) => [id, { mechanic }])),
      { goal: "hybrid", experience: "intermediate" },
      GOAL_PRESETS_V1,
    );
    if (!built.ok) {
      throw new Error("The draft should build");
    }

    const saved = await saveRoutine(owner.client, { id: null, draft: built.draft });
    const read = await getRoutine(owner.client, saved.id);

    expect(read).not.toBeNull();
    expect(routineFingerprint(draftOfStoredRoutine(saved))).toBe(routineFingerprint(built.draft));
    expect(routineFingerprint(draftOfStoredRoutine(read ?? saved))).toBe(
      routineFingerprint(built.draft),
    );
  });
});
