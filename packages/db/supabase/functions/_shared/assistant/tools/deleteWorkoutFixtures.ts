// The workouts and the database the `delete_workout` tests share: a Legs workout of Thursday 8 October with
// warm-ups, working sets and a set the person removed on its own, a workout with no routine day, one of warm-ups
// only, another person's, and optionally one in progress. Nothing in production imports this.
import { otherUserId, userId } from "../testing.ts";
import { exerciseId, sessionRow, setRow } from "./trainingFixtures.ts";
import { writeStub } from "./writeStub.ts";

import type { RpcHandler, WriteStub } from "./writeStub.ts";

const squat = { id: exerciseId(7), name: "Barbell squat", equipment: "barbell" };

export const thursdayId = "00000000-0000-4000-8000-0000000b0001";
export const liveId = "00000000-0000-4000-8000-0000000b0002";
export const freeId = "00000000-0000-4000-8000-0000000b0003";
export const warmUpsOnlyId = "00000000-0000-4000-8000-0000000b0004";
export const theirsId = "00000000-0000-4000-8000-0000000b0005";
export const unknownId = "00000000-0000-4000-8000-0000000b00ff";

export const removedEarlierId = "00000000-0000-4000-8000-0000000c0099";
export const removedEarlierStamp = "2026-10-09T08:00:00.5+00:00";

let setNumber = 0;
const setOf = (sessionId: string, overrides: Record<string, unknown> = {}) => {
  setNumber += 1;
  return setRow(setNumber, squat, {
    id: `00000000-0000-4000-8000-0000000c${String(setNumber).padStart(4, "0")}`,
    session_id: sessionId,
    ...overrides,
  });
};

// Thursday 8 October, a Legs day: two warm-ups, sixteen working sets, and one set the person removed on its own
// the next morning. The app counts 16.
function thursdaySets() {
  return [
    ...[0, 1].map((position) => setOf(thursdayId, { position, set_type: "warmup" })),
    ...Array.from({ length: 16 }, (_, position) => setOf(thursdayId, { position: position + 2 })),
    setOf(thursdayId, {
      id: removedEarlierId,
      position: 18,
      deleted_at: removedEarlierStamp,
    }),
  ];
}

function rows(live: boolean) {
  const session = (id: string, overrides: Record<string, unknown>) =>
    sessionRow(1, { id, local_date: "2026-10-08", routine_days: { name: "Legs" }, ...overrides });
  const sets = [
    ...thursdaySets(),
    ...(live ? [setOf(liveId)] : []),
    setOf(freeId),
    setOf(freeId),
    setOf(freeId),
    setOf(warmUpsOnlyId, { set_type: "warmup" }),
    setOf(warmUpsOnlyId, { set_type: "warmup" }),
    setOf(theirsId, { user_id: otherUserId }),
  ];
  return {
    workout_sessions: [
      session(thursdayId, {}),
      ...(live ? [session(liveId, { ended_at: null })] : []),
      session(freeId, { routine_day_id: null, routine_days: null, local_date: "2026-10-09" }),
      session(warmUpsOnlyId, { local_date: "2026-10-10" }),
      session(theirsId, { user_id: otherUserId }),
    ],
    workout_sets: sets,
    profiles: [{ weight_unit: "kg" }],
  };
}

export const stampOfDeletion = (number: number) =>
  `2026-11-07T10:00:${String(number).padStart(2, "0")}.123456+00:00`;

// `delete_workout_session` as the database answers it: the live sets of a live session of the caller are stamped
// with the one `now()` of the call, microseconds included, and so is the session. Anything else is P0002.
export function deleteWorkoutSessionRpc(): RpcHandler {
  let deletions = 0;
  return (args, tables) => {
    const session = (tables["workout_sessions"] ?? []).find(
      (row) => row["id"] === args["p_session_id"] && row["user_id"] === userId,
    );
    if (session === undefined || session["deleted_at"] !== null) {
      return { data: null, error: { code: "P0002", message: "not found" } };
    }
    deletions += 1;
    const stamp = stampOfDeletion(deletions);
    for (const set of tables["workout_sets"] ?? []) {
      if (
        set["session_id"] === session["id"] &&
        set["user_id"] === userId &&
        set["deleted_at"] === null
      ) {
        set["deleted_at"] = stamp;
      }
    }
    session["deleted_at"] = stamp;
    return { data: null, error: null };
  };
}

// What PostgREST does with `workout_sets(...)` and `.is("workout_sets.deleted_at", null)`: the embedded sets of a
// session are the live rows of the table. The shared stub keeps an embed as it was given and ignores that filter,
// so here the embed is read from the table, and a removed set can never be counted by the stub alone.
export function embedLiveSets(stub: WriteStub): void {
  for (const session of stub.tables["workout_sessions"] ?? []) {
    Object.defineProperty(session, "workout_sets", {
      get: () =>
        (stub.tables["workout_sets"] ?? []).filter(
          (set) => set["session_id"] === session["id"] && set["deleted_at"] === null,
        ),
    });
  }
}

// The in-memory database of the tests: the rows, and `delete_workout_session` as the database answers it. A
// workout in progress is left out unless asked for, because the executor refuses every call while one is open.
export function workoutStub(options: { live?: true } = {}): WriteStub {
  const stub = writeStub(rows(options.live === true), {
    callerUserId: userId,
    rpc: { delete_workout_session: deleteWorkoutSessionRpc() },
  });
  embedLiveSets(stub);
  return stub;
}
