import { describe, expect, it } from "vitest";

import {
  describeAssistantComposer,
  describeAssistantEmpty,
  describeInLogOpening,
} from "../../src/assistant";
import { ASSISTANT_SHEET, ASSISTANT_TRAIN_SHEET, describeLogsAt } from "../../src/copy";

describe("describeInLogOpening", () => {
  const now = new Date("2026-10-15T14:20:00Z");

  it("should be the log context's day and time", () => {
    expect(
      describeInLogOpening({ day: "2026-10-12", time: "13:00" }, now, "Europe/London"),
    ).toEqual({
      localDate: "2026-10-12",
      describeAt: "13:00",
    });
  });

  it("should be the time a food would be logged at now, on today, when the context has no time", () => {
    expect(describeInLogOpening({ day: "2026-10-15" }, now, "Europe/London")).toEqual({
      localDate: "2026-10-15",
      describeAt: "15:20",
    });
  });

  it("should be the clock time now on a past day when the context has no time", () => {
    expect(describeInLogOpening({ day: "2026-10-12" }, now, "Europe/London")).toEqual({
      localDate: "2026-10-12",
      describeAt: "15:20",
    });
  });
});

describe("describeLogsAt", () => {
  it("should say when the described food is logged", () => {
    expect(describeLogsAt("13:00")).toBe("Logs at 13:00");
  });
});

describe("describeAssistantEmpty", () => {
  it("should be the starters' words when the sheet was opened from the diary", () => {
    expect(describeAssistantEmpty(undefined)).toEqual({
      heading: "Log food or ask about your diary",
      lede: ASSISTANT_SHEET.emptyLede,
      starters: ASSISTANT_SHEET.starters,
      isNotMedicalLineShown: true,
    });
  });

  it("should be the training words, with the diary's lede and the not-medical line, when the sheet was opened from Train", () => {
    expect(describeAssistantEmpty(undefined, "train")).toEqual({
      heading: "Ask about your training",
      lede: ASSISTANT_SHEET.emptyLede,
      starters: [
        "What should I train today?",
        "Why has my bench stalled?",
        "Am I doing enough for my back?",
      ],
      isNotMedicalLineShown: true,
    });
  });

  it("should be the Describe intro, with no starters and no not-medical line, from Log food", () => {
    expect(describeAssistantEmpty("13:00")).toEqual({
      heading: "Describe a meal",
      lede: "Name each food and how much, in your own words: 2 eggs, a slice of toast, 150 g of rice. If a portion is unclear, the assistant asks.",
      starters: [],
      isNotMedicalLineShown: false,
    });
  });
});

describe("describeAssistantComposer when describing", () => {
  const describeComposer = (
    access: Parameters<typeof describeAssistantComposer>[0]["access"],
    isOnline = true,
  ) =>
    describeAssistantComposer({ access, isOnline, timeZone: "Europe/London", describeAt: "13:00" });

  it("should ask for a meal and say when it is logged, when open", () => {
    expect(describeComposer({ kind: "open" })).toEqual({
      isShown: true,
      isFieldDisabled: false,
      placeholder: "Describe a meal",
      hint: { chip: "Logs at 13:00", text: "Say what and how much" },
    });
  });

  it("should keep the offline words and draw no hint while offline", () => {
    expect(describeComposer({ kind: "open" }, false)).toEqual({
      isShown: true,
      isFieldDisabled: true,
      placeholder: "Needs a connection",
    });
  });

  it("should keep the notice's words and draw no hint when limited", () => {
    expect(describeComposer({ kind: "limited", notice: { code: "plus" } })).toEqual({
      isShown: true,
      isFieldDisabled: true,
      placeholder: "Not on your account",
    });
  });

  it("should not be shown for the consent card", () => {
    expect(describeComposer({ kind: "consent" })).toEqual({ isShown: false });
  });

  it("should have no hint when the sheet was not opened from Describe", () => {
    expect(
      describeAssistantComposer({
        access: { kind: "open" },
        isOnline: true,
        timeZone: "Europe/London",
      }),
    ).toEqual({
      isShown: true,
      isFieldDisabled: false,
      placeholder: "Log food or ask about your diary",
    });
  });
});

describe("describeAssistantComposer when opened from Train", () => {
  it("should ask about training in the field", () => {
    expect(
      describeAssistantComposer({
        access: { kind: "open" },
        isOnline: true,
        timeZone: "Europe/London",
        from: "train",
      }),
    ).toEqual({
      isShown: true,
      isFieldDisabled: false,
      placeholder: ASSISTANT_TRAIN_SHEET.composerPlaceholder,
    });
  });

  it("should keep the offline words while offline", () => {
    expect(
      describeAssistantComposer({
        access: { kind: "open" },
        isOnline: false,
        timeZone: "Europe/London",
        from: "train",
      }),
    ).toEqual({ isShown: true, isFieldDisabled: true, placeholder: "Needs a connection" });
  });
});
