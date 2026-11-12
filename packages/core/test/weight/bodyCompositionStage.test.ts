import { describe, expect, it } from "vitest";

import { bodyCompositionSectionStage, bodyCompositionViewStage } from "../../src/weight";

import type { BodyCompositionKindStatus } from "../../src/weight";

const view = (
  statuses: BodyCompositionKindStatus[],
  { hasSplit = false, isOnline = true }: { hasSplit?: boolean; isOnline?: boolean } = {},
) => bodyCompositionViewStage({ statuses, hasSplit, isOnline });

const section = (
  statuses: BodyCompositionKindStatus[],
  { hasCards = false, isOnline = true }: { hasCards?: boolean; isOnline?: boolean } = {},
) => bodyCompositionSectionStage({ statuses, hasCards, isOnline });

describe("bodyCompositionViewStage", () => {
  describe("online", () => {
    it("should wait while either kind loads, even with a split to draw from the other", () => {
      expect(view(["loading", "readings"], { hasSplit: true })).toBe("loading");
      expect(view(["readings", "loading"], { hasSplit: true })).toBe("loading");
    });

    it("should wait while a kind loads with nothing to draw", () => {
      expect(view(["loading", "empty"])).toBe("loading");
    });

    it("should let loading win over an error on the other kind", () => {
      expect(view(["loading", "error"])).toBe("loading");
    });

    it("should draw the split once nothing is loading", () => {
      expect(view(["readings", "readings"], { hasSplit: true })).toBe("drawing");
    });

    it("should draw the split in place of an error on the other kind", () => {
      expect(view(["readings", "error"], { hasSplit: true })).toBe("drawing");
    });

    it("should be the error when a kind failed and the other has no readings", () => {
      expect(view(["error", "empty"])).toBe("error");
      expect(view(["empty", "error"])).toBe("error");
    });

    it("should be the error when both kinds failed", () => {
      expect(view(["error", "error"])).toBe("error");
    });

    it("should be no readings when every kind is read and empty", () => {
      expect(view(["empty", "empty"])).toBe("no-readings");
    });

    it("should be no readings when there are no kinds to read", () => {
      expect(view([])).toBe("no-readings");
    });
  });

  describe("offline", () => {
    it("should draw a split without waiting for a kind that is paused", () => {
      expect(view(["readings", "loading"], { hasSplit: true, isOnline: false })).toBe("drawing");
    });

    it("should say the read is paused when a kind has nothing and there is no split", () => {
      expect(view(["loading", "empty"], { isOnline: false })).toBe("paused");
      expect(view(["loading", "loading"], { isOnline: false })).toBe("paused");
    });

    it("should let a paused kind win over an error on the other", () => {
      expect(view(["loading", "error"], { isOnline: false })).toBe("paused");
    });

    it("should be the same as online when nothing is loading", () => {
      expect(view(["error", "empty"], { isOnline: false })).toBe("error");
      expect(view(["empty", "empty"], { isOnline: false })).toBe("no-readings");
      expect(view(["readings", "readings"], { hasSplit: true, isOnline: false })).toBe("drawing");
    });
  });
});

describe("bodyCompositionSectionStage", () => {
  it("should wait while either kind loads, even with a card to draw", () => {
    expect(section(["loading", "readings"], { hasCards: true })).toBe("loading");
    expect(section(["loading", "empty"])).toBe("loading");
  });

  it("should say the read is paused offline, even with a card to draw", () => {
    expect(section(["loading", "readings"], { hasCards: true, isOnline: false })).toBe("paused");
    expect(section(["loading", "empty"], { isOnline: false })).toBe("paused");
  });

  it("should let loading win over an error", () => {
    expect(section(["loading", "error"])).toBe("loading");
    expect(section(["loading", "error"], { isOnline: false })).toBe("paused");
  });

  it("should be the error when a kind failed, even with a card for the other, which a card cannot replace", () => {
    expect(section(["error", "readings"], { hasCards: true })).toBe("error");
    expect(section(["error", "empty"])).toBe("error");
  });

  it("should draw the cards when nothing is loading or failed", () => {
    expect(section(["readings", "empty"], { hasCards: true })).toBe("drawing");
    expect(section(["readings", "readings"], { hasCards: true })).toBe("drawing");
  });

  it("should be no readings when every kind is read and empty", () => {
    expect(section(["empty", "empty"])).toBe("no-readings");
  });
});
