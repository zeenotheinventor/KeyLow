import { buildSetSnapshot } from "@keylow/core/training";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { addSet, removeSet, reorderSets, restoreSet, updateSet } from "../../src/repos/setWrites";
import { createTestClient } from "../createTestClient";
import {
  NOT_A_ROW,
  OTHER_SESSION_ID,
  SET_IDS,
  SET_SESSION_ID,
  exerciseRow,
  installSetWritesFake,
  liveSetsOf,
  storedSet,
} from "../support/setWrites";
import {
  BENCH_MUSCLES,
  EXERCISE_ID,
  RECOGNISABLE_EXERCISE_NAME,
  RECOGNISABLE_WEIGHT,
} from "../support/training";

import type { SetAdd } from "../../src/repos/setWrites";

const server = setupServer();

beforeAll(() => {
  server.listen({ onUnhandledFrame: "error" });
});
afterEach(() => {
  server.resetHandlers();
});
afterAll(() => {
  server.close();
});

const rejectionOf = async (call: Promise<unknown>): Promise<Error | null> => {
  try {
    await call;
  } catch (error) {
    return error instanceof Error ? error : new Error("(not an Error)");
  }
  return null;
};

const textOf = (error: Error | null) =>
  JSON.stringify({ message: error?.message, name: error?.name, cause: error?.cause });

const NOW = new Date("2026-10-18T09:30:00Z");

const draft = (overrides: Partial<SetAdd["draft"]> = {}): SetAdd["draft"] => ({
  setType: "working",
  load: "60",
  reps: "8",
  rir: "2",
  rpe: "",
  ...overrides,
});

const logInput = (overrides: Partial<SetAdd> = {}): SetAdd => ({
  sessionId: SET_SESSION_ID,
  exerciseId: EXERCISE_ID,
  draft: draft(),
  unit: "kg",
  effortMode: "rir",
  now: NOW,
  ...overrides,
});

