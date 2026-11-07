import {
  EXERCISE_CREATED_NOTE,
  describeExerciseCreatedSub,
  describeExerciseCreatedTitle,
  describeExerciseCreatedUndone,
} from "../../copy/assistantTrainingCards";

import type { AssistantCardDraft } from "./entryCardEntry";
import type { ExerciseCardMuscle } from "../../copy/assistantTrainingCards";
import type { Equipment } from "../../training/enums";

/** An exercise as a card is worded from it: the row the database holds, never what the model sent. */
export type CardExercise = {
  name: string;
  equipment: Equipment;
  muscles: readonly ExerciseCardMuscle[];
};

/**
 * The card after a `save_custom_exercise` that added an exercise: "Added exercise Cable crunch". It has no
 * link, because no screen opens a custom exercise. Undo archives it.
 */
export function buildExerciseCreatedCard({
  name,
  equipment,
  muscles,
}: CardExercise): AssistantCardDraft {
  return {
    kind: "exercise_created",
    title: describeExerciseCreatedTitle(name),
    sub: describeExerciseCreatedSub(equipment, muscles),
    rows: [],
    totalText: null,
    note: EXERCISE_CREATED_NOTE,
    link: null,
    undo: "available",
    undoneSub: describeExerciseCreatedUndone(name),
  };
}
