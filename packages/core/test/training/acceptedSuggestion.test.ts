import { describe, expect, it } from "vitest";

import { acceptedExercise } from "./acceptedSuggestions";
import { curl, curlMuscles, legs } from "./plans";
import { acceptedSuggestionSchema } from "../../src/schemas";
import { parseAcceptedSuggestion } from "../../src/training";

/*
 * The shape of a stored `accepted_suggestions` row (ADR 0005, Amendment 4; KEY-402). The table checks
 * only that `exercises` is an array of 1 to 30 objects and `reasons` an object, so this schema owns the
 * rest, and a row that does not parse is reported by its id and the paths of its fields, never a value.
 */

const ROW_ID = "00000009-0000-4000-8000-000000000001";

const stored = () => ({
  local_date: "2026-10-15",
  routine_day_id: legs.id,
  exercises: [acceptedExercise(curl, curlMuscles, 3, 2, 5)],
  reasons: {
    picks: [
      {
        exercise_id: curl.id,
        reasons: [
          {
            muscle_id: "biceps",
            priority: 3,
            weekly_sets: 4.8,
            mav_low: 10,
            heat: 0.13,
            score: 18.79,
          },
        ],
      },
    ],
  },
  params_version: "keylow-training-v1",
});

const row = (overrides: Record<string, unknown> = {}): Record<string, unknown> => ({
  id: ROW_ID,
  user_id: "00000009-0000-4000-8000-0000000000aa",
  deleted_at: null,
  created_at: "2026-10-14T12:00:00.000Z",
  ...stored(),
  ...overrides,
});

const firstExercise = () => {
  const [exercise] = stored().exercises;
  if (exercise === undefined) {
    throw new Error("The stored suggestion has an exercise");
  }
  return exercise;
};

describe("acceptedSuggestionSchema", () => {
  it("should read a stored suggestion, and return it unchanged", () => {
    expect(acceptedSuggestionSchema.parse(stored())).toStrictEqual(stored());
  });

  it("should read a suggestion that stands alone", () => {
    expect(acceptedSuggestionSchema.safeParse({ ...stored(), routine_day_id: null }).success).toBe(
      true,
    );
  });

  it("should ignore the columns of the row that the projection does not read", () => {
    expect(acceptedSuggestionSchema.parse(row())).toStrictEqual(stored());
  });

  it.each<[string, Record<string, unknown>]>([
    ["no exercise", { exercises: [] }],
    [
      "31 exercises",
      {
        exercises: Array.from({ length: 31 }, (_, position) => ({ ...firstExercise(), position })),
      },
    ],
    ["a date that is not a day", { local_date: "2026-02-30" }],
    ["a date with a time", { local_date: "2026-10-15T12:00:00Z" }],
    ["a routine day that is not an id", { routine_day_id: "legs" }],
    ["a blank params version", { params_version: "" }],
    ["reasons that are a list", { reasons: [] }],
    [
      "reasons with a muscle that is not on the list",
      {
        reasons: {
          picks: [
            {
              exercise_id: curl.id,
              reasons: [
                {
                  muscle_id: "rotator_cuff",
                  priority: 3,
                  weekly_sets: 1,
                  mav_low: 10,
                  heat: 0,
                  score: 1,
                },
              ],
            },
          ],
        },
      },
    ],
    [
      "a reason with a number missing",
      {
        reasons: { picks: [{ exercise_id: curl.id, reasons: [{ muscle_id: "biceps" }] }] },
      },
    ],
  ])("should refuse %s", (_case, overrides) => {
    expect(acceptedSuggestionSchema.safeParse({ ...stored(), ...overrides }).success).toBe(false);
  });

  it.each<[string, Record<string, unknown>]>([
    ["target sets out of range", { target_sets: 21 }],
    ["target sets that are not whole", { target_sets: 2.5 }],
    ["a target RIR out of range", { target_rir: 11 }],
    ["a position below 0", { position: -1 }],
    [
      "an exercise detail taken from another exercise",
      {
        exercise: { ...firstExercise().exercise, id: legs.id },
      },
    ],
    [
      "a snapshot taken from another exercise",
      {
        snapshot: { ...firstExercise().snapshot, ref: legs.id },
      },
    ],
    ["a snapshot of a later version", { snapshot: { ...firstExercise().snapshot, version: 2 } }],
    ["a field the shape does not have", { note: "text" }],
  ])("should refuse an exercise with %s", (_case, overrides) => {
    expect(
      acceptedSuggestionSchema.safeParse({
        ...stored(),
        exercises: [{ ...firstExercise(), ...overrides }],
      }).success,
    ).toBe(false);
  });

  describe("drift in the reasons", () => {
    const reasonOf = (extra: Record<string, unknown>) => ({
      muscle_id: "biceps",
      priority: 3,
      weekly_sets: 4.8,
      mav_low: 10,
      heat: 0.13,
      score: 18.79,
      ...extra,
    });
    const reasonsWith = (reason: Record<string, unknown>) => ({
      picks: [{ exercise_id: curl.id, reasons: [reason] }],
    });

    it("should read a reason with the number of logged sets", () => {
      const reasons = reasonsWith(reasonOf({ logged_sets: 2 }));

      expect(acceptedSuggestionSchema.parse({ ...stored(), reasons }).reasons).toStrictEqual(
        reasons,
      );
    });

    it("should read a reason without the number of logged sets", () => {
      const reasons = reasonsWith(reasonOf({}));

      expect(acceptedSuggestionSchema.parse({ ...stored(), reasons }).reasons).toStrictEqual(
        reasons,
      );
    });

    it("should refuse a number of logged sets that is not a number", () => {
      const reasons = reasonsWith(reasonOf({ logged_sets: "2" }));

      expect(acceptedSuggestionSchema.safeParse({ ...stored(), reasons }).success).toBe(false);
    });

    it("should read a row whose reasons, picks and reasons carry a field this build does not know", () => {
      const reasons = {
        ...reasonsWith(reasonOf({ later_field: 1 })),
        later_field: 1,
      };
      const [pick] = reasons.picks;
      const drifted = { ...reasons, picks: [{ ...pick, later_field: 1 }] };

      expect(acceptedSuggestionSchema.safeParse({ ...stored(), reasons: drifted }).success).toBe(
        true,
      );
    });
  });

  describe("the rep range", () => {
    it("should read an exercise with a rep range, and without one", () => {
      const withRange = { ...firstExercise(), rep_min: 8, rep_max: 10 };

      expect(
        acceptedSuggestionSchema.parse({ ...stored(), exercises: [withRange] }).exercises,
      ).toStrictEqual([withRange]);
      expect(acceptedSuggestionSchema.safeParse(stored()).success).toBe(true);
    });

    it.each<[string, Record<string, unknown>]>([
      ["a lowest rep above the highest", { rep_min: 11, rep_max: 10 }],
      ["a rep out of range", { rep_min: 0, rep_max: 10 }],
      ["a rep that is not whole", { rep_min: 8.5, rep_max: 10 }],
    ])("should refuse %s", (_case, range) => {
      expect(
        acceptedSuggestionSchema.safeParse({
          ...stored(),
          exercises: [{ ...firstExercise(), ...range }],
        }).success,
      ).toBe(false);
    });
  });

  it("should refuse two exercises in one position", () => {
    const result = acceptedSuggestionSchema.safeParse({
      ...stored(),
      exercises: [firstExercise(), { ...firstExercise(), id: legs.id, exercise_id: legs.id }],
    });

    expect(result.success).toBe(false);
  });
});

