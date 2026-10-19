import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { ExerciseRuleError } from "../../src/errors";
import { archiveExercise, saveExercise } from "../../src/repos/exerciseWrites";
import { createTestClient } from "../createTestClient";
import {
  GLOBAL_EXERCISE_ID,
  OWN_EXERCISE_ID,
  RECOGNISABLE_EXERCISE_NAME,
  exerciseRow,
  globalExerciseRow,
  installExercisesFake,
} from "../support/exercises";

import type { CustomExerciseDraft } from "@keylow/core/training";

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

const draft = (overrides: Partial<CustomExerciseDraft> = {}): CustomExerciseDraft => ({
  name: `  ${RECOGNISABLE_EXERCISE_NAME}  `,
  equipment: "cable",
  muscles: [
    { muscle_id: "delt_side", role: "primary" },
    { muscle_id: "traps_upper", role: "secondary" },
  ],
  ...overrides,
});

describe("saveExercise", () => {
  it("should create an exercise with a null id and send the cleaned draft as save_exercise reads it", async () => {
    const fake = installExercisesFake(server, { rows: [exerciseRow()] });

    await saveExercise(createTestClient(), { draft: draft() });

    expect(fake.saves).toEqual([
      {
        p_exercise_id: null,
        p_exercise: { name: RECOGNISABLE_EXERCISE_NAME, equipment: "cable", mechanic: "isolation" },
        p_muscles: [
          { muscle_id: "delt_side", role: "primary", weight: 1 },
          { muscle_id: "traps_upper", role: "secondary", weight: 0.5 },
        ],
      },
    ]);
  });

  it("should derive compound from two primary muscles", async () => {
    const fake = installExercisesFake(server, { rows: [exerciseRow()] });

    await saveExercise(createTestClient(), {
      draft: draft({
        muscles: [
          { muscle_id: "quads", role: "primary" },
          { muscle_id: "glute_max", role: "primary" },
        ],
      }),
    });

    expect(fake.saves).toMatchObject([{ p_exercise: { mechanic: "compound" } }]);
  });

  it("should edit an exercise by its id", async () => {
    const fake = installExercisesFake(server, { rows: [exerciseRow()] });

    await saveExercise(createTestClient(), { id: OWN_EXERCISE_ID, draft: draft() });

    expect(fake.saves).toMatchObject([{ p_exercise_id: OWN_EXERCISE_ID }]);
  });

  it("should resolve to the exercise as stored, read back after the save", async () => {
    const fake = installExercisesFake(server, { rows: [exerciseRow({ name: "As stored" })] });

    const saved = await saveExercise(createTestClient(), { draft: draft() });

    expect(saved).toMatchObject({ id: OWN_EXERCISE_ID, name: "As stored" });
    expect(fake.reads[0]?.searchParams.get("id")).toBe(`eq.${OWN_EXERCISE_ID}`);
  });

  it("should throw a RangeError before any request when the draft breaks a rule, naming the rules and no value", async () => {
    const fake = installExercisesFake(server);

    const error = await rejectionOf(
      saveExercise(createTestClient(), {
        draft: draft({ name: "  ", muscles: [{ muscle_id: "delt_side", role: "secondary" }] }),
      }),
    );

    expect(error).toBeInstanceOf(RangeError);
    expect(error?.message).toBe(
      "The exercise is not valid at name (name_blank), muscles (primary_missing)",
    );
    expect(fake.requestCount).toBe(0);
  });

  it("should refuse an exercise with no primary muscle before the request, not rely on the trigger", async () => {
    const fake = installExercisesFake(server);

    const error = await rejectionOf(
      saveExercise(createTestClient(), {
        draft: draft({ muscles: [{ muscle_id: "traps_upper", role: "stabiliser" }] }),
      }),
    );

    expect(error).toBeInstanceOf(RangeError);
    expect(fake.saves).toHaveLength(0);
  });

  it("should throw a RangeError before any request when the id is not a UUID", async () => {
    const fake = installExercisesFake(server);

    const error = await rejectionOf(
      saveExercise(createTestClient(), { id: "not-a-uuid", draft: draft() }),
    );

    expect(error).toBeInstanceOf(RangeError);
    expect(fake.requestCount).toBe(0);
  });

  it("should refuse to edit a global exercise with the typed global_exercise rule, not a database message", async () => {
    const fake = installExercisesFake(server, { rows: [globalExerciseRow()] });
    fake.failSaveWith("P0002", "the exercise does not exist or is not yours");

    const error = await rejectionOf(
      saveExercise(createTestClient(), { id: GLOBAL_EXERCISE_ID, draft: draft() }),
    );

    expect(error).toBeInstanceOf(ExerciseRuleError);
    expect(error).toMatchObject({ rule: "global_exercise" });
    expect(error?.message).toBe("Could not save the exercise (global_exercise)");
  });

  it("should fail with the code P0002 for an exercise that is not a global one, as the database does", async () => {
    const fake = installExercisesFake(server, { rows: [] });
    fake.failSaveWith("P0002", "the exercise does not exist or is not yours");

    const error = await rejectionOf(
      saveExercise(createTestClient(), { id: OWN_EXERCISE_ID, draft: draft() }),
    );

    expect(error).not.toBeInstanceOf(ExerciseRuleError);
    expect(error?.message).toBe("Could not save the exercise (P0002)");
    expect(error?.cause).toEqual({ code: "P0002" });
  });

  it("should name the action and the code only when the database refuses, with no name from the draft in it", async () => {
    const fake = installExercisesFake(server);
    fake.failSaveWith("23514");

    const error = await rejectionOf(saveExercise(createTestClient(), { draft: draft() }));

    expect(error?.message).toBe("Could not save the exercise (23514)");
    expect(error?.cause).toEqual({ code: "23514" });
    expect(textOf(error)).not.toContain(RECOGNISABLE_EXERCISE_NAME);
  });

  it("should keep the name out of the error when the connection is down", async () => {
    const fake = installExercisesFake(server);
    fake.goOffline();

    const error = await rejectionOf(saveExercise(createTestClient(), { draft: draft() }));

    expect(error).toBeInstanceOf(Error);
    expect(textOf(error)).not.toContain(RECOGNISABLE_EXERCISE_NAME);
  });

  it("should fail with the action when the saved exercise cannot be read back", async () => {
    installExercisesFake(server, { rows: [] });

    const error = await rejectionOf(saveExercise(createTestClient(), { draft: draft() }));

    expect(error?.message).toBe("Could not load the exercise after saving it");
  });
});

