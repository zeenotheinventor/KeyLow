import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { getRoutine, listRoutines } from "../../src/repos/routines";
import { createTestClient } from "../createTestClient";
import {
  DAY_ID,
  EXERCISE_ID,
  PLANNED_EXERCISE_ID,
  RECOGNISABLE_ROUTINE_DAY_NAME,
  RECOGNISABLE_ROUTINE_EXERCISE_NAME,
  RECOGNISABLE_ROUTINE_NAME,
  ROUTINE_ID,
  SECOND_DAY_ID,
  installRoutinesFake,
  plannedExerciseRow,
  routineDetailRow,
  routineListRow,
} from "../support/routines";

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

/** What a rejected call throws, as text, to look for a value in it. Null when the call did not reject. */
const rejectionOf = async (call: Promise<unknown>): Promise<Error | null> => {
  try {
    await call;
  } catch (error) {
    return error instanceof Error ? error : new Error("(not an Error)");
  }
  return null;
};

/** Everything a thrown error carries as text: its message, its name and its cause. */
const textOf = (error: Error | null) =>
  JSON.stringify({ message: error?.message, name: error?.name, cause: error?.cause });

const firstRead = (reads: URL[]) => reads[0] ?? new URL("http://none");

describe("listRoutines", () => {
  it("should ask for the routines by name, with their days in order and each day's sets", async () => {
    const fake = installRoutinesFake(server, { routines: [] });

    await listRoutines(createTestClient(), { archived: false });

    const url = firstRead(fake.reads);
    expect(url.searchParams.get("select")).toBe(
      "id,name,is_active,is_archived,activated_at,routine_days(id,position,weekday,name,routine_exercises(target_sets))",
    );
    expect(url.searchParams.get("order")).toBe("name.asc,id.asc");
    expect(url.searchParams.get("routine_days.order")).toBe("position.asc");
  });

  it("should leave archived routines out unless asked for them", async () => {
    const fake = installRoutinesFake(server, { routines: [] });
    const client = createTestClient();

    await listRoutines(client, { archived: false });
    await listRoutines(client, { archived: true });

    expect(firstRead(fake.reads).searchParams.get("is_archived")).toBe("eq.false");
    expect(fake.reads[1]?.searchParams.has("is_archived")).toBe(false);
  });

  it("should give each routine as rows: its flags, its activation moment and its days with their sets", async () => {
    installRoutinesFake(server, {
      routines: [
        routineListRow({ is_active: true, activated_at: "2026-10-12T08:30:00.123456+00:00" }),
      ],
    });

    const routines = await listRoutines(createTestClient(), { archived: false });

    expect(routines).toEqual([
      {
        id: ROUTINE_ID,
        name: RECOGNISABLE_ROUTINE_NAME,
        is_active: true,
        is_archived: false,
        activated_at: "2026-10-12T08:30:00.123456+00:00",
        days: [
          {
            id: DAY_ID,
            position: 0,
            weekday: 0,
            name: RECOGNISABLE_ROUTINE_DAY_NAME,
            exercises: [{ target_sets: 3 }, { target_sets: 4 }],
          },
          {
            id: SECOND_DAY_ID,
            position: 1,
            weekday: null,
            name: "Pull",
            exercises: [{ target_sets: 5 }],
          },
        ],
      },
    ]);
  });

  it("should give an empty list when there is no routine", async () => {
    installRoutinesFake(server, { routines: [] });

    expect(await listRoutines(createTestClient(), { archived: true })).toEqual([]);
  });

  it("should name the action and the code only when the read fails, with no routine or exercise name in it", async () => {
    const fake = installRoutinesFake(server);
    fake.failWith("42501");

    const error = await rejectionOf(listRoutines(createTestClient(), { archived: false }));

    expect(error?.message).toBe("Could not load your routines (42501)");
    expect(textOf(error)).not.toContain(RECOGNISABLE_ROUTINE_NAME);
    expect(textOf(error)).not.toContain(RECOGNISABLE_ROUTINE_EXERCISE_NAME);
  });

  it("should name the row and the field, never a value, when a row has an unexpected shape", async () => {
    installRoutinesFake(server, { routines: [routineListRow({ is_active: "yes" })] });

    const error = await rejectionOf(listRoutines(createTestClient(), { archived: false }));

    expect(error?.message).toContain(ROUTINE_ID);
    expect(error?.message).toContain("is_active");
    expect(textOf(error)).not.toContain(RECOGNISABLE_ROUTINE_NAME);
  });
});

