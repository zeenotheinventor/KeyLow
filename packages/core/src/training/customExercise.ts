import { MAX_EXERCISE_NAME_LENGTH, MAX_MUSCLES_PER_EXERCISE } from "./bounds";
import { characterCount } from "../recipes/characterCount";
import { equipmentSchema, muscleIdSchema, muscleRoleSchema } from "../schemas/training";

import type { Equipment, ExerciseMechanic, MuscleRole } from "./enums";
import type { MuscleId } from "./muscles";
import type { ValidationResult } from "../diary/rules/validation";

/*
 * The canvas `session · custom-exercise` form and the rules `save_exercise` will check it against (ADR 0005,
 * Amendment 1, `exercises`, `exercise_muscles` and `save_exercise`), so the form can mark every problem at
 * once and a request the database would refuse is never sent. The form has no mechanic field: it is derived
 * from the muscles. Issues name the field and the rule and never carry a value, because an exercise's name
 * and muscles are health data. The sentences are screen copy and live in the apps.
 */

/**
 * What a set counts for a muscle, by the role the form gives it, as the canvas states: "a set counts in full
 * for a primary muscle, half for a secondary and a fifth for an assisting one" (the `stabiliser` role). The
 * curated maps use the same shares.
 */
export const CUSTOM_EXERCISE_ROLE_WEIGHTS: Readonly<Record<MuscleRole, number>> = {
  primary: 1,
  secondary: 0.5,
  stabiliser: 0.2,
};

/** One muscle of the form, as the form holds it: the person's choice of role for a muscle. */
export type CustomExerciseDraftMuscle = { muscle_id: string; role: string };

/**
 * The form's state. The equipment and the muscles are text because that is all a form can promise, and
 * `validateCustomExerciseDraft` narrows them.
 */
export type CustomExerciseDraft = {
  name: string;
  equipment: string;
  muscles: readonly CustomExerciseDraftMuscle[];
};

/** One muscle with the role chosen for it, once it is known to be a real muscle and a real role. */
export type CustomExerciseChoice = { muscle_id: MuscleId; role: MuscleRole };

/** A draft that passed every rule: the name trimmed, the equipment and the muscles narrowed. */
export type CleanCustomExercise = {
  name: string;
  equipment: Equipment;
  muscles: readonly CustomExerciseChoice[];
};

export type CustomExerciseField = "name" | "equipment" | "muscles";

/** Everything a draft can get wrong, as stable codes. The sentence for each is screen copy. */
export type CustomExerciseRule =
  | "name_blank"
  | "name_too_long"
  | "equipment_invalid"
  | "muscles_none"
  | "muscles_too_many"
  | "muscle_unknown"
  | "muscle_role_invalid"
  | "muscle_repeated"
  | "primary_missing";

export type CustomExerciseIssue = Readonly<{
  field: CustomExerciseField;
  rule: CustomExerciseRule;
}>;

const issue = (field: CustomExerciseField, rule: CustomExerciseRule): CustomExerciseIssue => ({
  field,
  rule,
});

/** A name is counted as it will be saved, trimmed, and as the database counts it, in code points. */
const nameIssues = (name: string): CustomExerciseIssue[] => {
  if (name === "") {
    return [issue("name", "name_blank")];
  }
  return characterCount(name) > MAX_EXERCISE_NAME_LENGTH ? [issue("name", "name_too_long")] : [];
};

const muscleIssues = (muscles: readonly CustomExerciseDraftMuscle[]): CustomExerciseIssue[] => {
  if (muscles.length === 0) {
    return [issue("muscles", "muscles_none")];
  }
  const rules = new Set<CustomExerciseRule>();
  if (muscles.length > MAX_MUSCLES_PER_EXERCISE) {
    rules.add("muscles_too_many");
  }
  if (muscles.some(({ muscle_id }) => !muscleIdSchema.safeParse(muscle_id).success)) {
    rules.add("muscle_unknown");
  }
  if (muscles.some(({ role }) => !muscleRoleSchema.safeParse(role).success)) {
    rules.add("muscle_role_invalid");
  }
  if (new Set(muscles.map(({ muscle_id }) => muscle_id)).size < muscles.length) {
    rules.add("muscle_repeated");
  }
  if (!muscles.some(({ role }) => role === "primary")) {
    rules.add("primary_missing");
  }
  return [...rules].map((rule) => issue("muscles", rule));
};

