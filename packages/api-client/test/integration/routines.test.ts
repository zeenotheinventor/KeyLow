import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  findGlobalExercise,
  logSets,
  present,
  saveExercise,
  startSession,
} from "./support/training";
import { createTestUser, deleteCreatedTestUsers } from "./support/users";
import { RoutineRuleError } from "../../src/errors";
import { getRoutine, listRoutines } from "../../src/repos/routines";
import { saveRoutine, setActiveRoutine, setRoutineArchived } from "../../src/repos/routineWrites";

import type { SavedExercise } from "./support/training";
import type { TestUser } from "./support/users";
import type { RoutineDraft } from "@keylow/core/training";

// The routine reads and writes against the local stack with real user JWTs. Every row is named key385-
// and each describe makes its own users, so the reads see exactly what the test wrote.

let globalExercise: SavedExercise;

beforeAll(async () => {
  globalExercise = await findGlobalExercise();
});

afterAll(async () => {
  // The users' routines, days, exercises and sessions go with them (on delete cascade).
  await deleteCreatedTestUsers();
});

const NOT_A_ROUTINE = "00000000-0000-4000-8000-000000000000";

const plan = (exerciseId: string, targetSets = 3) => ({
  exercise_id: exerciseId,
  target_sets: targetSets,
  rep_min: 8,
  rep_max: 12,
  target_rir: 2,
});

const draftOf = (name: string, days: RoutineDraft["days"] = []): RoutineDraft => ({ name, days });

/** What a rejected call throws. Null when the call did not reject. */
const rejectionOf = async (call: Promise<unknown>): Promise<Error | null> => {
  try {
    await call;
  } catch (error) {
    return error instanceof Error ? error : new Error("(not an Error)");
  }
  return null;
};

