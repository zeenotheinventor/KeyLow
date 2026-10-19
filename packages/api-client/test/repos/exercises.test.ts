import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { getExercise, searchExercises } from "../../src/repos/exercises";
import { createTestClient } from "../createTestClient";
import {
  GLOBAL_EXERCISE_ID,
  OWN_EXERCISE_ID,
  RECOGNISABLE_EXERCISE_NAME,
  exerciseRow,
  globalExerciseRow,
  installExercisesFake,
} from "../support/exercises";

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

describe("searchExercises", () => {
  it("should match the trimmed query anywhere in the name, ignoring case", async () => {
    const fake = installExercisesFake(server);

    await searchExercises(createTestClient(), "  Raise ");

    expect(fake.reads[0]?.searchParams.get("name")).toBe("ilike.%Raise%");
  });

  it.each([
    ["a percent sign", "50%", "ilike.%50\\%%"],
    ["an underscore", "lean_away", "ilike.%lean\\_away%"],
    ["a backslash", "a\\b", "ilike.%a\\\\b%"],
    ["all three", "%_\\", "ilike.%\\%\\_\\\\%"],
  ])("should escape %s so it matches literally", async (_label, query, expected) => {
    const fake = installExercisesFake(server);

    await searchExercises(createTestClient(), query);

    expect(fake.reads[0]?.searchParams.get("name")).toBe(expected);
  });

  it("should never send an asterisk, which PostgREST turns into the any-length wildcard", async () => {
    const fake = installExercisesFake(server);

    await searchExercises(createTestClient(), "5*3");

    expect(fake.reads[0]?.searchParams.get("name")).toBe("ilike.%5_3%");
  });

  it("should read live exercises only", async () => {
    const fake = installExercisesFake(server);

    await searchExercises(createTestClient(), "raise");

    expect(fake.reads[0]?.searchParams.get("deleted_at")).toBe("is.null");
  });

  it("should put the caller's own exercises first, then the library by name", async () => {
    const fake = installExercisesFake(server);

    await searchExercises(createTestClient(), "raise");

    expect(fake.reads[0]?.searchParams.get("order")).toBe("owner_id.asc.nullslast,name.asc,id.asc");
  });

  it("should read each exercise's primary and secondary muscles only, not its assisting ones", async () => {
    const fake = installExercisesFake(server);

    await searchExercises(createTestClient(), "raise");

    const url = fake.reads[0];
    expect(url?.searchParams.get("select")).toBe(
      "id,name,equipment,mechanic,source,exercise_muscles(muscle_id,role,weight)",
    );
    expect(url?.searchParams.get("exercise_muscles.role")).toBe("in.(primary,secondary)");
  });

  it("should embed the muscles without !inner, so the role filter can never drop the exercise itself", async () => {
    const fake = installExercisesFake(server);

    await searchExercises(createTestClient(), "raise");

    expect(fake.reads[0]?.searchParams.get("select")).not.toContain("!inner");
  });

  it("should ask for 25 exercises unless told otherwise, and keep a limit between 1 and 50", async () => {
    const fake = installExercisesFake(server);
    const client = createTestClient();

    await searchExercises(client, "raise");
    await searchExercises(client, "raise", { limit: 10 });
    await searchExercises(client, "raise", { limit: 500 });
    await searchExercises(client, "raise", { limit: 0 });

    expect(fake.reads.map((url) => url.searchParams.get("limit"))).toEqual(["25", "10", "50", "1"]);
  });

  it("should make no request for a query shorter than 2 characters once trimmed", async () => {
    const fake = installExercisesFake(server);
    const client = createTestClient();

    expect(await searchExercises(client, " s ")).toEqual([]);
    expect(await searchExercises(client, "")).toEqual([]);
    expect(fake.requestCount).toBe(0);
  });

  it("should give each exercise with its primary and secondary muscle ids for the row's chips, in the database's order", async () => {
    installExercisesFake(server, {
      rows: [
        exerciseRow({
          name: "Lean-away cable raise",
          exercise_muscles: [
            { muscle_id: "traps_upper", role: "secondary", weight: 0.5 },
            { muscle_id: "delt_side", role: "primary", weight: 1 },
          ],
        }),
        globalExerciseRow(),
      ],
    });

    const exercises = await searchExercises(createTestClient(), "raise");

    expect(exercises).toStrictEqual([
      {
        id: OWN_EXERCISE_ID,
        name: "Lean-away cable raise",
        equipment: "cable",
        mechanic: "isolation",
        source: "user",
        primary_muscles: ["delt_side"],
        secondary_muscles: ["traps_upper"],
      },
      {
        id: GLOBAL_EXERCISE_ID,
        name: "Cable lateral raise",
        equipment: "cable",
        mechanic: "isolation",
        source: "free_exercise_db",
        primary_muscles: ["delt_side"],
        secondary_muscles: [],
      },
    ]);
  });

  it("should list the stronger muscles of a role first, then by the muscle list", async () => {
    installExercisesFake(server, {
      rows: [
        exerciseRow({
          exercise_muscles: [
            { muscle_id: "triceps", role: "secondary", weight: 0.5 },
            { muscle_id: "chest_upper", role: "secondary", weight: 0.6 },
            { muscle_id: "delt_front", role: "secondary", weight: 0.5 },
            { muscle_id: "chest_lower", role: "primary", weight: 1 },
          ],
        }),
      ],
    });

    const [exercise] = await searchExercises(createTestClient(), "press");

    expect(exercise?.secondary_muscles).toEqual(["chest_upper", "delt_front", "triceps"]);
  });

  it("should throw an error naming the action and the code only", async () => {
    const fake = installExercisesFake(server);
    fake.failReadsWith("XX000");

    const error = await rejectionOf(
      searchExercises(createTestClient(), RECOGNISABLE_EXERCISE_NAME),
    );

    expect(error?.message).toBe("Could not search the exercises (XX000)");
    expect(error?.cause).toEqual({ code: "XX000" });
    expect(textOf(error)).not.toContain(RECOGNISABLE_EXERCISE_NAME);
  });

  it("should name the row and the field, never the value, when a row has an unexpected shape", async () => {
    installExercisesFake(server, {
      rows: [exerciseRow({ equipment: RECOGNISABLE_EXERCISE_NAME })],
    });

    const error = await rejectionOf(searchExercises(createTestClient(), "raise"));

    expect(error?.message).toContain("equipment");
    expect(textOf(error)).not.toContain(RECOGNISABLE_EXERCISE_NAME);
  });
});

