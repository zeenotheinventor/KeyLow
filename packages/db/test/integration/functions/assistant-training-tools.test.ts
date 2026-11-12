import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { searchExercises } from "../../../../api-client/src/repos/exercises";
import { saveExercise } from "../../../../api-client/src/repos/exerciseWrites";
import { getRoutine, listRoutines } from "../../../../api-client/src/repos/routines";
import { saveRoutine } from "../../../../api-client/src/repos/routineWrites";
import {
  getCurrentTrainingGoals,
  saveTrainingGoals,
} from "../../../../api-client/src/repos/trainingGoals";
import { strengthAnswers, vTaperAnswers } from "../../../../api-client/test/support/trainingGoals";
import { createTestUser, deleteCreatedTestUsers } from "../support/users";

import type { TestUser } from "../support/users";

/*
 * The reads behind the assistant's training tools (`search_exercises`, `get_routines` and
 * `get_training_goals`) against the real tables, with two users. HTTP-free, like the diary tools' file:
 * each read runs with the user's own signed-in client, which is the client the `mcp` function hands a
 * tool as its caller, so row level security scopes it. It proves that what one user made never reaches
 * the tools of the other (ADR 0006, Amendment 1). The tools' own tests run under Deno with a stub client
 * and assert the words and the fields.
 *
 * Both users make a custom exercise and a routine with the same names, so a read that was not scoped to
 * its user would show the other's too.
 */

const customExerciseName = "key890-cable press";
const routineName = "key890-push";

type Person = { user: TestUser; exerciseId: string; routineId: string };

let alice: Person;
let bob: Person;

async function createPerson(label: string): Promise<Person> {
  const user = await createTestUser(`key890-${label}`);
  const exercise = await saveExercise(user.client, {
    draft: {
      name: customExerciseName,
      equipment: "cable",
      muscles: [{ muscle_id: "chest_upper", role: "primary" }],
    },
  });
  const routine = await saveRoutine(user.client, {
    id: null,
    draft: {
      name: routineName,
      days: [
        {
          id: null,
          name: "Push",
          weekday: 0,
          exercises: [
            {
              exercise_id: exercise.id,
              target_sets: 3,
              rep_min: 8,
              rep_max: 12,
              target_rir: 2,
            },
          ],
        },
      ],
    },
  });
  return { user, exerciseId: exercise.id, routineId: routine.id };
}

beforeAll(async () => {
  [alice, bob] = await Promise.all([createPerson("alice"), createPerson("bob")]);
});

afterAll(async () => {
  await deleteCreatedTestUsers();
});

describe("search_exercises", () => {
  it("finds the caller's own custom exercise, and never the other user's", async () => {
    const aliceHits = await searchExercises(alice.user.client, customExerciseName, {
      equipment: ["cable"],
    });
    const bobHits = await searchExercises(bob.user.client, customExerciseName, {
      equipment: ["cable"],
    });

    expect(aliceHits.map(({ id }) => id)).toEqual([alice.exerciseId]);
    expect(bobHits.map(({ id }) => id)).toEqual([bob.exerciseId]);
  });

  it("leaves out an exercise whose equipment is not on the list", async () => {
    const hits = await searchExercises(alice.user.client, customExerciseName, {
      equipment: ["barbell"],
    });

    expect(hits).toEqual([]);
  });
});

describe("get_routines", () => {
  it("lists the caller's own routines, and never the other user's", async () => {
    const aliceRoutines = await listRoutines(alice.user.client, { archived: false });
    const bobRoutines = await listRoutines(bob.user.client, { archived: false });

    expect(aliceRoutines.map(({ id }) => id)).toEqual([alice.routineId]);
    expect(bobRoutines.map(({ id }) => id)).toEqual([bob.routineId]);
  });

  it("reads another user's routine id as nothing, the same as an id that does not exist", async () => {
    const missingRoutineId = "00000000-0000-4000-8000-000000000000";

    expect(await getRoutine(alice.user.client, bob.routineId)).toBeNull();
    expect(await getRoutine(alice.user.client, missingRoutineId)).toBeNull();
    expect((await getRoutine(bob.user.client, bob.routineId))?.name).toBe(routineName);
  });
});

describe("get_training_goals", () => {
  it("reads the caller's current goals, and never the other user's", async () => {
    await saveTrainingGoals(alice.user.client, vTaperAnswers);
    await saveTrainingGoals(bob.user.client, strengthAnswers);

    expect((await getCurrentTrainingGoals(alice.user.client))?.goal).toBe(vTaperAnswers.goal);
    expect((await getCurrentTrainingGoals(bob.user.client))?.goal).toBe(strengthAnswers.goal);
  });
});
