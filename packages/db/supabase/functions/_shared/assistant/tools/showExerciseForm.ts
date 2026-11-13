// The form of one exercise, for "how do I do a barbell squat?". The model is told what the card shows, in a
// few words, so its reply can fit it. The app draws the card from `structured`, which the model never sees
// (ADR 0006), and makes every address itself from an id or a path, so no URL travels. It writes nothing, so it
// works during a workout and has no Undo.
import { z } from "zod";

import { formMediaToShow } from "../../core.ts";
import { getExercise, getExerciseFormMedia } from "../../repos.ts";
import { dataNotice } from "./shared.ts";

import type { ReadToolDefinition, ToolRunOutput } from "../tool.ts";

const showExerciseFormInput = z.strictObject({
  exercise_id: z.guid().describe("The id of an exercise, from search_exercises or get_routines."),
});

export const showExerciseFormTool: ReadToolDefinition<z.infer<typeof showExerciseFormInput>> = {
  name: "show_exercise_form",
  description:
    "Shows the person the form of one exercise as a card, a video or else two photos, and answers what the " +
    "card shows. Use it when the person asks how to do an exercise, its form or technique, or for a demo. " +
    "Call it once per exercise, with an id from search_exercises or get_routines, never an invented one. " +
    "The app draws the card under your reply. Never write a link, a URL or a video title. not_found means " +
    "the exercise is not there. " +
    dataNotice,
  kind: "read",
  input: showExerciseFormInput,
  // The training reads opt out of the strict budget (D2 of KEY-881).
  strict: false,
  annotations: { readOnlyHint: true },
  async run(ctx, { exercise_id }): Promise<ToolRunOutput> {
    // Under the caller's JWT, so another person's custom exercise and an archived one answer as no exercise.
    const exercise = await getExercise(ctx.caller, exercise_id);
    if (exercise === null) {
      return { data: { error: "not_found" } };
    }
    // The video first, as before: this tool sends one kind only until the app shows a preference.
    const media = formMediaToShow(await getExerciseFormMedia(ctx.caller, exercise_id), "video");
    switch (media.kind) {
      case "video":
        return {
          data: { exercise: exercise.name, shown: "video" },
          structured: { exerciseFormMedia: { exerciseName: exercise.name, media } },
        };
      case "photos":
        return {
          data: { exercise: exercise.name, shown: "photos" },
          structured: {
            exerciseFormMedia: {
              exerciseName: exercise.name,
              media: { kind: "photos", imagePaths: [...media.imagePaths] },
            },
          },
        };
      case "none":
        return {
          data: {
            exercise: exercise.name,
            shown: "nothing",
            note: "No form guide is held for this exercise.",
          },
        };
    }
  },
};
