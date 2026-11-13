import type { AssistantSheetEntry } from "@keylow/core";

export type QuickRepliesEntryProps = {
  entry: Extract<AssistantSheetEntry, { kind: "quickReplies" }>;
};