describe("getExercise", () => {
  it("should read one live exercise by its id", async () => {
    const fake = installExercisesFake(server, { rows: [exerciseRow()] });

    await getExercise(createTestClient(), OWN_EXERCISE_ID);

    const url = fake.reads[0];
    expect(url?.searchParams.get("id")).toBe(`eq.${OWN_EXERCISE_ID}`);
    expect(url?.searchParams.get("deleted_at")).toBe("is.null");
    expect(url?.searchParams.get("select")).toBe(
      "id,name,equipment,mechanic,source,exercise_muscles(muscle_id,role,weight)",
    );
    expect(url?.searchParams.has("exercise_muscles.role")).toBe(false);
  });

  it("should give the row with its full muscle map in the order of the muscle list", async () => {
    installExercisesFake(server, {
      rows: [
        exerciseRow({
          exercise_muscles: [
            { muscle_id: "forearms", role: "stabiliser", weight: 0.2 },
            { muscle_id: "traps_upper", role: "secondary", weight: 0.5 },
            { muscle_id: "delt_side", role: "primary", weight: 1 },
          ],
        }),
      ],
    });

    const exercise = await getExercise(createTestClient(), OWN_EXERCISE_ID);

    expect(exercise).toStrictEqual({
      id: OWN_EXERCISE_ID,
      name: RECOGNISABLE_EXERCISE_NAME,
      equipment: "cable",
      mechanic: "isolation",
      source: "user",
      muscles: [
        { muscle_id: "delt_side", role: "primary", weight: 1 },
        { muscle_id: "traps_upper", role: "secondary", weight: 0.5 },
        { muscle_id: "forearms", role: "stabiliser", weight: 0.2 },
      ],
    });
  });

  it("should give null for an exercise that is not visible, archived or does not exist, which look the same", async () => {
    installExercisesFake(server, { rows: [] });

    expect(await getExercise(createTestClient(), OWN_EXERCISE_ID)).toBeNull();
  });

  it("should throw a RangeError before any request when the id is not a UUID", async () => {
    const fake = installExercisesFake(server);

    const error = await rejectionOf(getExercise(createTestClient(), "not-a-uuid"));

    expect(error).toBeInstanceOf(RangeError);
    expect(fake.requestCount).toBe(0);
  });

  it("should throw an error naming the action and the code only", async () => {
    const fake = installExercisesFake(server);
    fake.failReadsWith("XX000");

    const error = await rejectionOf(getExercise(createTestClient(), OWN_EXERCISE_ID));

    expect(error?.message).toBe("Could not load the exercise (XX000)");
    expect(error?.cause).toEqual({ code: "XX000" });
    expect(textOf(error)).not.toContain(RECOGNISABLE_EXERCISE_NAME);
  });

  it("should refuse a muscle map with no primary muscle, naming no value", async () => {
    installExercisesFake(server, {
      rows: [
        exerciseRow({
          name: RECOGNISABLE_EXERCISE_NAME,
          exercise_muscles: [{ muscle_id: "delt_side", role: "secondary", weight: 0.5 }],
        }),
      ],
    });

    const error = await rejectionOf(getExercise(createTestClient(), OWN_EXERCISE_ID));

    expect(error).toBeInstanceOf(Error);
    expect(textOf(error)).not.toContain(RECOGNISABLE_EXERCISE_NAME);
  });
});
