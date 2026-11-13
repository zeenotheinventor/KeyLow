import type { AssistantSheetEntry } from "@keylow/core";

export type LinkEntryProps = {
  entry: Extract<AssistantSheetEntry, { kind: "link" }>;
};
