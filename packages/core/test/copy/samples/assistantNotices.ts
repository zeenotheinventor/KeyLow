import * as copy from "../../../src/copy";

// Every function `src/copy/assistantNotices.ts` exports, called with representative arguments. The voice test
// fails when a function has no row, so no sentence escapes the sweep.
export const samples: Record<string, () => string[]> = {
  describeAssistantNotice: () =>
    [
      copy.describeAssistantNotice(
        { code: "day_limit", resetsAt: "2026-10-26T00:00:00Z" },
        "Europe/London",
      ),
      copy.describeAssistantNotice({ code: "plus" }, "Europe/London"),
      copy.describeAssistantNotice({ code: "resting", resumesOn: "2026-11-01" }, "Europe/London"),
      copy.describeAssistantNotice({ code: "switched_off" }, "Europe/London"),
      copy.describeAssistantNotice({ code: "turn_failed" }, "Europe/London"),
    ].flatMap(({ title, body, fieldText, button }) =>
      [title, body, fieldText, button].filter((text) => text !== null),
    ),
  describeResetTime: () => [
    copy.describeResetTime("2026-10-26T00:00:00Z", "Europe/London"),
    copy.describeResetTime("2026-07-02T00:00:00Z", "Europe/London"),
    copy.describeResetTime("2026-07-02T00:00:00Z", "Asia/Kolkata"),
  ],
  describeAssistantStatus: () => [
    copy.describeAssistantStatus({ code: "reading_recipe", host: "example.com" }),
  ],
};
