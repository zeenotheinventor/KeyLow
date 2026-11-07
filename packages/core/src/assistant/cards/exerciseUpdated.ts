import {
  EXERCISE_UPDATED_NOTE,
  EXERCISE_UPDATED_ROWS,
  describeExerciseEquipmentChange,
  describeExerciseMusclesChange,
  describeExerciseUpdatedTitle,
  describeExerciseUpdatedUndone,
  describeExerciseWasName,
} from "../../copy/assistantTrainingCards";

import type { CardExercise } from "./exerciseCreated";
import type { AssistantCardRow } from "../card";
import type { AssistantCardDraft } from "./entryCardEntry";

const rowOf = (name: string, amountText: string): AssistantCardRow => ({
  name,
  amountText,
  time: null,
  kcalText: null,
  match: null,
  matchedFood: null,
  estimate: false,
});

// The same muscles in the same roles, whatever the order they were listed in.
const sameMuscles = (first: CardExercise["muscles"], second: CardExercise["muscles"]): boolean =>
  first.length === second.length &&
  first.every((muscle) =>
    second.some(({ muscle_id, role }) => muscle_id === muscle.muscle_id && role === muscle.role),
  );

/**
 * The card after a `save_custom_exercise` that changed an exercise: "Updated exercise Kneeling cable
 * crunch", with a row for each field that changed and the previous value under it. Undo puts the previous
 * name, equipment and muscles back, and the line it shows then names them.
 */
export function buildExerciseUpdatedCard({
  before,
  after,
}: {
  before: CardExercise;
  after: CardExercise;
}): AssistantCardDraft {
  return {
    kind: "exercise_updated",
    title: describeExerciseUpdatedTitle(after.name),
    sub: null,
    rows: [
      ...(before.name === after.name
        ? []
        : [rowOf(EXERCISE_UPDATED_ROWS.name, describeExerciseWasName(before.name))]),
      ...(before.equipment === after.equipment
        ? []
        : [
            rowOf(
              EXERCISE_UPDATED_ROWS.equipment,
              describeExerciseEquipmentChange(after.equipment, before.equipment),
            ),
          ]),
      ...(sameMuscles(before.muscles, after.muscles)
        ? []
        : [
            rowOf(
              EXERCISE_UPDATED_ROWS.muscles,
              describeExerciseMusclesChange(after.muscles, before.muscles),
            ),
          ]),
    ],
    totalText: null,
    note: EXERCISE_UPDATED_NOTE,
    link: null,
    undo: "available",
    undoneSub: describeExerciseUpdatedUndone(before.name, before.equipment, before.muscles),
  };
}