describe("parseAcceptedSuggestion", () => {
  it("should give the suggestion of a row that parses", () => {
    expect(parseAcceptedSuggestion(row())).toStrictEqual({ ok: true, suggestion: stored() });
  });

  it("should report a row that does not parse by its id and the paths of its fields", () => {
    const broken = {
      ...firstExercise(),
      target_sets: 21,
      snapshot: {
        ...firstExercise().snapshot,
        muscles: [{ muscle_id: "rotator_cuff", role: "primary", weight: 1 }],
      },
    };

    expect(parseAcceptedSuggestion(row({ exercises: [broken], params_version: "" }))).toStrictEqual(
      {
        ok: false,
        id: ROW_ID,
        fieldPaths: [
          "exercises.0.target_sets",
          "exercises.0.snapshot.muscles.0.muscle_id",
          "params_version",
        ],
      },
    );
  });

  it("should report a field once however many rules it breaks", () => {
    const result = parseAcceptedSuggestion(row({ local_date: 42 }));

    expect(result).toStrictEqual({ ok: false, id: ROW_ID, fieldPaths: ["local_date"] });
  });

  it("should report no id when the row has none, or one that is not an id", () => {
    const withoutId = Object.fromEntries(
      Object.entries(row({ params_version: "" })).filter(([name]) => name !== "id"),
    );

    expect(parseAcceptedSuggestion(withoutId)).toMatchObject({ ok: false, id: null });
    expect(
      parseAcceptedSuggestion(row({ id: "my private note", params_version: "" })),
    ).toMatchObject({
      ok: false,
      id: null,
    });
  });

  it.each<[string, unknown]>([
    ["null", null],
    ["a string", "suggestion"],
    ["a list", [row()]],
  ])("should report %s as a row with no id and no field", (_case, value) => {
    expect(parseAcceptedSuggestion(value)).toStrictEqual({ ok: false, id: null, fieldPaths: [] });
  });

  it("should never carry a value of the row in what it reports", () => {
    const secret = "a private exercise name";
    const broken = {
      ...firstExercise(),
      exercise: { ...firstExercise().exercise, name: secret, equipment: secret },
      snapshot: { ...firstExercise().snapshot, name: secret, equipment: secret },
      note: secret,
    };
    const result = parseAcceptedSuggestion(
      row({ exercises: [broken], local_date: secret, reasons: { picks: secret }, extra: secret }),
    );

    expect(result.ok).toBe(false);
    expect(JSON.stringify(result)).not.toContain(secret);
  });
});
