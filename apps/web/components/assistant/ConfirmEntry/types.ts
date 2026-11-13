import type { AssistantSheetEntry } from "@keylow/core";

export type ConfirmEntryProps = {
  entry: Extract<AssistantSheetEntry, { kind: "confirm" }>;
};