describe("saveRoutine", () => {
  let owner: TestUser;
  let stranger: TestUser;

  beforeAll(async () => {
    [owner, stranger] = await Promise.all([createTestUser("key385"), createTestUser("key385")]);
  });

  it("should create a routine with its days and exercises in the order they were sent, and read it back", async () => {
    const saved = await saveRoutine(owner.client, {
      id: null,
      draft: draftOf("key385-create", [
        { id: null, weekday: 2, name: "Pull", exercises: [plan(globalExercise.id, 4)] },
        { id: null, weekday: null, name: "Push", exercises: [] },
      ]),
    });

    expect(saved).toMatchObject({
      name: "key385-create",
      is_active: false,
      is_archived: false,
      activated_at: null,
    });
    expect(saved.days.map(({ name, position, weekday }) => ({ name, position, weekday }))).toEqual([
      { name: "Pull", position: 0, weekday: 2 },
      { name: "Push", position: 1, weekday: null },
    ]);
    expect(saved.days[0]?.exercises[0]).toMatchObject({
      exercise_id: globalExercise.id,
      position: 0,
      target_sets: 4,
      rep_min: 8,
      rep_max: 12,
      target_rir: 2,
      exercise: { id: globalExercise.id, name: globalExercise.name },
    });
  });

  it("should keep a day's id when the routine is edited, so the sessions logged from it stay linked", async () => {
    const created = await saveRoutine(owner.client, {
      id: null,
      draft: draftOf("key385-keep-ids", [
        { id: null, weekday: 0, name: "Push", exercises: [plan(globalExercise.id)] },
        { id: null, weekday: 1, name: "Pull", exercises: [] },
      ]),
    });
    const [push, pull] = created.days;

    const edited = await saveRoutine(owner.client, {
      id: created.id,
      draft: draftOf("key385-keep-ids-renamed", [
        {
          id: present(push, "a day").id,
          weekday: 0,
          name: "Push day",
          exercises: [plan(globalExercise.id, 5)],
        },
        { id: present(pull, "a day").id, weekday: 1, name: "Pull", exercises: [] },
      ]),
    });

    expect(edited.id).toBe(created.id);
    expect(edited.name).toBe("key385-keep-ids-renamed");
    expect(edited.days.map(({ id }) => id)).toEqual([push?.id, pull?.id]);
    expect(edited.days[0]).toMatchObject({ name: "Push day" });
    expect(edited.days[0]?.exercises[0]).toMatchObject({ target_sets: 5 });
  });

  it("should reorder the days and swap two days' weekdays in one save, each day keeping its id", async () => {
    const created = await saveRoutine(owner.client, {
      id: null,
      draft: draftOf("key385-reorder", [
        { id: null, weekday: 0, name: "Monday day", exercises: [] },
        { id: null, weekday: 4, name: "Friday day", exercises: [] },
        { id: null, weekday: null, name: "Any day", exercises: [] },
      ]),
    });
    const [monday, friday, anyDay] = created.days.map((day) => present(day, "a day"));

    const reordered = await saveRoutine(owner.client, {
      id: created.id,
      draft: draftOf("key385-reorder", [
        { id: present(anyDay, "a day").id, weekday: null, name: "Any day", exercises: [] },
        { id: present(friday, "a day").id, weekday: 0, name: "Friday day", exercises: [] },
        { id: present(monday, "a day").id, weekday: 4, name: "Monday day", exercises: [] },
      ]),
    });

    expect(reordered.days.map(({ id, position, weekday }) => ({ id, position, weekday }))).toEqual([
      { id: anyDay?.id, position: 0, weekday: null },
      { id: friday?.id, position: 1, weekday: 0 },
      { id: monday?.id, position: 2, weekday: 4 },
    ]);
  });

  it("should delete a day that is no longer sent and unlink the sessions logged from it", async () => {
    const created = await saveRoutine(owner.client, {
      id: null,
      draft: draftOf("key385-delete-day", [
        { id: null, weekday: 0, name: "Keep", exercises: [] },
        { id: null, weekday: 1, name: "Drop", exercises: [] },
      ]),
    });
    const [keep, drop] = created.days.map((day) => present(day, "a day"));
    const sessionId = await startSession(owner, "2026-10-12", { routineDayId: drop?.id ?? null });

    await saveRoutine(owner.client, {
      id: created.id,
      draft: draftOf("key385-delete-day", [
        { id: present(keep, "a day").id, weekday: 0, name: "Keep", exercises: [] },
      ]),
    });

    const { data, error } = await owner.client
      .from("workout_sessions")
      .select("routine_day_id")
      .eq("id", sessionId)
      .single();
    expect(error).toBeNull();
    expect(data?.routine_day_id).toBeNull();
    expect((await getRoutine(owner.client, created.id))?.days).toHaveLength(1);
  });

  it("should plan a global exercise and one of the user's own, and refuse another user's private exercise with the code only", async () => {
    const own = await saveExercise(owner, "own-plan");
    const foreign = await saveExercise(stranger, "foreign-plan");

    const planned = await saveRoutine(owner.client, {
      id: null,
      draft: draftOf("key385-exercises", [
        {
          id: null,
          weekday: 0,
          name: "Mixed",
          exercises: [plan(globalExercise.id), plan(own.id)],
        },
      ]),
    });
    const error = await rejectionOf(
      saveRoutine(owner.client, {
        id: null,
        draft: draftOf("key385-foreign", [
          { id: null, weekday: 0, name: "Foreign", exercises: [plan(foreign.id)] },
        ]),
      }),
    );

    expect(planned.days[0]?.exercises.map(({ exercise_id }) => exercise_id)).toEqual([
      globalExercise.id,
      own.id,
    ]);
    expect(error?.message).toMatch(/^Could not save the routine \([0-9A-Z]{5}\)$/);
    expect(JSON.stringify({ message: error?.message, cause: error?.cause })).not.toContain(
      foreign.name,
    );
  });

  it("should leave nothing behind when a save is refused, so the routine is not half written", async () => {
    const foreign = await saveExercise(stranger, "atomic-foreign");
    const before = await listRoutines(owner.client, { archived: true });

    await rejectionOf(
      saveRoutine(owner.client, {
        id: null,
        draft: draftOf("key385-atomic", [
          { id: null, weekday: 0, name: "Bad", exercises: [plan(foreign.id)] },
        ]),
      }),
    );

    const after = await listRoutines(owner.client, { archived: true });
    expect(after.map(({ name }) => name)).toEqual(before.map(({ name }) => name));
    expect(after.some(({ name }) => name === "key385-atomic")).toBe(false);
  });

  it("should not edit another user's routine, which looks the same as one that does not exist", async () => {
    const theirs = await saveRoutine(stranger.client, {
      id: null,
      draft: draftOf("key385-theirs"),
    });

    const stolen = await rejectionOf(
      saveRoutine(owner.client, { id: theirs.id, draft: draftOf("key385-stolen") }),
    );
    const missing = await rejectionOf(
      saveRoutine(owner.client, { id: NOT_A_ROUTINE, draft: draftOf("key385-stolen") }),
    );

    expect(stolen?.message).toBe("Could not save the routine (P0002)");
    expect(missing?.message).toBe("Could not save the routine (P0002)");
    expect((await getRoutine(stranger.client, theirs.id))?.name).toBe("key385-theirs");
  });
});

