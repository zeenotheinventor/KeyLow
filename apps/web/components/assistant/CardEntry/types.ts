import type { AssistantSheetEntry } from "@keylow/core";

export type CardEntryProps = {
  entry: Extract<AssistantSheetEntry, { kind: "card" }>;
};
