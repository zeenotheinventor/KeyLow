// What the custom exercise write tools share: the exercise as the database holds it (archived rows
// included, which the repos never show), the fingerprint Undo compares, and the check that something
// still points at an exercise. An exercise's name and muscles are health data, so a failed read names the
// table and the error code only.
import { z } from "zod";

import { EQUIPMENT, MUSCLE_IDS, MUSCLE_ROLES } from "../../core.ts";

import type { ToolContext, WriteRunOutput } from "../tool.ts";

export const muscleIdSchema = z.enum(MUSCLE_IDS);
export const muscleRoleSchema = z.enum(MUSCLE_ROLES);
export const equipmentSchema = z.enum(EQUIPMENT);

const exerciseRowSchema = z.object({
  name: z.string(),
  equipment: equipmentSchema,
  mechanic: z.enum(["compound", "isolation"]),
  source: z.string(),
  deleted_at: z.string().nullable(),
  exercise_muscles: z.array(
    z.object({ muscle_id: muscleIdSchema, role: muscleRoleSchema, weight: z.number() }),
  ),
});

// One exercise as it is stored now. `isLibrary` is true for an exercise of the library, which is no one's
// to change, and `isArchived` for a custom one that has left the person's list.
export type ExerciseState = {
  name: string;
  equipment: z.infer<typeof equipmentSchema>;
  mechanic: "compound" | "isolation";
  muscles: {
    muscle_id: z.infer<typeof muscleIdSchema>;
    role: z.infer<typeof muscleRoleSchema>;
    weight: number;
  }[];
  isLibrary: boolean;
  isArchived: boolean;
};

// The exercise with this id, or null when the person cannot see one. Row level security shows the
// library and the person's own exercises, archived ones too, so another person's exercise reads as null.
export async function readExerciseState(
  ctx: ToolContext,
  id: string,
): Promise<ExerciseState | null> {
  const { data, error } = await ctx.caller
    .from("exercises")
    .select("name,equipment,mechanic,source,deleted_at,exercise_muscles(muscle_id,role,weight)")
    .eq("id", id)
    .maybeSingle();
  if (error) {
    throw new Error(`Could not read the exercise ${error.code}`);
  }
  if (data === null) {
    return null;
  }
  const row = exerciseRowSchema.safeParse(data);
  if (!row.success) {
    throw new Error("Could not read the exercise, it does not parse");
  }
  return {
    name: row.data.name,
    equipment: row.data.equipment,
    mechanic: row.data.mechanic,
    muscles: row.data.exercise_muscles,
    isLibrary: row.data.source !== "user",
    isArchived: row.data.deleted_at !== null,
  };
}

// What Undo compares to tell that the exercise changed since the assistant left it: every column and the
// whole muscle map, in one fixed order. It is a string, so the comparison never depends on how the database
// orders keys or writes numbers.
export const exerciseFingerprint = (
  exercise: Pick<ExerciseState, "name" | "equipment" | "mechanic" | "muscles" | "isArchived">,
): string =>
  JSON.stringify([
    exercise.name,
    exercise.equipment,
    exercise.mechanic,
    exercise.isArchived,
    [...exercise.muscles]
      .sort((first, second) => first.muscle_id.localeCompare(second.muscle_id))
      .map(({ muscle_id, role, weight }) => [muscle_id, role, weight]),
  ]);

// Whether a routine names the exercise or a set was logged with it. It reads the plan and the sets with
// no filter on archived routines, deleted sessions or deleted sets, because each of those can be restored
// and would then point at an exercise Undo had archived. The person's own rows only, by row level security.
export async function isExerciseInUse(ctx: ToolContext, id: string): Promise<boolean> {
  const [inRoutine, inSet] = await Promise.all([
    ctx.caller.from("routine_exercises").select("id").eq("exercise_id", id).limit(1),
    ctx.caller.from("workout_sets").select("id").eq("exercise_id", id).limit(1),
  ]);
  const failure = inRoutine.error ?? inSet.error;
  if (failure) {
    throw new Error(`Could not check where the exercise is used ${failure.code}`);
  }
  return (inRoutine.data?.length ?? 0) > 0 || (inSet.data?.length ?? 0) > 0;
}

// An exercise of the library, which nobody can change or archive.
export const globalExercise: WriteRunOutput = { data: { error: "global_exercise" }, target: null };
