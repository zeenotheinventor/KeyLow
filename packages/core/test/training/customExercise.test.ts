import { describe, expect, it } from "vitest";

import { exerciseMusclesSchema } from "../../src/schemas";
import {
  CUSTOM_EXERCISE_ROLE_WEIGHTS,
  EQUIPMENT,
  MAX_EXERCISE_NAME_LENGTH,
  MUSCLE_IDS,
  customExerciseMechanic,
  customExerciseMuscles,
  customExercisePayload,
  validateCustomExerciseDraft,
} from "../../src/training";

import type { CustomExerciseDraft } from "../../src/training";

/*
 * The canvas `session · custom-exercise` form (ADR 0005, Amendment 1, `exercises`, `exercise_muscles` and
 * `save_exercise`): a name, an equipment chip and a role for each muscle. The canvas example is the
 * Lean-away cable raise, cable, side delts primary and upper traps secondary.
 */

const leanAwayCableRaise: CustomExerciseDraft = {
  name: "Lean-away cable raise",
  equipment: "cable",
  muscles: [
    { muscle_id: "delt_side", role: "primary" },
    { muscle_id: "traps_upper", role: "secondary" },
  ],
};

const RECOGNISABLE_NAME = "key389-recognisable-name";

const withDraft = (overrides: Partial<CustomExerciseDraft>): CustomExerciseDraft => ({
  ...leanAwayCableRaise,
  ...overrides,
});

/** The cleaned draft, or a thrown error so a test never reads past a refusal. */
const cleaned = (draft: CustomExerciseDraft) => {
  const result = validateCustomExerciseDraft(draft);
  if (!result.ok) {
    throw new Error("Expected a valid draft");
  }
  return result.value;
};

describe("CUSTOM_EXERCISE_ROLE_WEIGHTS", () => {
  it("should count a set in full for a primary muscle, half for a secondary and a fifth for an assisting one", () => {
    expect(CUSTOM_EXERCISE_ROLE_WEIGHTS).toStrictEqual({
      primary: 1,
      secondary: 0.5,
      stabiliser: 0.2,
    });
  });
});

describe("validateCustomExerciseDraft", () => {
  it("should accept the canvas example and give it back as it is", () => {
    expect(validateCustomExerciseDraft(leanAwayCableRaise)).toStrictEqual({
      ok: true,
      value: leanAwayCableRaise,
    });
  });

  it("should trim the name, as it is saved", () => {
    const result = validateCustomExerciseDraft(withDraft({ name: "  Lean-away cable raise \n" }));

    expect(result).toMatchObject({ ok: true, value: { name: "Lean-away cable raise" } });
  });

  it("should accept a name of exactly 200 characters, counted as code points", () => {
    const result = validateCustomExerciseDraft(withDraft({ name: "🏋".repeat(200) }));

    expect(result.ok).toBe(true);
  });

  it("should refuse a blank name", () => {
    expect(validateCustomExerciseDraft(withDraft({ name: " \t " }))).toStrictEqual({
      ok: false,
      problems: [{ field: "name", rule: "name_blank" }],
    });
  });

  it("should refuse a name of 201 characters", () => {
    const tooLong = "a".repeat(MAX_EXERCISE_NAME_LENGTH + 1);

    expect(validateCustomExerciseDraft(withDraft({ name: tooLong }))).toStrictEqual({
      ok: false,
      problems: [{ field: "name", rule: "name_too_long" }],
    });
  });

  it.each(EQUIPMENT)("should accept the equipment %s", (equipment) => {
    expect(validateCustomExerciseDraft(withDraft({ equipment })).ok).toBe(true);
  });

  it.each(["", "Cable", "trampoline"])("should refuse the equipment %j", (equipment) => {
    expect(validateCustomExerciseDraft(withDraft({ equipment }))).toStrictEqual({
      ok: false,
      problems: [{ field: "equipment", rule: "equipment_invalid" }],
    });
  });

  it("should refuse an exercise with no muscle", () => {
    expect(validateCustomExerciseDraft(withDraft({ muscles: [] }))).toStrictEqual({
      ok: false,
      problems: [{ field: "muscles", rule: "muscles_none" }],
    });
  });

  it("should refuse muscles with no primary", () => {
    const muscles = [
      { muscle_id: "delt_side", role: "secondary" },
      { muscle_id: "traps_upper", role: "stabiliser" },
    ];

    expect(validateCustomExerciseDraft(withDraft({ muscles }))).toStrictEqual({
      ok: false,
      problems: [{ field: "muscles", rule: "primary_missing" }],
    });
  });

  it("should refuse a muscle listed twice", () => {
    const muscles = [
      { muscle_id: "delt_side", role: "primary" },
      { muscle_id: "delt_side", role: "secondary" },
    ];

    expect(validateCustomExerciseDraft(withDraft({ muscles }))).toStrictEqual({
      ok: false,
      problems: [{ field: "muscles", rule: "muscle_repeated" }],
    });
  });

  it("should accept all 22 muscles", () => {
    const muscles = MUSCLE_IDS.map((muscle_id, index) => ({
      muscle_id,
      role: index === 0 ? "primary" : "stabiliser",
    }));

    expect(validateCustomExerciseDraft(withDraft({ muscles })).ok).toBe(true);
  });

  it("should refuse more than 22 muscles", () => {
    const muscles = [...MUSCLE_IDS, "delt_side"].map((muscle_id) => ({
      muscle_id,
      role: "primary",
    }));

    const result = validateCustomExerciseDraft(withDraft({ muscles }));

    expect(result.ok).toBe(false);
    expect(!result.ok && result.problems).toContainEqual({
      field: "muscles",
      rule: "muscles_too_many",
    });
  });

  it("should refuse a muscle that is not on the muscle list", () => {
    const muscles = [
      { muscle_id: "delt_side", role: "primary" },
      { muscle_id: "pinky", role: "secondary" },
    ];

    expect(validateCustomExerciseDraft(withDraft({ muscles }))).toStrictEqual({
      ok: false,
      problems: [{ field: "muscles", rule: "muscle_unknown" }],
    });
  });

  it("should refuse a role that is not primary, secondary or assisting", () => {
    const muscles = [
      { muscle_id: "delt_side", role: "primary" },
      { muscle_id: "traps_upper", role: "tertiary" },
    ];

    expect(validateCustomExerciseDraft(withDraft({ muscles }))).toStrictEqual({
      ok: false,
      problems: [{ field: "muscles", rule: "muscle_role_invalid" }],
    });
  });

  it("should report every problem at once, in the order of the form", () => {
    const result = validateCustomExerciseDraft({ name: "", equipment: "nope", muscles: [] });

    expect(result).toStrictEqual({
      ok: false,
      problems: [
        { field: "name", rule: "name_blank" },
        { field: "equipment", rule: "equipment_invalid" },
        { field: "muscles", rule: "muscles_none" },
      ],
    });
  });

  it("should never carry a name, an equipment or a muscle in an issue", () => {
    const result = validateCustomExerciseDraft({
      name: RECOGNISABLE_NAME.padEnd(MAX_EXERCISE_NAME_LENGTH + 1, "x"),
      equipment: RECOGNISABLE_NAME,
      muscles: [
        { muscle_id: RECOGNISABLE_NAME, role: RECOGNISABLE_NAME },
        { muscle_id: "delt_side", role: "secondary" },
        { muscle_id: "delt_side", role: "secondary" },
      ],
    });

    expect(result.ok).toBe(false);
    expect(JSON.stringify(result)).not.toContain(RECOGNISABLE_NAME);
    expect(JSON.stringify(result)).not.toContain("delt_side");
  });
});

