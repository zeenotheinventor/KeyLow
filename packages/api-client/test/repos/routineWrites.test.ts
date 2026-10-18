import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { RoutineRuleError } from "../../src/errors";
import { saveRoutine, setActiveRoutine, setRoutineArchived } from "../../src/repos/routineWrites";
import { createTestClient } from "../createTestClient";
import {
  DAY_ID,
  EXERCISE_ID,
  OTHER_ROUTINE_ID,
  RECOGNISABLE_ROUTINE_DAY_NAME,
  RECOGNISABLE_ROUTINE_EXERCISE_NAME,
  RECOGNISABLE_ROUTINE_NAME,
  ROUTINE_ID,
  SECOND_DAY_ID,
  installRoutinesFake,
  routineDetailRow,
  routineFlagsRow,
} from "../support/routines";

import type { RoutineDraft } from "@keylow/core/training";

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

const exercise = {
  exercise_id: EXERCISE_ID,
  target_sets: 3,
  rep_min: 8,
  rep_max: 12,
  target_rir: 2,
};

const draft = (overrides: Partial<RoutineDraft> = {}): RoutineDraft => ({
  name: `  ${RECOGNISABLE_ROUTINE_NAME}  `,
  days: [
    { id: DAY_ID, weekday: 0, name: ` ${RECOGNISABLE_ROUTINE_DAY_NAME} `, exercises: [exercise] },
    { id: null, weekday: null, name: "Pull", exercises: [] },
  ],
  ...overrides,
});

describe("saveRoutine", () => {
  it("should create a routine with a null id and send the cleaned draft as save_routine reads it", async () => {
    const fake = installRoutinesFake(server, { routines: [routineDetailRow()] });

    await saveRoutine(createTestClient(), { id: null, draft: draft() });

    expect(fake.saves).toEqual([
      {
        p_routine_id: null,
        p_routine: { name: RECOGNISABLE_ROUTINE_NAME },
        p_days: [
          {
            id: DAY_ID,
            weekday: 0,
            name: RECOGNISABLE_ROUTINE_DAY_NAME,
            exercises: [exercise],
          },
          { id: null, weekday: null, name: "Pull", exercises: [] },
        ],
      },
    ]);
  });

  it("should edit a routine by its id and send each stored day with its own id, so the day keeps it", async () => {
    const fake = installRoutinesFake(server, { routines: [routineDetailRow()] });
    const edited = draft({
      days: [
        { id: SECOND_DAY_ID, weekday: 3, name: "Pull", exercises: [] },
        { id: DAY_ID, weekday: 0, name: "Push", exercises: [exercise] },
      ],
    });

    await saveRoutine(createTestClient(), { id: ROUTINE_ID, draft: edited });

    expect(fake.saves).toMatchObject([
      {
        p_routine_id: ROUTINE_ID,
        p_days: [
          { id: SECOND_DAY_ID, weekday: 3 },
          { id: DAY_ID, weekday: 0 },
        ],
      },
    ]);
  });

  it("should resolve to the routine as stored, read back after the save", async () => {
    installRoutinesFake(server, {
      routines: [routineDetailRow({ name: "As stored" })],
      savedId: ROUTINE_ID,
    });

    const saved = await saveRoutine(createTestClient(), { id: null, draft: draft() });

    expect(saved).toMatchObject({ id: ROUTINE_ID, name: "As stored" });
    expect(saved.days[0]?.exercises[0]?.exercise.id).toBe(EXERCISE_ID);
  });

  it("should throw a RangeError before any request when the draft breaks a rule, naming the rules and no value", async () => {
    const fake = installRoutinesFake(server);
    const broken = draft({
      name: "   ",
      days: [
        { id: null, weekday: 1, name: RECOGNISABLE_ROUTINE_DAY_NAME, exercises: [exercise] },
        {
          id: null,
          weekday: 1,
          name: RECOGNISABLE_ROUTINE_DAY_NAME,
          exercises: [{ ...exercise, target_sets: 99 }],
        },
      ],
    });

    const error = await rejectionOf(saveRoutine(createTestClient(), { id: null, draft: broken }));

    expect(error).toBeInstanceOf(RangeError);
    expect(error?.message).toContain("name (routine_name_blank)");
    expect(error?.message).toContain("days.1.weekday (weekday_repeated)");
    expect(error?.message).toContain("days.1.exercises.0.target_sets (target_sets_invalid)");
    expect(textOf(error)).not.toContain(RECOGNISABLE_ROUTINE_DAY_NAME);
    expect(textOf(error)).not.toContain("99");
    expect(fake.requestCount).toBe(0);
  });

  it("should name the action and the code only when the database refuses, with no name from the draft in it", async () => {
    const fake = installRoutinesFake(server);
    fake.failWith("P0002", `the exercise ${RECOGNISABLE_ROUTINE_EXERCISE_NAME} is not visible`);

    const error = await rejectionOf(saveRoutine(createTestClient(), { id: null, draft: draft() }));

    expect(error?.message).toBe("Could not save the routine (P0002)");
    expect(error?.cause).toEqual({ code: "P0002" });
    expect(textOf(error)).not.toContain(RECOGNISABLE_ROUTINE_EXERCISE_NAME);
    expect(textOf(error)).not.toContain(RECOGNISABLE_ROUTINE_NAME);
  });

  it("should fail with the action when the saved routine cannot be read back", async () => {
    installRoutinesFake(server, { routines: [] });

    const error = await rejectionOf(saveRoutine(createTestClient(), { id: null, draft: draft() }));

    expect(error?.message).toBe("Could not load the routine after saving it");
  });
});

