import * as copy from "../../../src/copy";
import { collectStrings } from "../collectStrings";

import type { AssistantChangeRow } from "../../../src/assistant";

// Every function `src/copy/assistantSettings.ts` exports, called with representative arguments. The voice test
// fails when a function has no row, so no sentence escapes the sweep. The row's words are read before the
// setting is known too, which leaves the title alone.
const sampleRow = (state: "undo" | "undone" | "cant_undo"): AssistantChangeRow => ({
  key: "a1",
  actionIds: ["a1"],
  title: "Logged 2 eggs and toast at 08:10",
  sub: "08:11 · 2 entries",
  state,
});

export const samples: Record<string, () => string[]> = {
  describeAssistantMoreRow: () =>
    [false, true, undefined].flatMap((isOn) => collectStrings(copy.describeAssistantMoreRow(isOn))),
  describeAssistantChangeRow: () =>
    (["undo", "undone", "cant_undo"] as const).flatMap((state) => [
      ...collectStrings(copy.describeAssistantChangeRow(sampleRow(state), null)),
      ...collectStrings(copy.describeAssistantChangeRow(sampleRow(state), "undone")),
      ...collectStrings(copy.describeAssistantChangeRow(sampleRow(state), "unavailable")),
    ]),
  describeAssistantConsentCaption: () => [
    copy.describeAssistantConsentCaption(false),
    copy.describeAssistantConsentCaption(true),
  ],
};