describe("addSet", () => {
  it("should insert the set with the values, the position and the time of the press", async () => {
    const fake = installSetWritesFake(server);

    await addSet(createTestClient(), logInput());

    expect(fake.inserts).toEqual([
      expect.objectContaining({
        session_id: SET_SESSION_ID,
        exercise_id: EXERCISE_ID,
        position: 0,
        set_type: "working",
        reps: 8,
        load_kg: 60,
        rir: 2,
        rpe: null,
        performed_at: "2026-10-18T09:30:00.000Z",
      }),
    ]);
  });

  it("should resolve to the set as stored", async () => {
    installSetWritesFake(server);

    const stored = await addSet(createTestClient(), logInput());

    expect(stored).toMatchObject({ session_id: SET_SESSION_ID, exercise_id: EXERCISE_ID, reps: 8 });
  });

  it("should store the load in whole grams whatever the unit, so 225 pounds is 102.058 kilograms", async () => {
    const fake = installSetWritesFake(server);

    await addSet(createTestClient(), logInput({ draft: draft({ load: "225" }), unit: "lb" }));

    expect(fake.inserts).toMatchObject([{ load_kg: 102.058 }]);
  });

  it("should store no load for a blank load, an unloaded bodyweight set", async () => {
    const fake = installSetWritesFake(server);

    await addSet(createTestClient(), logInput({ draft: draft({ load: "" }) }));

    expect(fake.inserts).toMatchObject([{ load_kg: null }]);
  });

  it("should freeze the exercise and its muscle map from the moment of the log in the snapshot", async () => {
    const fake = installSetWritesFake(server);

    await addSet(createTestClient(), logInput());

    expect(fake.inserts[0]?.["snapshot"]).toEqual(
      buildSetSnapshot(
        {
          id: EXERCISE_ID,
          name: RECOGNISABLE_EXERCISE_NAME,
          equipment: "barbell",
          mechanic: "compound",
        },
        BENCH_MUSCLES,
      ),
    );
  });

  it("should take the position one past the highest live position of the session", async () => {
    const fake = installSetWritesFake(server, {
      sets: [
        storedSet({ position: 0 }),
        storedSet({ position: 4 }),
        storedSet({ position: 9, deleted_at: "2026-10-18T09:00:00+00:00" }),
        storedSet({ position: 7, session_id: OTHER_SESSION_ID }),
      ],
    });

    await addSet(createTestClient(), logInput());

    expect(fake.inserts).toMatchObject([{ position: 5 }]);
  });

  it("should store the RPE alone, with no RIR, when the setting is RPE", async () => {
    const fake = installSetWritesFake(server);

    await addSet(
      createTestClient(),
      logInput({ draft: draft({ rir: "", rpe: "8.5" }), effortMode: "rpe" }),
    );

    expect(fake.inserts).toMatchObject([{ rir: null, rpe: 8.5 }]);
  });

  it("should store no effort for a blank one, which counts the set as hard", async () => {
    const fake = installSetWritesFake(server);

    await addSet(createTestClient(), logInput({ draft: draft({ rir: "" }) }));

    expect(fake.inserts).toMatchObject([{ rir: null, rpe: null }]);
  });

  it("should refuse both effort measures before any request", async () => {
    const fake = installSetWritesFake(server);

    const error = await rejectionOf(
      addSet(createTestClient(), logInput({ draft: draft({ rir: "2", rpe: "8" }) })),
    );

    expect(error).toBeInstanceOf(RangeError);
    expect(error?.message).toContain("effort_one_measure_only");
    expect(fake.requests).toEqual([]);
  });

  it("should name every rule a draft breaks and no value, before any request", async () => {
    const fake = installSetWritesFake(server);

    const error = await rejectionOf(
      addSet(createTestClient(), logInput({ draft: draft({ load: "1234.5", reps: "0" }) })),
    );

    expect(error).toBeInstanceOf(RangeError);
    expect(error?.message).toContain("load_0_to_1000_kg");
    expect(error?.message).toContain("reps_whole_1_to_100");
    expect(textOf(error)).not.toMatch(/1234/);
    expect(fake.requests).toEqual([]);
  });

  it("should refuse the 201st live set with a rule and no value, and insert nothing", async () => {
    const fake = installSetWritesFake(server, { sets: liveSetsOf(200) });

    const error = await rejectionOf(addSet(createTestClient(), logInput()));

    expect(error).toBeInstanceOf(RangeError);
    expect(error?.message).toBe("A session holds at most 200 live sets.");
    expect(fake.inserts).toEqual([]);
  });

  it("should count live sets only, so a removed set makes room for the 200th", async () => {
    const removed = storedSet({ position: 500, deleted_at: "2026-10-18T09:00:00+00:00" });
    const fake = installSetWritesFake(server, { sets: [...liveSetsOf(199), removed] });

    await addSet(createTestClient(), logInput());

    expect(fake.inserts).toHaveLength(1);
  });

  it("should fail the same way for an exercise that does not exist as for one that is not visible", async () => {
    const fake = installSetWritesFake(server, { exercise: null });

    const error = await rejectionOf(
      addSet(createTestClient(), logInput({ exerciseId: NOT_A_ROW })),
    );

    expect(error?.message).toBe("Could not log the set (PGRST116)");
    expect(fake.inserts).toEqual([]);
  });

  it("should not log against an exercise that was deleted", async () => {
    const fake = installSetWritesFake(server, {
      exercise: exerciseRow({ deleted_at: "2026-10-17T09:00:00+00:00" }),
    });

    const error = await rejectionOf(addSet(createTestClient(), logInput()));

    expect(error?.message).toBe("Could not log the set (PGRST116)");
    expect(fake.inserts).toEqual([]);
  });

  it("should fail with the code of the policy when the session is not the caller's, as for one that does not exist", async () => {
    const fake = installSetWritesFake(server);
    fake.refuseInsertWith("42501");

    const foreign = await rejectionOf(
      addSet(createTestClient(), logInput({ sessionId: OTHER_SESSION_ID })),
    );
    const missing = await rejectionOf(
      addSet(createTestClient(), logInput({ sessionId: NOT_A_ROW })),
    );

    expect(foreign?.message).toBe("Could not log the set (42501)");
    expect(missing?.message).toBe(foreign?.message);
  });

  it("should throw a RangeError before any request for an id that is not a UUID or a time that is not a date", async () => {
    const fake = installSetWritesFake(server);

    const session = await rejectionOf(addSet(createTestClient(), logInput({ sessionId: "nope" })));
    const exercise = await rejectionOf(
      addSet(createTestClient(), logInput({ exerciseId: "nope" })),
    );
    const time = await rejectionOf(
      addSet(createTestClient(), logInput({ now: new Date("not a date") })),
    );

    expect(session).toBeInstanceOf(RangeError);
    expect(exercise).toBeInstanceOf(RangeError);
    expect(time).toBeInstanceOf(RangeError);
    expect(fake.requests).toEqual([]);
  });

  it("should carry the action and the code only when the database fails, with no name, load or effort", async () => {
    const fake = installSetWritesFake(server);
    fake.failWith("23514");

    const error = await rejectionOf(addSet(createTestClient(), logInput()));

    expect(error?.message).toBe("Could not log the set (23514)");
    expect(error?.cause).toEqual({ code: "23514" });
    expect(textOf(error)).not.toContain(RECOGNISABLE_EXERCISE_NAME);
    expect(textOf(error)).not.toContain(String(RECOGNISABLE_WEIGHT));
  });
});