describe("archiveExercise", () => {
  it("should soft delete the exercise by setting deleted_at, touching no other column", async () => {
    const fake = installExercisesFake(server);

    await archiveExercise(createTestClient(), OWN_EXERCISE_ID);

    expect(fake.archives).toHaveLength(1);
    expect(fake.archives[0]?.url.searchParams.get("id")).toBe(`eq.${OWN_EXERCISE_ID}`);
    const body = fake.archives[0]?.body;
    expect(Object.keys(body ?? {})).toEqual(["deleted_at"]);
    expect(JSON.stringify(body)).toMatch(/^\{"deleted_at":"\d{4}-\d{2}-\d{2}T[\d:.]+Z"\}$/);
  });

  it("should throw a RangeError before any request when the id is not a UUID", async () => {
    const fake = installExercisesFake(server);

    const error = await rejectionOf(archiveExercise(createTestClient(), "not-a-uuid"));

    expect(error).toBeInstanceOf(RangeError);
    expect(fake.requestCount).toBe(0);
  });

  it("should refuse a global exercise with the typed global_exercise rule", async () => {
    const fake = installExercisesFake(server, { rows: [globalExerciseRow()], archived: [] });

    const error = await rejectionOf(archiveExercise(createTestClient(), GLOBAL_EXERCISE_ID));

    expect(error).toBeInstanceOf(ExerciseRuleError);
    expect(error?.message).toBe("Could not archive the exercise (global_exercise)");
    expect(fake.archives).toHaveLength(1);
  });

  it("should fail with the code PGRST116 for an exercise the caller does not own that is not a global one", async () => {
    installExercisesFake(server, { rows: [], archived: [] });

    const error = await rejectionOf(archiveExercise(createTestClient(), OWN_EXERCISE_ID));

    expect(error).not.toBeInstanceOf(ExerciseRuleError);
    expect(error?.message).toBe("Could not archive the exercise (PGRST116)");
  });

  it("should name the action and the code only when the database refuses", async () => {
    const fake = installExercisesFake(server);
    fake.failArchiveWith("XX000");

    const error = await rejectionOf(archiveExercise(createTestClient(), OWN_EXERCISE_ID));

    expect(error?.message).toBe("Could not archive the exercise (XX000)");
    expect(error?.cause).toEqual({ code: "XX000" });
    expect(textOf(error)).not.toContain(RECOGNISABLE_EXERCISE_NAME);
  });
});
