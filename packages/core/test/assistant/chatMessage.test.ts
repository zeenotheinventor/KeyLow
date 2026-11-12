import { describe, expect, it } from "vitest";

import { describeChatMessage, replyReadOptions } from "../../src/assistant";

describe("replyReadOptions", () => {
  const settled = { paragraphCount: 3, isStreaming: false, isStopped: false };

  it("should read no paragraph as partial or arriving when the reply is settled", () => {
    expect([0, 1, 2].map((index) => replyReadOptions({ ...settled, index }))).toEqual([
      { isPartial: false, isArriving: false },
      { isPartial: false, isArriving: false },
      { isPartial: false, isArriving: false },
    ]);
  });

  it("should read only the last paragraph as partial and arriving while the reply streams", () => {
    const streaming = { ...settled, isStreaming: true };

    expect([0, 1, 2].map((index) => replyReadOptions({ ...streaming, index }))).toEqual([
      { isPartial: false, isArriving: false },
      { isPartial: false, isArriving: false },
      { isPartial: true, isArriving: true },
    ]);
  });

  it("should read the last paragraph of a stopped reply as partial but not arriving, so every line it has shows", () => {
    expect(replyReadOptions({ ...settled, isStopped: true, index: 2 })).toEqual({
      isPartial: true,
      isArriving: false,
    });
    expect(replyReadOptions({ ...settled, isStopped: true, index: 1 })).toEqual({
      isPartial: false,
      isArriving: false,
    });
  });
});

describe("describeChatMessage", () => {
  it("should name your message by who said it, with the words as typed", () => {
    expect(
      describeChatMessage({
        role: "you",
        speakerLabel: "You",
        paragraphs: ["**2** * 3", "second"],
      }),
    ).toBe("You: **2** * 3 second");
  });

  it("should read the assistant's words without the markers it wrote", () => {
    expect(
      describeChatMessage({
        role: "assistant",
        speakerLabel: "Assistant",
        paragraphs: ["Some **bold** words", "- Two eggs"],
      }),
    ).toBe("Assistant: Some bold words Two eggs");
  });

  it("should leave out a paragraph that holds no words yet", () => {
    expect(
      describeChatMessage({
        role: "assistant",
        speakerLabel: "Assistant",
        paragraphs: ["Hello", ""],
        isStreaming: true,
      }),
    ).toBe("Assistant: Hello");
  });

  it("should add the estimate, the citation and the stopped line, in that order", () => {
    expect(
      describeChatMessage({
        role: "assistant",
        speakerLabel: "Assistant",
        paragraphs: ["About 600 kcal"],
        estimate: { badgeLabel: "Estimate", label: "Trend weight is an estimate" },
        citation: "Based on 38 entries, 12 to 18 Oct",
        stoppedLabel: "Stopped when you closed the assistant",
      }),
    ).toBe(
      "Assistant: About 600 kcal Estimate Trend weight is an estimate Based on 38 entries, 12 to 18 Oct Stopped when you closed the assistant",
    );
  });

  it("should hold back a pipe line only while the reply arrives, not once it was stopped", () => {
    const paragraphs = ["Totals", "| Food | kcal |"];
    const base = { role: "assistant", speakerLabel: "Assistant", paragraphs } as const;

    expect(describeChatMessage({ ...base, isStreaming: true })).toBe("Assistant: Totals");
    expect(describeChatMessage({ ...base, stoppedLabel: "Stopped" })).toContain("Food");
  });

  it("should read a stopped reply's cut-short last paragraph as partial", () => {
    const words = describeChatMessage({
      role: "assistant",
      speakerLabel: "Assistant",
      paragraphs: ["Log fo**"],
      stoppedLabel: "Stopped",
    });

    expect(words).toBe("Assistant: Log fo Stopped");
  });
});
