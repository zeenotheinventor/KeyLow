import { z } from "zod";

import { muscleIdSchema, muscleRoleSchema } from "../schemas/training";
import { MAX_MUSCLES_PER_EXERCISE } from "../training/bounds";

/**
 * The muscles an exercise works, which the app draws as a 2D figure in the thread (`assistant-card ·
 * exercise-muscles`). It is a read, so it is not an action card: it has no action, no Undo and no icon.
 * The rows are the shape of `MuscleRoleEntry`, so `musclesByRole` and `exerciseRoleValues` take them as
 * they are. There is no exercise id and no weight, because nothing draws them. The card holds its muscles
 * when the turn is stored, so reopening the conversation reads nothing more.
 *
 * `assistantStreamEventSchema` is strict, so a muscle id the app does not know fails the turn. A new
 * muscle id is therefore a change to this contract, and the release order applies to it: the app that
 * knows the id ships over the air first, then the tool that sends it.
 */
export const assistantExerciseMusclesSchema = z.strictObject({
  exerciseName: z.string().min(1),
  muscles: z
    .array(z.strictObject({ muscle_id: muscleIdSchema, role: muscleRoleSchema }))
    .min(1)
    .max(MAX_MUSCLES_PER_EXERCISE),
});

export type AssistantExerciseMuscles = z.infer<typeof assistantExerciseMusclesSchema>;
