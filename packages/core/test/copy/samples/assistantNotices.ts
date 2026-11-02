import * as copy from "../../../src/copy";

// Every function `src/copy/assistantNotices.ts` exports, called with representative arguments. The voice test
// fails when a function has no row, so no sentence escapes the sweep.
export const samples: Record<string, () => string[]> = {
  describeAssistantNotice: () =>
    [
      copy.describeAssistantNotice({ code: "day_limit", resetsAt: "2026-10-26T00:00:00Z" }),
      copy.describeAssistantNotice({ code: "plus" }),
      copy.describeAssistantNotice({ code: "resting", resumesOn: "2026-11-01" }),
      copy.describeAssistantNotice({ code: "switched_off" }),
      copy.describeAssistantNotice({ code: "turn_failed" }),
    ].flatMap(({ title, body, fieldText, button }) =>
      [title, body, fieldText, button].filter((text) => text !== null),
    ),
  describeAssistantStatus: () => [
    copy.describeAssistantStatus({ code: "reading_recipe", host: "example.com" }),
  ],
};
