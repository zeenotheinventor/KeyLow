import type { AssistantSheetEntry } from "@keylow/core";

export type NoticeEntryProps = {
  entry: Extract<AssistantSheetEntry, { kind: "notice" }>;
};