describe("updateSet", () => {
  it("should send only the fields of the patch, to the live set", async () => {
    const set = storedSet();
    const fake = installSetWritesFake(server, { sets: [set] });

    await updateSet(createTestClient(), set.id, { reps: 10 });

    expect(fake.updates).toHaveLength(1);
    expect(fake.updates[0]?.body).toEqual({ reps: 10 });
    expect(fake.updates[0]?.url.searchParams.get("id")).toBe(`eq.${set.id}`);
    expect(fake.updates[0]?.url.searchParams.get("deleted_at")).toBe("is.null");
  });

  it("should resolve to the set as stored", async () => {
    const set = storedSet();
    installSetWritesFake(server, { sets: [set] });

    const stored = await updateSet(createTestClient(), set.id, { reps: 10 });

    expect(stored).toMatchObject({ id: set.id, reps: 10 });
  });

  it("should round a load to the gram", async () => {
    const set = storedSet();
    const fake = installSetWritesFake(server, { sets: [set] });

    await updateSet(createTestClient(), set.id, { load_kg: 100.0004 });

    expect(fake.updates[0]?.body).toEqual({ load_kg: 100 });
  });

  it("should clear the RPE when the RIR is set, so one measure is stored", async () => {
    const set = storedSet({ rir: null, rpe: 8 });
    const fake = installSetWritesFake(server, { sets: [set] });

    await updateSet(createTestClient(), set.id, { rir: 3 });

    expect(fake.updates[0]?.body).toEqual({ rir: 3, rpe: null });
  });

  it("should clear the RIR when the RPE is set", async () => {
    const set = storedSet({ rir: 2, rpe: null });
    const fake = installSetWritesFake(server, { sets: [set] });

    await updateSet(createTestClient(), set.id, { rpe: 7.5 });

    expect(fake.updates[0]?.body).toEqual({ rpe: 7.5, rir: null });
  });

  it("should clear only the measure that is blanked, and leave the other one", async () => {
    const set = storedSet({ rir: 2, rpe: null });
    const fake = installSetWritesFake(server, { sets: [set] });

    await updateSet(createTestClient(), set.id, { rir: null });

    expect(fake.updates[0]?.body).toEqual({ rir: null });
  });

  it("should refuse a patch that sets both effort measures", async () => {
    const set = storedSet();
    const fake = installSetWritesFake(server, { sets: [set] });

    const error = await rejectionOf(updateSet(createTestClient(), set.id, { rir: 2, rpe: 8 }));

    expect(error).toBeInstanceOf(RangeError);
    expect(error?.message).toContain("effort_one_measure_only");
    expect(fake.requests).toEqual([]);
  });

  it("should send the position and the set type", async () => {
    const set = storedSet();
    const fake = installSetWritesFake(server, { sets: [set] });

    await updateSet(createTestClient(), set.id, { position: 3, set_type: "drop" });

    expect(fake.updates[0]?.body).toEqual({ position: 3, set_type: "drop" });
  });

  it.each([
    ["snapshot", { snapshot: {} }],
    ["session", { session_id: OTHER_SESSION_ID }],
    ["exercise", { exercise_id: EXERCISE_ID }],
  ])(
    "should throw a RangeError stating the rule when the patch names the %s, and send nothing",
    async (_name, patch) => {
      const set = storedSet();
      const fake = installSetWritesFake(server, { sets: [set] });

      // The type of a patch cannot name these, so the check is for a caller that gets past the types.
      // @ts-expect-error a snapshot, a session and an exercise are not fields of a patch
      const error = await rejectionOf(updateSet(createTestClient(), set.id, patch));

      expect(error).toBeInstanceOf(RangeError);
      expect(error?.message).toBe("A set never changes its session, its exercise or its snapshot");
      expect(fake.requests).toEqual([]);
    },
  );

  it("should refuse a patch that names a column a set update does not take", async () => {
    const set = storedSet();
    const fake = installSetWritesFake(server, { sets: [set] });
    const patch = { deleted_at: null };

    // @ts-expect-error deleted_at is changed by removeSet and restoreSet only
    const error = await rejectionOf(updateSet(createTestClient(), set.id, patch));

    expect(error).toBeInstanceOf(RangeError);
    expect(error?.message).toBe(
      "A set update can change only its position, type, reps, load, RIR and RPE",
    );
    expect(fake.requests).toEqual([]);
  });

  it("should refuse an empty patch", async () => {
    const set = storedSet();
    const fake = installSetWritesFake(server, { sets: [set] });

    const error = await rejectionOf(updateSet(createTestClient(), set.id, {}));

    expect(error).toBeInstanceOf(RangeError);
    expect(fake.requests).toEqual([]);
  });

  it.each([
    ["reps below 1", { reps: 0 }, "reps_whole_1_to_100"],
    ["reps above 100", { reps: 101 }, "reps_whole_1_to_100"],
    ["reps that are not whole", { reps: 8.5 }, "reps_whole_1_to_100"],
    ["a negative load", { load_kg: -1 }, "load_0_to_1000_kg"],
    ["a load above 1,000 kg", { load_kg: 1000.001 }, "load_0_to_1000_kg"],
    ["an RIR above 10", { rir: 11 }, "rir_whole_0_to_10"],
    ["an RIR that is not whole", { rir: 1.5 }, "rir_whole_0_to_10"],
    ["an RPE below 1", { rpe: 0.5 }, "rpe_1_to_10_in_halves"],
    ["an RPE not in halves", { rpe: 7.3 }, "rpe_1_to_10_in_halves"],
    ["a negative position", { position: -1 }, "position_whole_from_0"],
    ["a position that is not whole", { position: 1.5 }, "position_whole_from_0"],
  ])(
    "should refuse %s with its rule and no value, before any request",
    async (_name, patch, rule) => {
      const set = storedSet();
      const fake = installSetWritesFake(server, { sets: [set] });

      const error = await rejectionOf(updateSet(createTestClient(), set.id, patch));

      expect(error).toBeInstanceOf(RangeError);
      expect(error?.message).toBe(`The set breaks the rules: ${rule}.`);
      expect(fake.requests).toEqual([]);
    },
  );

  it("should fail with PGRST116 for a set that does not exist, is not the caller's or was removed", async () => {
    const removed = storedSet({ deleted_at: "2026-10-18T09:00:00+00:00" });
    installSetWritesFake(server, { sets: [removed] });

    const missing = await rejectionOf(updateSet(createTestClient(), NOT_A_ROW, { reps: 9 }));
    const gone = await rejectionOf(updateSet(createTestClient(), removed.id, { reps: 9 }));

    expect(missing?.message).toBe("Could not update the set (PGRST116)");
    expect(gone?.message).toBe(missing?.message);
  });

  it("should carry the action and the code only when the database fails", async () => {
    const set = storedSet();
    const fake = installSetWritesFake(server, { sets: [set] });
    fake.failWith("23514");

    const error = await rejectionOf(updateSet(createTestClient(), set.id, { reps: 9 }));

    expect(error?.message).toBe("Could not update the set (23514)");
    expect(error?.cause).toEqual({ code: "23514" });
    expect(textOf(error)).not.toContain(String(RECOGNISABLE_WEIGHT));
  });

  it("should throw a RangeError before any request for an id that is not a UUID", async () => {
    const fake = installSetWritesFake(server);

    const error = await rejectionOf(updateSet(createTestClient(), "nope", { reps: 9 }));

    expect(error).toBeInstanceOf(RangeError);
    expect(fake.requests).toEqual([]);
  });
});