/** The muscles whose id and role are both real, as choices. Only called once every rule has passed. */
const choicesOf = (
  muscles: readonly CustomExerciseDraftMuscle[],
): readonly CustomExerciseChoice[] => {
  const choices: CustomExerciseChoice[] = [];
  for (const { muscle_id, role } of muscles) {
    const muscle = muscleIdSchema.safeParse(muscle_id);
    const chosenRole = muscleRoleSchema.safeParse(role);
    if (muscle.success && chosenRole.success) {
      choices.push({ muscle_id: muscle.data, role: chosenRole.data });
    }
  }
  return choices;
};

/**
 * Whether a custom exercise is ready to save. The issues come back in the order of the form (the name,
 * the equipment, then the muscles), every one of them, never with a value from the draft. A draft with no
 * muscle gets `muscles_none` and not also `primary_missing`. With no issues it returns the cleaned draft,
 * the name trimmed, which is what `customExercisePayload` takes.
 */
export const validateCustomExerciseDraft = (
  draft: CustomExerciseDraft,
): ValidationResult<CleanCustomExercise, readonly CustomExerciseIssue[]> => {
  const name = draft.name.trim();
  const equipment = equipmentSchema.safeParse(draft.equipment);
  const issues = [
    ...nameIssues(name),
    ...(equipment.success ? [] : [issue("equipment", "equipment_invalid")]),
    ...muscleIssues(draft.muscles),
  ];
  if (issues.length > 0 || !equipment.success) {
    return { ok: false, problems: issues };
  }
  return {
    ok: true,
    value: { name, equipment: equipment.data, muscles: choicesOf(draft.muscles) },
  };
};

/** One muscle of the stored map: the columns of `exercise_muscles` that `save_exercise` reads. */
export type CustomExerciseMuscle = Readonly<{
  muscle_id: MuscleId;
  role: MuscleRole;
  weight: number;
}>;

/** The user's role choices as the stored map, each muscle with the weight its role carries. */
export const customExerciseMuscles = (
  selection: readonly CustomExerciseChoice[],
): CustomExerciseMuscle[] =>
  selection.map(({ muscle_id, role }) => ({
    muscle_id,
    role,
    weight: CUSTOM_EXERCISE_ROLE_WEIGHTS[role],
  }));

/** `compound` when two or more muscles are primary, otherwise `isolation`. The form has no mechanic field. */
export const customExerciseMechanic = (
  muscles: readonly { role: MuscleRole }[],
): ExerciseMechanic =>
  muscles.filter(({ role }) => role === "primary").length >= 2 ? "compound" : "isolation";

/** What `save_exercise(p_exercise_id, p_exercise, p_muscles)` reads. Each key is picked by name. */
export type CustomExercisePayload = Readonly<{
  p_exercise: Readonly<{ name: string; equipment: Equipment; mechanic: ExerciseMechanic }>;
  p_muscles: readonly CustomExerciseMuscle[];
}>;

/**
 * The two JSON arguments of `save_exercise` for a draft. It takes the cleaned draft that
 * `validateCustomExerciseDraft` returns, so every rule has been checked.
 */
export const customExercisePayload = (draft: CleanCustomExercise): CustomExercisePayload => ({
  p_exercise: {
    name: draft.name,
    equipment: draft.equipment,
    mechanic: customExerciseMechanic(draft.muscles),
  },
  p_muscles: customExerciseMuscles(draft.muscles),
});