describe("getRoutine", () => {
  it("should ask for the one routine by id with its days and exercises in position order", async () => {
    const fake = installRoutinesFake(server, { routines: [routineDetailRow()] });

    await getRoutine(createTestClient(), ROUTINE_ID);

    const url = firstRead(fake.reads);
    expect(url.searchParams.get("select")).toBe(
      "id,name,is_active,is_archived,activated_at,routine_days(id,position,weekday,name,routine_exercises(id,position,exercise_id,target_sets,rep_min,rep_max,target_rir,exercises(id,name,equipment)))",
    );
    expect(url.searchParams.get("id")).toBe(`eq.${ROUTINE_ID}`);
    expect(url.searchParams.get("routine_days.order")).toBe("position.asc");
    expect(url.searchParams.get("routine_days.routine_exercises.order")).toBe("position.asc");
  });

  it("should give the routine with each exercise's name, equipment and id and no muscle map", async () => {
    installRoutinesFake(server, {
      routines: [
        routineDetailRow({
          is_active: true,
          activated_at: "2026-10-12T08:30:00+00:00",
          routine_days: [
            {
              id: DAY_ID,
              position: 0,
              weekday: 2,
              name: RECOGNISABLE_ROUTINE_DAY_NAME,
              routine_exercises: [plannedExerciseRow({ target_rir: null })],
            },
          ],
        }),
      ],
    });

    const routine = await getRoutine(createTestClient(), ROUTINE_ID);

    expect(routine).toEqual({
      id: ROUTINE_ID,
      name: RECOGNISABLE_ROUTINE_NAME,
      is_active: true,
      is_archived: false,
      activated_at: "2026-10-12T08:30:00+00:00",
      days: [
        {
          id: DAY_ID,
          position: 0,
          weekday: 2,
          name: RECOGNISABLE_ROUTINE_DAY_NAME,
          exercises: [
            {
              id: PLANNED_EXERCISE_ID,
              position: 0,
              exercise_id: EXERCISE_ID,
              target_sets: 3,
              rep_min: 8,
              rep_max: 12,
              target_rir: null,
              exercise: {
                id: EXERCISE_ID,
                name: RECOGNISABLE_ROUTINE_EXERCISE_NAME,
                equipment: "barbell",
              },
            },
          ],
        },
      ],
    });
  });

  it("should give null for a routine that is not visible, the same for another user's routine", async () => {
    installRoutinesFake(server, { routines: [] });

    expect(await getRoutine(createTestClient(), ROUTINE_ID)).toBeNull();
  });

  it("should throw a RangeError before any request when the id is not a UUID", async () => {
    const fake = installRoutinesFake(server, { routines: [routineDetailRow()] });

    const error = await rejectionOf(getRoutine(createTestClient(), "not-an-id"));

    expect(error).toBeInstanceOf(RangeError);
    expect(error?.message).toBe("A routine id must be a UUID");
    expect(fake.requestCount).toBe(0);
  });

  it("should name the action and the code only when the read fails", async () => {
    const fake = installRoutinesFake(server);
    fake.failWith("57014");

    const error = await rejectionOf(getRoutine(createTestClient(), ROUTINE_ID));

    expect(error?.message).toBe("Could not load your routine (57014)");
    expect(textOf(error)).not.toContain(RECOGNISABLE_ROUTINE_EXERCISE_NAME);
  });
});