describe("removeSet", () => {
  it("should stamp deleted_at on the live set and resolve to it as stored", async () => {
    const set = storedSet();
    const fake = installSetWritesFake(server, { sets: [set] });

    const removed = await removeSet(createTestClient(), set.id);

    expect(fake.updates[0]?.body["deleted_at"]).toMatch(/^2\d{3}-/);
    expect(removed.deleted_at).not.toBeNull();
    expect(fake.liveIdsOf(SET_SESSION_ID)).toEqual([]);
  });

  it("should resolve to the removed set when it was already removed, and change nothing", async () => {
    const removedAt = "2026-10-18T09:00:00+00:00";
    const set = storedSet({ deleted_at: removedAt });
    installSetWritesFake(server, { sets: [set] });

    const removed = await removeSet(createTestClient(), set.id);

    expect(removed.deleted_at).toBe(removedAt);
  });

  it("should fail with PGRST116 for a set that does not exist or is not the caller's", async () => {
    installSetWritesFake(server);

    const error = await rejectionOf(removeSet(createTestClient(), NOT_A_ROW));

    expect(error?.message).toBe("Could not remove the set (PGRST116)");
  });

  it("should carry the action and the code only when the database fails", async () => {
    const set = storedSet();
    const fake = installSetWritesFake(server, { sets: [set] });
    fake.failWith("42501");

    const error = await rejectionOf(removeSet(createTestClient(), set.id));

    expect(error?.message).toBe("Could not remove the set (42501)");
    expect(textOf(error)).not.toContain(String(RECOGNISABLE_WEIGHT));
  });

  it("should throw a RangeError before any request for an id that is not a UUID", async () => {
    const fake = installSetWritesFake(server);

    const error = await rejectionOf(removeSet(createTestClient(), "nope"));

    expect(error).toBeInstanceOf(RangeError);
    expect(fake.requests).toEqual([]);
  });
});

