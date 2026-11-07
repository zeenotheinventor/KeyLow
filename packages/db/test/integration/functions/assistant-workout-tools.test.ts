import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { saveExercise } from "../../../../api-client/src/repos/exerciseWrites";
import { finishSession, startSession } from "../../../../api-client/src/repos/sessionWrites";
import { addSet } from "../../../../api-client/src/repos/setWrites";
import { getMyWeightUnit } from "../../../../api-client/src/repos/targets";
import { listSessionsInWeek } from "../../../../api-client/src/repos/trainingHistory";
import { getSession } from "../../../../api-client/src/repos/trainingSessions";
import { createTestUser, deleteCreatedTestUsers } from "../support/users";

import type { TestUser } from "../support/users";

/*
 * The reads behind the assistant's `get_workouts` tool against the real tables, with two users. HTTP-free,
 * like the other tool files here: each read runs with the user's own signed-in client, which is the client
 * the `mcp` function hands a tool as its caller, so row level security scopes it. It proves that what one
 * user logged never reaches the tool of the other, and that another user's session id reads exactly like
 * one that does not exist (ADR 0006, Amendment 1). The tool's own tests run under Deno with a stub client
 * and assert the words and the fields.
 *
 * Both users log a session on the same day with an exercise of the same name, so a read that was not
 * scoped to its user would show the other's too. Each user's reps are different.
 */

const weekStart = "2026-10-12";
const startedAt = new Date("2026-10-12T18:00:00Z");
const endedAt = new Date("2026-10-12T18:50:00Z");
const exerciseName = "key891-cable press";

type Person = { user: TestUser; sessionId: string; reps: number };

let alice: Person;
let bob: Person;

async function createPerson(label: string, reps: number): Promise<Person> {
  const user = await createTestUser(`key891-${label}`);
  const exercise = await saveExercise(user.client, {
    draft: {
      name: exerciseName,
      equipment: "cable",
      muscles: [{ muscle_id: "chest_upper", role: "primary" }],
    },
  });
  const session = await startSession(user.client, { now: startedAt, tz: "UTC" });
  await addSet(user.client, {
    sessionId: session.id,
    exerciseId: exercise.id,
    draft: { setType: "working", load: "50", reps: String(reps), rir: "2", rpe: "" },
    unit: "kg",
    effortMode: "rir",
    now: startedAt,
  });
  await finishSession(user.client, session.id, { endedAt, note: `${label} note` });
  return { user, sessionId: session.id, reps };
}

beforeAll(async () => {
  [alice, bob] = await Promise.all([createPerson("alice", 8), createPerson("bob", 12)]);
});

afterAll(async () => {
  await deleteCreatedTestUsers();
});

describe("get_workouts", () => {
  it("lists the caller's sessions of a week, and never the other user's", async () => {
    const aliceWeek = await listSessionsInWeek(alice.user.client, weekStart);
    const bobWeek = await listSessionsInWeek(bob.user.client, weekStart);

    expect(aliceWeek.map(({ id }) => id)).toEqual([alice.sessionId]);
    expect(bobWeek.map(({ id }) => id)).toEqual([bob.sessionId]);
  });

  it("reads the caller's own session with its sets", async () => {
    const aliceSession = await getSession(alice.user.client, alice.sessionId);
    const bobSession = await getSession(bob.user.client, bob.sessionId);

    expect(aliceSession?.sets.map(({ reps }) => reps)).toEqual([alice.reps]);
    expect(aliceSession?.note).toBe("alice note");
    expect(bobSession?.sets.map(({ reps }) => reps)).toEqual([bob.reps]);
  });

  it("reads another user's session id as one that does not exist", async () => {
    expect(await getSession(alice.user.client, bob.sessionId)).toBeNull();
    expect(await getSession(bob.user.client, alice.sessionId)).toBeNull();
    expect(await getSession(alice.user.client, crypto.randomUUID())).toBeNull();
  });

  it("reads the caller's own weight unit", async () => {
    expect(await getMyWeightUnit(alice.user.client)).toBe("kg");
  });
});
