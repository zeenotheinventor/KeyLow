import { describe, expect, it } from "vitest";

import {
  OPEN_TURN_DEADLINE_MS,
  UNSENT_TURN_GRACE_MS,
  detachedTurnState,
  runningOpenTurn,
  storedReplyText,
} from "../src/detachedTurn";

import type { AssistantThreadItem } from "@keylow/core";

const NOW = Date.parse("2026-11-13T12:00:00Z");
const user = (id: string): AssistantThreadItem => ({ kind: "user", id, text: "Hi" });
const reply = (id: string, text: string, stopped = false): AssistantThreadItem => ({
  kind: "reply",
  id,
  text,
  answerMeta: null,
  stopped,
});

const base = {
  live: { turnId: "t1", text: "" },
  detachedAtMs: NOW,
  afterItemId: "u0",
  items: [user("u0"), user("u1")],
  openTurn: { turnId: "t1", firstSeenAtMs: NOW },
  lastReadAtMs: NOW + 4000,
  nowMs: NOW + 5000,
};

describe("detachedTurnState", () => {
  it("should wait while the stored turn is open and its message is the only thing stored", () => {
    expect(detachedTurnState(base)).toBe("waiting");
  });

  it("should be stored once a reply follows the message", () => {
    expect(detachedTurnState({ ...base, items: [...base.items, reply("r1", "Done")] })).toBe(
      "stored",
    );
  });

  it("should fail when the stored turn is still open 150 s after the phone first saw it", () => {
    expect(detachedTurnState({ ...base, nowMs: NOW + OPEN_TURN_DEADLINE_MS })).toBe("failed");
  });

  it("should count the 150 s from when the phone saw the turn, so a clock ahead of the server's changes nothing", () => {
    // The server's row says the turn began 10 minutes ago by the phone's clock, which the phone does not use.
    const skewed = { ...base, openTurn: { turnId: "t1", firstSeenAtMs: NOW } };

    expect(detachedTurnState({ ...skewed, nowMs: NOW + 5000 })).toBe("waiting");
  });

  describe("a turn with no turn event whose message is not stored", () => {
    const unsent = {
      ...base,
      live: { turnId: null, text: "" },
      items: [user("u0")],
      openTurn: null,
    };

    it("should fail on a read at least 3 s after the detach", () => {
      expect(detachedTurnState({ ...unsent, lastReadAtMs: NOW + UNSENT_TURN_GRACE_MS })).toBe(
        "failed",
      );
    });

    it("should wait on a read sooner than that, so a sheet closed right after Send does not flash the failure", () => {
      expect(detachedTurnState({ ...unsent, lastReadAtMs: NOW + 500 })).toBe("waiting");
    });

    it("should wait when nothing was read yet", () => {
      expect(detachedTurnState({ ...unsent, lastReadAtMs: null })).toBe("waiting");
    });
  });

  it("should wait for a turn with no turn event whose message is stored", () => {
    expect(detachedTurnState({ ...base, live: { turnId: null, text: "" } })).toBe("waiting");
  });

  it("should date a turn with no open row from the moment it detached", () => {
    const noRow = { ...base, openTurn: null };

    expect(detachedTurnState({ ...noRow, nowMs: NOW + 149_000 })).toBe("waiting");
    expect(detachedTurnState({ ...noRow, nowMs: NOW + OPEN_TURN_DEADLINE_MS })).toBe("failed");
  });
});

describe("runningOpenTurn", () => {
  const openTurn = { turnId: "t1", firstSeenAtMs: NOW };

  it("should give an open turn inside its 150 s", () => {
    expect(runningOpenTurn(openTurn, NOW + 1000)).toBe(openTurn);
  });

  it("should give none past its deadline or when there is none", () => {
    expect(runningOpenTurn(openTurn, NOW + OPEN_TURN_DEADLINE_MS)).toBeNull();
    expect(runningOpenTurn(null, NOW)).toBeNull();
  });
});

describe("storedReplyText", () => {
  it("should join the replies stored after the message was sent", () => {
    expect(
      storedReplyText(
        [reply("r0", "Old"), user("u1"), reply("r1", "One"), reply("r2", "Two")],
        "r0",
      ),
    ).toBe("One\n\nTwo");
  });

  it("should give nothing for a stopped reply", () => {
    expect(storedReplyText([user("u1"), reply("r1", "Half", true)], null)).toBe("");
  });
});