describe("customExerciseMuscles", () => {
  it("should store the weights the canvas states: 1, 0.5 and 0.2", () => {
    const stored = customExerciseMuscles([
      { muscle_id: "delt_side", role: "primary" },
      { muscle_id: "traps_upper", role: "secondary" },
      { muscle_id: "forearms", role: "stabiliser" },
    ]);

    expect(stored).toStrictEqual([
      { muscle_id: "delt_side", role: "primary", weight: 1 },
      { muscle_id: "traps_upper", role: "secondary", weight: 0.5 },
      { muscle_id: "forearms", role: "stabiliser", weight: 0.2 },
    ]);
  });

  it("should give a map that the stored muscle map schema accepts", () => {
    const stored = customExerciseMuscles(cleaned(leanAwayCableRaise).muscles);

    expect(exerciseMusclesSchema.safeParse(stored).success).toBe(true);
  });
});

describe("customExerciseMechanic", () => {
  it("should derive isolation from one primary muscle, the canvas example", () => {
    expect(customExerciseMechanic([{ role: "primary" }, { role: "secondary" }])).toBe("isolation");
  });

  it("should derive compound from two primary muscles", () => {
    expect(customExerciseMechanic([{ role: "primary" }, { role: "primary" }])).toBe("compound");
  });

  it("should not count secondary or assisting muscles", () => {
    expect(
      customExerciseMechanic([
        { role: "primary" },
        { role: "secondary" },
        { role: "secondary" },
        { role: "stabiliser" },
      ]),
    ).toBe("isolation");
  });
});

describe("customExercisePayload", () => {
  const payload = customExercisePayload(cleaned(leanAwayCableRaise));

  it("should send the exercise with the name, the equipment and the derived mechanic only", () => {
    expect(payload.p_exercise).toStrictEqual({
      name: "Lean-away cable raise",
      equipment: "cable",
      mechanic: "isolation",
    });
  });

  it("should send each muscle with exactly the keys save_exercise reads", () => {
    expect(payload.p_muscles).toStrictEqual([
      { muscle_id: "delt_side", role: "primary", weight: 1 },
      { muscle_id: "traps_upper", role: "secondary", weight: 0.5 },
    ]);
  });

  it("should derive compound for two primary muscles", () => {
    const squat = cleaned(
      withDraft({
        muscles: [
          { muscle_id: "quads", role: "primary" },
          { muscle_id: "glute_max", role: "primary" },
        ],
      }),
    );

    expect(customExercisePayload(squat).p_exercise.mechanic).toBe("compound");
  });
});
