import { SUGGEST_PARAMS_V2 } from "@keylow/core/training";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import {
  acceptSuggestion,
  listAcceptedSuggestions,
  undoAcceptedSuggestion,
} from "../../src/repos/acceptedSuggestions";
import { createTestClient } from "../createTestClient";
import {
  INCLINE_DUMBBELL_PRESS_ID,
  LEGS_DAY_ID,
  RECOGNISABLE_SUGGESTION_TEXT,
  THURSDAY,
  acceptedRow,
  goldenAcceptedExercises,
  goldenLibrary,
  goldenSuggestion,
  installAcceptedSuggestionsFake,
} from "../support/acceptedSuggestions";

import type { AcceptSuggestion } from "../../src/repos/acceptedSuggestions";

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

const WEEK_START = "2026-10-12";
const WEEK_END = "2026-10-18";
const NOT_A_ROUTINE_DAY = "00000003-0000-4000-8000-0000000000ff";

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

const goldenAccept = (overrides: Partial<AcceptSuggestion> = {}): AcceptSuggestion => ({
  suggestion: goldenSuggestion,
  library: goldenLibrary,
  localDate: THURSDAY,
  routineDayId: LEGS_DAY_ID,
  ...overrides,
});

describe("the golden suggestion", () => {
  it("should add 3 sets of incline dumbbell press to Thursday's Legs, as the agreement says", () => {
    expect(goldenAcceptedExercises).toHaveLength(1);
    expect(goldenAcceptedExercises[0]).toMatchObject({
      exercise_id: INCLINE_DUMBBELL_PRESS_ID,
      target_sets: 3,
      target_rir: 2,
    });
  });
});

describe("listAcceptedSuggestions", () => {
  it("should ask for the live rows with a local date from the Monday to the Sunday, in date order", async () => {
    const fake = installAcceptedSuggestionsFake(server);

    await listAcceptedSuggestions(createTestClient(), WEEK_START);

    const url = fake.reads[0];
    expect(url?.searchParams.get("deleted_at")).toBe("is.null");
    expect(url?.searchParams.getAll("local_date")).toEqual([
      `gte.${WEEK_START}`,
      `lte.${WEEK_END}`,
    ]);
    expect(url?.searchParams.get("order")).toBe("local_date.asc");
  });

  it("should resolve to the live rows of the week, each with its id and its parsed suggestion", async () => {
    const thursday = acceptedRow();
    installAcceptedSuggestionsFake(server, {
      rows: [
        thursday,
        acceptedRow({ local_date: "2026-10-19" }),
        acceptedRow({ local_date: "2026-10-16", deleted_at: "2026-10-14T10:00:00+00:00" }),
      ],
    });

    const read = await listAcceptedSuggestions(createTestClient(), WEEK_START);

    expect(read.skipped).toEqual([]);
    expect(read.suggestions).toHaveLength(1);
    expect(read.suggestions[0]).toMatchObject({
      id: thursday["id"],
      local_date: THURSDAY,
      routine_day_id: LEGS_DAY_ID,
      params_version: SUGGEST_PARAMS_V2.version,
    });
    expect(read.suggestions[0]?.exercises[0]).toMatchObject({
      exercise_id: INCLINE_DUMBBELL_PRESS_ID,
      target_sets: 3,
    });
  });

  it("should resolve to nothing for a week with no accepted suggestion", async () => {
    installAcceptedSuggestionsFake(server);

    expect(await listAcceptedSuggestions(createTestClient(), WEEK_START)).toEqual({
      suggestions: [],
      skipped: [],
    });
  });

  it("should skip a row that does not parse and report its id and field paths, never a value", async () => {
    const good = acceptedRow({ local_date: "2026-10-14" });
    const broken = acceptedRow({
      exercises: [
        {
          ...goldenAcceptedExercises[0],
          target_sets: 99,
          exercise: { ...goldenAcceptedExercises[0]?.exercise, name: RECOGNISABLE_SUGGESTION_TEXT },
        },
      ],
    });
    installAcceptedSuggestionsFake(server, { rows: [good, broken] });

    const read = await listAcceptedSuggestions(createTestClient(), WEEK_START);

    expect(read.suggestions.map(({ id }) => id)).toEqual([good["id"]]);
    expect(read.skipped).toEqual([{ id: broken["id"], fieldPaths: ["exercises.0.target_sets"] }]);
    expect(JSON.stringify(read.skipped)).not.toContain(RECOGNISABLE_SUGGESTION_TEXT);
    expect(JSON.stringify(read.skipped)).not.toContain("99");
  });

  it("should throw a RangeError that names the rule for a week that is not a Monday, before any request", async () => {
    const fake = installAcceptedSuggestionsFake(server);

    const error = await rejectionOf(listAcceptedSuggestions(createTestClient(), "2026-10-13"));

    expect(error).toBeInstanceOf(RangeError);
    expect(error?.message).toBe("A training week must start on a Monday");
    expect(fake.reads).toEqual([]);
  });

  it("should state the action and the database code, and nothing the database said", async () => {
    const fake = installAcceptedSuggestionsFake(server);
    fake.failReadsWith("42501");

    const error = await rejectionOf(listAcceptedSuggestions(createTestClient(), WEEK_START));

    expect(error?.message).toBe("Could not load your accepted suggestions (42501)");
    expect(error?.cause).toEqual({ code: "42501" });
    expect(textOf(error)).not.toContain(RECOGNISABLE_SUGGESTION_TEXT);
  });
});