describe("setActiveRoutine", () => {
  it("should call set_active_routine with the id and resolve to the routine as stored", async () => {
    const fake = installRoutinesFake(server, {
      routines: [routineDetailRow({ is_active: true, activated_at: "2026-10-18T09:00:00+00:00" })],
    });

    const routine = await setActiveRoutine(createTestClient(), ROUTINE_ID);

    expect(fake.activations).toEqual([{ p_routine_id: ROUTINE_ID }]);
    expect(routine).toMatchObject({ id: ROUTINE_ID, is_active: true });
  });

  it("should clear the active routine with null and resolve to null, reading nothing back", async () => {
    const fake = installRoutinesFake(server);

    const routine = await setActiveRoutine(createTestClient(), null);

    expect(fake.activations).toEqual([{ p_routine_id: null }]);
    expect(routine).toBeNull();
    expect(fake.reads).toHaveLength(0);
  });

  it("should throw a RangeError before any request when the id is not a UUID", async () => {
    const fake = installRoutinesFake(server);

    const error = await rejectionOf(setActiveRoutine(createTestClient(), "nope"));

    expect(error).toBeInstanceOf(RangeError);
    expect(fake.requestCount).toBe(0);
  });

  it("should name the action and the code only when the database refuses", async () => {
    const fake = installRoutinesFake(server);
    fake.failWith("22023");

    const error = await rejectionOf(setActiveRoutine(createTestClient(), OTHER_ROUTINE_ID));

    expect(error?.message).toBe("Could not make the routine active (22023)");
    expect(textOf(error)).not.toContain(RECOGNISABLE_ROUTINE_NAME);
  });
});

describe("setRoutineArchived", () => {
  it("should archive the routine and resolve to it as stored", async () => {
    const fake = installRoutinesFake(server, { archived: routineFlagsRow({ is_archived: true }) });

    const routine = await setRoutineArchived(createTestClient(), ROUTINE_ID, true);

    expect(fake.archives[0]?.body).toEqual({ is_archived: true });
    expect(fake.archives[0]?.url.searchParams.get("id")).toBe(`eq.${ROUTINE_ID}`);
    expect(routine).toEqual(routineFlagsRow({ is_archived: true }));
  });

  it("should restore the routine with archived false, which is the Undo", async () => {
    const fake = installRoutinesFake(server, { archived: routineFlagsRow() });

    const routine = await setRoutineArchived(createTestClient(), ROUTINE_ID, false);

    expect(fake.archives[0]?.body).toEqual({ is_archived: false });
    expect(routine.is_archived).toBe(false);
  });

  it("should refuse an active routine with the typed active_routine rule, not a database message", async () => {
    const fake = installRoutinesFake(server);
    fake.failWith(
      "23514",
      'new row for relation "routines" violates check constraint "routines_active_not_archived"',
    );

    const error = await rejectionOf(setRoutineArchived(createTestClient(), ROUTINE_ID, true));

    expect(error).toBeInstanceOf(RoutineRuleError);
    expect(error instanceof RoutineRuleError && error.rule).toBe("active_routine");
    expect(error?.message).toBe("Could not archive the routine (active_routine)");
    expect(textOf(error)).not.toContain(RECOGNISABLE_ROUTINE_NAME);
    expect(textOf(error)).not.toContain(RECOGNISABLE_ROUTINE_EXERCISE_NAME);
  });

  it("should name the action and the code only for any other failure", async () => {
    const fake = installRoutinesFake(server);
    fake.failWith("23514", `a different check failed for ${RECOGNISABLE_ROUTINE_NAME}`);

    const error = await rejectionOf(setRoutineArchived(createTestClient(), ROUTINE_ID, true));

    expect(error).not.toBeInstanceOf(RoutineRuleError);
    expect(error?.message).toBe("Could not archive the routine (23514)");
    expect(textOf(error)).not.toContain(RECOGNISABLE_ROUTINE_NAME);
  });

  it("should name restoring when a restore fails", async () => {
    const fake = installRoutinesFake(server);
    fake.failWith("PGRST116");

    const error = await rejectionOf(setRoutineArchived(createTestClient(), ROUTINE_ID, false));

    expect(error?.message).toBe("Could not restore the routine (PGRST116)");
  });
});
