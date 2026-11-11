import type { AssistantExerciseFormMedia } from "@keylow/core";

export type ExerciseFormEntryProps = {
  /** The exercise and its form video or photos, as the turn sent them and stored them. Ids and paths only, never a URL. */
  exercise: AssistantExerciseFormMedia;
};