describe("acceptSuggestion", () => {
  it("should store one row for the day with the exercises, the reasons and the params version, and resolve to it", async () => {
    const fake = installAcceptedSuggestionsFake(server);

    const stored = await acceptSuggestion(createTestClient(), goldenAccept());

    expect(fake.inserts).toHaveLength(1);
    expect(fake.inserts[0]).toMatchObject({
      local_date: THURSDAY,
      routine_day_id: LEGS_DAY_ID,
      params_version: SUGGEST_PARAMS_V2.version,
    });
    expect(fake.inserts[0]?.["exercises"]).toEqual([
      expect.objectContaining({
        exercise_id: INCLINE_DUMBBELL_PRESS_ID,
        target_sets: 3,
        target_rir: 2,
        rep_min: 8,
        rep_max: 10,
      }),
    ]);
    expect(fake.inserts[0]?.["reasons"]).toMatchObject({
      picks: [
        {
          exercise_id: INCLINE_DUMBBELL_PRESS_ID,
          reasons: [expect.objectContaining({ muscle_id: "chest_upper", priority: 3 })],
        },
      ],
    });
    expect(fake.liveRows()).toHaveLength(1);
    expect(stored).toMatchObject({
      id: fake.liveRows()[0]?.["id"],
      local_date: THURSDAY,
      routine_day_id: LEGS_DAY_ID,
    });
  });

  it("should store the exercises the suggestion added and none it kept: those are the plan's already", async () => {
    const fake = installAcceptedSuggestionsFake(server);

    await acceptSuggestion(createTestClient(), goldenAccept());

    expect(goldenSuggestion.exercises.length).toBeGreaterThan(goldenAcceptedExercises.length);
    expect(fake.inserts[0]?.["exercises"]).toHaveLength(goldenAcceptedExercises.length);
  });

  it("should store a suggestion that stands alone, with no routine day", async () => {
    const fake = installAcceptedSuggestionsFake(server);

    const stored = await acceptSuggestion(createTestClient(), goldenAccept({ routineDayId: null }));

    expect(fake.inserts[0]).toMatchObject({ routine_day_id: null });
    expect(stored.routine_day_id).toBeNull();
  });

  it("should soft delete the day's live row first, so accepting again replaces it and leaves one live row", async () => {
    const earlier = acceptedRow();
    const otherDay = acceptedRow({ local_date: "2026-10-17" });
    const fake = installAcceptedSuggestionsFake(server, { rows: [earlier, otherDay] });

    const stored = await acceptSuggestion(createTestClient(), goldenAccept());

    expect(fake.updates).toHaveLength(1);
    expect(fake.updates[0]?.url.searchParams.get("local_date")).toBe(`eq.${THURSDAY}`);
    expect(fake.updates[0]?.url.searchParams.get("deleted_at")).toBe("is.null");
    expect(earlier["deleted_at"]).not.toBeNull();
    expect(otherDay["deleted_at"]).toBeNull();
    expect(fake.liveRows().map((row) => row["id"])).toEqual([otherDay["id"], stored.id]);
  });

  it("should try once more when another device took the day in between, and soft delete that row too", async () => {
    const fake = installAcceptedSuggestionsFake(server);
    fake.failNextInserts("23505");

    const stored = await acceptSuggestion(createTestClient(), goldenAccept());

    expect(fake.inserts).toHaveLength(2);
    expect(fake.updates).toHaveLength(2);
    expect(fake.liveRows().map((row) => row["id"])).toEqual([stored.id]);
  });

  it("should give up after one retry, with the action and the code only", async () => {
    const fake = installAcceptedSuggestionsFake(server);
    fake.failNextInserts("23505", "23505");

    const error = await rejectionOf(acceptSuggestion(createTestClient(), goldenAccept()));

    expect(error?.message).toBe("Could not accept the suggestion (23505)");
    expect(error?.cause).toEqual({ code: "23505" });
    expect(fake.inserts).toHaveLength(2);
  });

  it("should refuse a routine day that is not the caller's with the code of the policy, and keep the earlier row", async () => {
    const earlier = acceptedRow();
    const fake = installAcceptedSuggestionsFake(server, { rows: [earlier] });
    fake.failNextInserts("42501");

    const error = await rejectionOf(
      acceptSuggestion(createTestClient(), goldenAccept({ routineDayId: NOT_A_ROUTINE_DAY })),
    );

    expect(error?.message).toBe("Could not accept the suggestion (42501)");
    expect(textOf(error)).not.toContain(RECOGNISABLE_SUGGESTION_TEXT);
    expect(fake.inserts).toHaveLength(1);
    expect(earlier["deleted_at"]).toBeNull();
    expect(fake.liveRows()).toHaveLength(1);
  });

  it("should put the earlier row back when the insert fails for another reason", async () => {
    const earlier = acceptedRow();
    const fake = installAcceptedSuggestionsFake(server, { rows: [earlier] });
    fake.failNextInserts("57014");

    const error = await rejectionOf(acceptSuggestion(createTestClient(), goldenAccept()));

    expect(error?.message).toBe("Could not accept the suggestion (57014)");
    expect(earlier["deleted_at"]).toBeNull();
  });

  it("should refuse a suggestion with nothing to add, before any request", async () => {
    const fake = installAcceptedSuggestionsFake(server);

    const error = await rejectionOf(
      acceptSuggestion(
        createTestClient(),
        goldenAccept({
          suggestion: {
            kind: "nothing",
            why: "priorities_covered",
            skipped: [],
            no_room: null,
          },
        }),
      ),
    );

    expect(error).toBeInstanceOf(RangeError);
    expect(error?.message).toBe("A suggestion with nothing to add cannot be accepted");
    expect(fake.inserts).toEqual([]);
    expect(fake.updates).toEqual([]);
  });

  it.each([
    ["a day that is not a calendar day", { localDate: "2026-10-32" }],
    ["a day written another way", { localDate: "15/10/2026" }],
    ["a routine day id that is not a UUID", { routineDayId: "legs" }],
  ])(
    "should refuse %s before any request, with a RangeError that quotes nothing",
    async (_name, overrides) => {
      const fake = installAcceptedSuggestionsFake(server);

      const error = await rejectionOf(
        acceptSuggestion(createTestClient(), goldenAccept(overrides)),
      );

      expect(error).toBeInstanceOf(RangeError);
      expect(textOf(error)).not.toContain("2026-10-32");
      expect(textOf(error)).not.toContain("legs");
      expect(fake.inserts).toEqual([]);
      expect(fake.updates).toEqual([]);
    },
  );

  it("should refuse a suggested exercise the library lacks, before any request, without naming it", async () => {
    const fake = installAcceptedSuggestionsFake(server);

    const error = await rejectionOf(
      acceptSuggestion(createTestClient(), goldenAccept({ library: [] })),
    );

    expect(error).toBeInstanceOf(RangeError);
    expect(textOf(error)).not.toContain("Incline");
    expect(fake.inserts).toEqual([]);
  });

  it("should never carry an exercise, a muscle or a figure from the suggestion in an error", async () => {
    const fake = installAcceptedSuggestionsFake(server);
    fake.failNextInserts("23514");

    const error = await rejectionOf(acceptSuggestion(createTestClient(), goldenAccept()));

    const text = textOf(error);
    for (const forbidden of [
      RECOGNISABLE_SUGGESTION_TEXT,
      "Incline Dumbbell Press",
      "chest_upper",
      INCLINE_DUMBBELL_PRESS_ID,
    ]) {
      expect(text).not.toContain(forbidden);
    }
  });
});

