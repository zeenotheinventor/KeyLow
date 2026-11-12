import { describe, expect, it } from "vitest";

import {
  chooseAssistantConversationId,
  finishedAnswerWords,
  isNewConversationDisabled,
} from "../../src/assistant";

describe("chooseAssistantConversationId", () => {
  it("uses a settled read even when it is null, not the dead id the live turn holds", () => {
    expect(
      chooseAssistantConversationId({
        readIsSettled: true,
        readConversationId: null,
        liveConversationId: "dead",
      }),
    ).toBeNull();
  });

  it("uses the read's id while it is being read again", () => {
    expect(
      chooseAssistantConversationId({
        readIsSettled: false,
        readConversationId: "read",
        liveConversationId: "live",
      }),
    ).toBe("read");
  });

  it("falls back to the live turn's id while the read is unknown", () => {
    expect(
      chooseAssistantConversationId({
        readIsSettled: false,
        readConversationId: undefined,
        liveConversationId: "live",
      }),
    ).toBe("live");
  });

  it("is null when nothing is known", () => {
    expect(
      chooseAssistantConversationId({
        readIsSettled: false,
        readConversationId: undefined,
        liveConversationId: undefined,
      }),
    ).toBeNull();
  });
});

describe("isNewConversationDisabled", () => {
  const ready = {
    isEmpty: false,
    isOpening: false,
    isStreaming: false,
    isOnline: true,
    isStartingNew: false,
    isConsentNeeded: false,
  };

  it("is on when there is a conversation to clear", () => {
    expect(isNewConversationDisabled(ready)).toBe(false);
  });

  it.each([
    ["empty", { isEmpty: true }],
    ["opening", { isOpening: true }],
    ["streaming", { isStreaming: true }],
    ["offline", { isOnline: false }],
    ["starting a new one", { isStartingNew: true }],
    ["consent needed", { isConsentNeeded: true }],
  ])("is off while %s", (_name, change) => {
    expect(isNewConversationDisabled({ ...ready, ...change })).toBe(true);
  });
});

describe("finishedAnswerWords", () => {
  const finished = { text: "  Hello there  ", stopped: false, outcome: "complete" };

  it("gives the trimmed words of a finished answer", () => {
    expect(finishedAnswerWords(finished)).toBe("Hello there");
  });

  it("gives nothing for a stopped turn, a turn with no outcome, or no turn", () => {
    expect(finishedAnswerWords({ ...finished, stopped: true })).toBe("");
    expect(finishedAnswerWords({ ...finished, outcome: null })).toBe("");
    expect(finishedAnswerWords(null)).toBe("");
  });
});
