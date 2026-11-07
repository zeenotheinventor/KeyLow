// The muscles one exercise works, for "what does a Romanian deadlift hit?". The model reads the same role
// lines the card draws, built from the same map by the same two core functions, so its words and the figure
// name the same muscles and it has nothing to invent from. The app draws the figure from `structured`, which
// the model never sees (ADR 0006). It writes nothing, so it works during a workout and has no Undo.
import { z } from "zod";

import { describeRoleRow, musclesByRole } from "../../core.ts";
import { getExercise } from "../../repos.ts";
import { dataNotice } from "./shared.ts";

import type { ReadToolDefinition, ToolRunOutput } from "../tool.ts";

const showExerciseMusclesInput = z.strictObject({
  exercise_id: z.guid().describe("The id of an exercise, from search_exercises or get_routines."),
});

export const showExerciseMusclesTool: ReadToolDefinition<z.infer<typeof showExerciseMusclesInput>> =
  {
    name: "show_exercise_muscles",
    description:
      "Shows the person a figure of the muscles one exercise works, and answers those muscles with their " +
      "roles. Use it when the person asks what an exercise works, hits or targets, or which of two works a " +
      "muscle. Call it once per exercise, with an id from search_exercises or get_routines, never an " +
      "invented one. The app draws the figure under your reply. Say only the muscles and roles given here. " +
      "They hold no ranking between exercises. not_found means the exercise is not there. " +
      dataNotice,
    kind: "read",
    input: showExerciseMusclesInput,
    // The training reads opt out of the strict budget (D2 of KEY-881).
    strict: false,
    annotations: { readOnlyHint: true },
    async run(ctx, { exercise_id }): Promise<ToolRunOutput> {
      // Under the caller's JWT, so another person's custom exercise and an archived one answer as no exercise.
      const exercise = await getExercise(ctx.caller, exercise_id);
      if (exercise === null) {
        return { data: { error: "not_found" } };
      }
      // Only the two fields of each row the app's strict event accepts: the stored weight is not one of them.
      const muscles = exercise.muscles.map(({ muscle_id, role }) => ({ muscle_id, role }));
      return {
        data: {
          exercise: exercise.name,
          roles: musclesByRole(muscles).map(({ role, muscles: ofRole }) =>
            describeRoleRow(role, ofRole),
          ),
        },
        structured: { exerciseMuscles: { exerciseName: exercise.name, muscles } },
      };
    },
  };