describe("restoreSet", () => {
  const removedAt = "2026-10-18T09:00:00+00:00";

  it("should clear deleted_at on a removed set and resolve to it live", async () => {
    const set = storedSet({ deleted_at: removedAt });
    const fake = installSetWritesFake(server, { sets: [set] });

    const restored = await restoreSet(createTestClient(), set.id);

    expect(fake.updates[0]?.body).toEqual({ deleted_at: null });
    expect(restored.deleted_at).toBeNull();
    expect(fake.liveIdsOf(SET_SESSION_ID)).toEqual([set.id]);
  });

  it("should leave a set that is already live as it is and write nothing", async () => {
    const set = storedSet();
    const fake = installSetWritesFake(server, { sets: [set] });

    const restored = await restoreSet(createTestClient(), set.id);

    expect(restored.id).toBe(set.id);
    expect(fake.updates).toEqual([]);
  });

  it("should refuse a restore into a session that already holds 200 live sets, with a rule and no value", async () => {
    const set = storedSet({ deleted_at: removedAt, position: 500 });
    const fake = installSetWritesFake(server, { sets: [...liveSetsOf(200), set] });

    const error = await rejectionOf(restoreSet(createTestClient(), set.id));

    expect(error).toBeInstanceOf(RangeError);
    expect(error?.message).toBe("A session holds at most 200 live sets.");
    expect(fake.updates).toEqual([]);
  });

  it("should restore into a session that holds 199 live sets", async () => {
    const set = storedSet({ deleted_at: removedAt, position: 500 });
    const fake = installSetWritesFake(server, { sets: [...liveSetsOf(199), set] });

    await restoreSet(createTestClient(), set.id);

    expect(fake.updates).toHaveLength(1);
  });

  it("should fail with PGRST116 for a set that does not exist or is not the caller's", async () => {
    installSetWritesFake(server);

    const error = await rejectionOf(restoreSet(createTestClient(), NOT_A_ROW));

    expect(error?.message).toBe("Could not restore the set (PGRST116)");
  });

  it("should carry the action and the code only when the database refuses, as for a deleted session", async () => {
    const set = storedSet({ deleted_at: removedAt });
    const fake = installSetWritesFake(server, { sets: [set] });
    fake.failWith("42501");

    const error = await rejectionOf(restoreSet(createTestClient(), set.id));

    expect(error?.message).toBe("Could not restore the set (42501)");
    expect(textOf(error)).not.toContain(String(RECOGNISABLE_WEIGHT));
  });

  it("should throw a RangeError before any request for an id that is not a UUID", async () => {
    const fake = installSetWritesFake(server);

    const error = await rejectionOf(restoreSet(createTestClient(), "nope"));

    expect(error).toBeInstanceOf(RangeError);
    expect(fake.requests).toEqual([]);
  });
});