describe("listRoutines and getRoutine", () => {
  let owner: TestUser;
  let stranger: TestUser;

  beforeAll(async () => {
    [owner, stranger] = await Promise.all([createTestUser("key385"), createTestUser("key385")]);
  });

  it("should list the user's routines by name with each day's sets, and never another user's", async () => {
    await saveRoutine(owner.client, {
      id: null,
      draft: draftOf("key385-b-second", [
        {
          id: null,
          weekday: 0,
          name: "Push",
          exercises: [plan(globalExercise.id, 3), plan(globalExercise.id, 4)],
        },
      ]),
    });
    await saveRoutine(owner.client, { id: null, draft: draftOf("key385-a-first") });
    const theirs = await saveRoutine(stranger.client, {
      id: null,
      draft: draftOf("key385-a-stranger"),
    });

    const routines = await listRoutines(owner.client, { archived: false });

    expect(routines.map(({ name }) => name)).toEqual(["key385-a-first", "key385-b-second"]);
    expect(routines[1]?.days[0]?.exercises).toEqual([{ target_sets: 3 }, { target_sets: 4 }]);
    expect(routines.map(({ id }) => id)).not.toContain(theirs.id);
    expect(await getRoutine(owner.client, theirs.id)).toBeNull();
  });

  it("should leave archived routines out unless asked for them", async () => {
    const created = await saveRoutine(owner.client, {
      id: null,
      draft: draftOf("key385-archived-list"),
    });
    await setRoutineArchived(owner.client, created.id, true);

    const live = await listRoutines(owner.client, { archived: false });
    const all = await listRoutines(owner.client, { archived: true });

    expect(live.map(({ id }) => id)).not.toContain(created.id);
    expect(all.find(({ id }) => id === created.id)).toMatchObject({ is_archived: true });
    expect((await getRoutine(owner.client, created.id))?.is_archived).toBe(true);
  });

  it("should give a routine's exercises in position order with the exercise's name, equipment and id", async () => {
    const own = await saveExercise(owner, "detail-order");
    const created = await saveRoutine(owner.client, {
      id: null,
      draft: draftOf("key385-detail", [
        {
          id: null,
          weekday: 1,
          name: "Day",
          exercises: [plan(own.id, 2), plan(globalExercise.id, 6)],
        },
      ]),
    });

    const read = await getRoutine(owner.client, created.id);

    expect(read?.days[0]?.exercises.map(({ exercise }) => exercise.id)).toEqual([
      own.id,
      globalExercise.id,
    ]);
    expect(read?.days[0]?.exercises[0]?.exercise).toEqual({
      id: own.id,
      name: own.name,
      equipment: "barbell",
    });
  });
});

describe("setActiveRoutine", () => {
  let owner: TestUser;

  beforeAll(async () => {
    owner = await createTestUser("key385");
  });

  it("should make routine B active, clear routine A, and stamp the activation moment", async () => {
    const a = await saveRoutine(owner.client, { id: null, draft: draftOf("key385-active-a") });
    const b = await saveRoutine(owner.client, { id: null, draft: draftOf("key385-active-b") });
    const before = Date.now();

    const first = await setActiveRoutine(owner.client, a.id);
    const second = await setActiveRoutine(owner.client, b.id);

    expect(first).toMatchObject({ id: a.id, is_active: true });
    expect(second).toMatchObject({ id: b.id, is_active: true });
    expect(
      Date.parse(present(second?.activated_at, "an activation moment")),
    ).toBeGreaterThanOrEqual(before - 1000);
    const routines = await listRoutines(owner.client, { archived: false });
    expect(routines.filter(({ is_active }) => is_active).map(({ id }) => id)).toEqual([b.id]);
    expect(routines.find(({ id }) => id === a.id)?.activated_at).toEqual(first?.activated_at);
  });

  it("should clear the active routine with null", async () => {
    const created = await saveRoutine(owner.client, { id: null, draft: draftOf("key385-clear") });
    await setActiveRoutine(owner.client, created.id);

    const cleared = await setActiveRoutine(owner.client, null);

    expect(cleared).toBeNull();
    const routines = await listRoutines(owner.client, { archived: true });
    expect(routines.filter(({ is_active }) => is_active)).toEqual([]);
  });

  it("should refuse an archived routine and one that does not exist, with the code only", async () => {
    const created = await saveRoutine(owner.client, {
      id: null,
      draft: draftOf("key385-activate-archived"),
    });
    await setRoutineArchived(owner.client, created.id, true);

    const archived = await rejectionOf(setActiveRoutine(owner.client, created.id));
    const missing = await rejectionOf(setActiveRoutine(owner.client, NOT_A_ROUTINE));

    expect(archived?.message).toBe("Could not make the routine active (22023)");
    expect(missing?.message).toBe("Could not make the routine active (P0002)");
  });

  it("should keep the saved routine active and its activation moment when it is edited", async () => {
    const created = await saveRoutine(owner.client, {
      id: null,
      draft: draftOf("key385-edit-active"),
    });
    const active = await setActiveRoutine(owner.client, created.id);

    const edited = await saveRoutine(owner.client, {
      id: created.id,
      draft: draftOf("key385-edit-active-renamed"),
    });

    expect(edited).toMatchObject({ is_active: true, activated_at: active?.activated_at });
  });
});

