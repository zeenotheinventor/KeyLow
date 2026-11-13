import type { AssistantSheetEntry } from "@keylow/core";

export type ExerciseMusclesEntryProps = {
  entry: Extract<AssistantSheetEntry, { kind: "exerciseMuscles" }>;
};