describe("reorderSets", () => {
  const [FIRST, SECOND, THIRD, FOURTH] = SET_IDS;
  const setAt = (id: string, position: number, overrides: Record<string, unknown> = {}) =>
    storedSet({ id, position, ...overrides });
  const threeSets = () => [setAt(FIRST, 0), setAt(SECOND, 1), setAt(THIRD, 2)];

  it("should rewrite the positions to the new order", async () => {
    const fake = installSetWritesFake(server, { sets: threeSets() });

    await reorderSets(createTestClient(), SET_SESSION_ID, [THIRD, FIRST, SECOND]);

    expect(fake.liveIdsOf(SET_SESSION_ID)).toEqual([THIRD, FIRST, SECOND]);
  });

  it("should write the rows that move only, as plain updates of one row each", async () => {
    const fake = installSetWritesFake(server, { sets: threeSets() });

    await reorderSets(createTestClient(), SET_SESSION_ID, [FIRST, THIRD, SECOND]);

    expect(fake.updates).toHaveLength(2);
    expect(fake.updates.map(({ body }) => body)).toEqual(
      expect.arrayContaining([{ position: 2 }, { position: 1 }]),
    );
  });

  it("should move the given sets among their own places and leave the others where they are", async () => {
    const sets = [...threeSets(), setAt(FOURTH, 3)];
    const fake = installSetWritesFake(server, { sets });

    await reorderSets(createTestClient(), SET_SESSION_ID, [FOURTH, SECOND]);

    expect(fake.liveIdsOf(SET_SESSION_ID)).toEqual([FIRST, FOURTH, THIRD, SECOND]);
  });

  it("should separate sets that share a position, so the new order shows", async () => {
    const fake = installSetWritesFake(server, { sets: [setAt(FIRST, 2), setAt(SECOND, 2)] });

    await reorderSets(createTestClient(), SET_SESSION_ID, [SECOND, FIRST]);

    expect(fake.liveIdsOf(SET_SESSION_ID)).toEqual([SECOND, FIRST]);
  });

  it("should write nothing when the order is the one the sets already have", async () => {
    const fake = installSetWritesFake(server, { sets: threeSets() });

    await reorderSets(createTestClient(), SET_SESSION_ID, [FIRST, SECOND, THIRD]);

    expect(fake.updates).toEqual([]);
  });

  it("should refuse ids that do not all belong to the session, the same for another session as for none", async () => {
    const sets = [...threeSets(), setAt(FOURTH, 0, { session_id: OTHER_SESSION_ID })];
    const fake = installSetWritesFake(server, { sets });

    const another = await rejectionOf(
      reorderSets(createTestClient(), SET_SESSION_ID, [FIRST, FOURTH]),
    );
    const missing = await rejectionOf(
      reorderSets(createTestClient(), SET_SESSION_ID, [FIRST, NOT_A_ROW]),
    );

    expect(another).toBeInstanceOf(RangeError);
    expect(another?.message).toBe("Every set to reorder must be a live set of the session");
    expect(missing?.message).toBe(another?.message);
    expect(fake.updates).toEqual([]);
  });

  it("should refuse a set that is removed", async () => {
    const sets = [setAt(FIRST, 0), setAt(SECOND, 1, { deleted_at: "2026-10-18T09:00:00+00:00" })];
    const fake = installSetWritesFake(server, { sets });

    const error = await rejectionOf(
      reorderSets(createTestClient(), SET_SESSION_ID, [FIRST, SECOND]),
    );

    expect(error).toBeInstanceOf(RangeError);
    expect(fake.updates).toEqual([]);
  });

  it("should refuse fewer than two sets, a set listed twice and ids that are not UUIDs, before any request", async () => {
    const fake = installSetWritesFake(server);

    const one = await rejectionOf(reorderSets(createTestClient(), SET_SESSION_ID, [FIRST]));
    const twice = await rejectionOf(
      reorderSets(createTestClient(), SET_SESSION_ID, [FIRST, FIRST]),
    );
    const notUuid = await rejectionOf(
      reorderSets(createTestClient(), SET_SESSION_ID, [FIRST, "nope"]),
    );
    const session = await rejectionOf(reorderSets(createTestClient(), "nope", [FIRST, SECOND]));

    for (const error of [one, twice, notUuid, session]) {
      expect(error).toBeInstanceOf(RangeError);
    }
    expect(fake.requests).toEqual([]);
  });

  it("should carry the action and the code only when the database fails", async () => {
    const fake = installSetWritesFake(server, { sets: threeSets() });
    fake.failWith("42501");

    const error = await rejectionOf(
      reorderSets(createTestClient(), SET_SESSION_ID, [SECOND, FIRST]),
    );

    expect(error?.message).toBe("Could not reorder the sets (42501)");
    expect(error?.cause).toEqual({ code: "42501" });
  });
});
