import { z } from "zod";

import { shownExerciseFormMediaSchema } from "../training/formMedia";

/**
 * The form video or the start and end photos of an exercise, which the app draws as the form media card
 * in the thread (`assistant-card · exercise-form`). It is a read, so it is not an action card. Only an id
 * or two image paths travel, each checked by its schema, and never a URL: the app makes every address with
 * `exerciseFormMediaDisplayOf`, so a tool result can never make the app open or load an arbitrary address.
 * A `none` media is never sent, because the tool answers the model with no card instead. The card holds its
 * media when the turn is stored, so reopening the conversation reads nothing more.
 *
 * `assistantStreamEventSchema` is strict, so an event the app does not know fails the turn. The release
 * order applies: the app that knows the event ships over the air first, then the tool that sends it.
 */
export const assistantExerciseFormMediaSchema = z.strictObject({
  exerciseName: z.string().min(1).max(200),
  media: shownExerciseFormMediaSchema,
});

export type AssistantExerciseFormMedia = z.infer<typeof assistantExerciseFormMediaSchema>;
