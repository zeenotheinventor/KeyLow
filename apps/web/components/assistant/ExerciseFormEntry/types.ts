import type { AssistantSheetEntry } from "@keylow/core";

export type ExerciseFormEntryProps = {
  entry: Extract<AssistantSheetEntry, { kind: "exerciseFormMedia" }>;
};