describe("setRoutineArchived", () => {
  let owner: TestUser;
  let stranger: TestUser;

  beforeAll(async () => {
    [owner, stranger] = await Promise.all([createTestUser("key385"), createTestUser("key385")]);
  });

  it("should refuse the active routine with the typed active_routine rule", async () => {
    const created = await saveRoutine(owner.client, {
      id: null,
      draft: draftOf("key385-archive-active"),
    });
    await setActiveRoutine(owner.client, created.id);

    const error = await rejectionOf(setRoutineArchived(owner.client, created.id, true));

    expect(error).toBeInstanceOf(RoutineRuleError);
    expect(error).toMatchObject({ rule: "active_routine" });
    expect(error?.message).toBe("Could not archive the routine (active_routine)");
    expect((await getRoutine(owner.client, created.id))?.is_archived).toBe(false);
  });

  it("should archive another routine and restore it, leaving its days and exercises alone", async () => {
    const created = await saveRoutine(owner.client, {
      id: null,
      draft: draftOf("key385-archive-other", [
        { id: null, weekday: 0, name: "Push", exercises: [plan(globalExercise.id)] },
      ]),
    });

    const archived = await setRoutineArchived(owner.client, created.id, true);
    const restored = await setRoutineArchived(owner.client, created.id, false);

    expect(archived).toMatchObject({ id: created.id, is_archived: true });
    expect(restored).toMatchObject({ id: created.id, is_archived: false });
    expect(await getRoutine(owner.client, created.id)).toMatchObject({
      is_archived: false,
      days: [{ name: "Push", exercises: [{ exercise_id: globalExercise.id }] }],
    });
  });

  it("should archive the former active routine once another is active", async () => {
    const a = await saveRoutine(owner.client, { id: null, draft: draftOf("key385-former-a") });
    const b = await saveRoutine(owner.client, { id: null, draft: draftOf("key385-former-b") });
    await setActiveRoutine(owner.client, a.id);
    await setActiveRoutine(owner.client, b.id);

    const archived = await setRoutineArchived(owner.client, a.id, true);

    expect(archived).toMatchObject({ id: a.id, is_archived: true, is_active: false });
  });

  it("should not archive another user's routine, which looks the same as one that does not exist", async () => {
    const theirs = await saveRoutine(stranger.client, {
      id: null,
      draft: draftOf("key385-not-yours"),
    });

    const stolen = await rejectionOf(setRoutineArchived(owner.client, theirs.id, true));

    expect(stolen?.message).toBe("Could not archive the routine (PGRST116)");
    expect((await getRoutine(stranger.client, theirs.id))?.is_archived).toBe(false);
  });
});

describe("a routine and the sets logged against it", () => {
  it("should leave logged sessions and their sets alone when a routine is archived or its day deleted", async () => {
    const owner = await createTestUser("key385");
    const bench = await saveExercise(owner, "history");
    const created = await saveRoutine(owner.client, {
      id: null,
      draft: draftOf("key385-history", [
        { id: null, weekday: 0, name: "Push", exercises: [plan(bench.id)] },
      ]),
    });
    const day = present(created.days[0], "a day");
    const sessionId = await startSession(owner, "2026-10-12", { routineDayId: day.id });
    const [setId] = await logSets(owner, sessionId, bench, [
      { performedAt: "2026-10-12T09:00:00Z" },
    ]);

    await setRoutineArchived(owner.client, created.id, true);

    const { data } = await owner.client
      .from("workout_sets")
      .select("id")
      .eq("id", present(setId, "a set"));
    expect(data).toEqual([{ id: setId }]);
  });
});