describe("undoAcceptedSuggestion", () => {
  it("should soft delete the live row, so it is no longer live", async () => {
    const accepted = acceptedRow();
    const fake = installAcceptedSuggestionsFake(server, { rows: [accepted] });

    await undoAcceptedSuggestion(createTestClient(), String(accepted["id"]));

    expect(fake.updates[0]?.url.searchParams.get("id")).toBe(`eq.${String(accepted["id"])}`);
    expect(fake.updates[0]?.url.searchParams.get("deleted_at")).toBe("is.null");
    expect(accepted["deleted_at"]).not.toBeNull();
    expect(fake.liveRows()).toEqual([]);
  });

  it("should change nothing for a row that is already undone", async () => {
    const undone = acceptedRow({ deleted_at: "2026-10-14T10:00:00+00:00" });
    installAcceptedSuggestionsFake(server, { rows: [undone] });

    await expect(
      undoAcceptedSuggestion(createTestClient(), String(undone["id"])),
    ).resolves.toBeUndefined();

    expect(undone["deleted_at"]).toBe("2026-10-14T10:00:00+00:00");
  });

  it("should fail with PGRST116 for a row that does not exist or is not the caller's", async () => {
    installAcceptedSuggestionsFake(server);

    const error = await rejectionOf(
      undoAcceptedSuggestion(createTestClient(), "66666666-6666-4666-8666-0000000000ff"),
    );

    expect(error?.message).toBe("Could not undo adding the suggestion (PGRST116)");
  });

  it("should throw a RangeError for an id that is not a UUID, before any request", async () => {
    const fake = installAcceptedSuggestionsFake(server);

    const error = await rejectionOf(undoAcceptedSuggestion(createTestClient(), "not-an-id"));

    expect(error).toBeInstanceOf(RangeError);
    expect(textOf(error)).not.toContain("not-an-id");
    expect(fake.updates).toEqual([]);
  });

  it("should state the action and the database code, and nothing the database said", async () => {
    const accepted = acceptedRow();
    const fake = installAcceptedSuggestionsFake(server, { rows: [accepted] });
    fake.failUpdatesWith("42501");

    const error = await rejectionOf(
      undoAcceptedSuggestion(createTestClient(), String(accepted["id"])),
    );

    expect(error?.message).toBe("Could not undo adding the suggestion (42501)");
    expect(error?.cause).toEqual({ code: "42501" });
    expect(textOf(error)).not.toContain(RECOGNISABLE_SUGGESTION_TEXT);
  });
});
