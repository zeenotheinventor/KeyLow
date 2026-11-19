import { describe, expect, it } from "vitest";

import { ACHIEVEMENTS, summariseCelebrations } from "../../src/achievements";

import type { AchievementId, CelebrationEntry } from "../../src/achievements";

const held = (...ids: AchievementId[]): CelebrationEntry[] =>
  ids.map((id) => ({ id, isNew: false }));
const fresh = (...ids: AchievementId[]): CelebrationEntry[] =>
  ids.map((id) => ({ id, isNew: true }));

const bronzeIds = ACHIEVEMENTS.filter(({ tier }) => tier === "bronze").map(({ id }) => id);

describe("summariseCelebrations", () => {
  it("should be nothing when the drain is empty", () => {
    expect(summariseCelebrations({ entries: [], extras: null })).toBeNull();
  });

  describe("one badge", () => {
    it("should be a single toast that says how it was earned and what it is worth", () => {
      const summary = summariseCelebrations({ entries: fresh("hat-trick"), extras: null });

      expect(summary).toMatchObject({
        kind: "toast",
        leadId: "hat-trick",
        ids: ["hat-trick"],
        title: "Badge earned: Hat Trick",
        body: "3-day daily streak. +10 points",
        chips: [],
      });
    });

    it("should be a single toast for a held badge too", () => {
      const summary = summariseCelebrations({ entries: held("hat-trick"), extras: null });

      expect(summary).toMatchObject({ kind: "toast", title: "Badge earned: Hat Trick" });
    });
  });

  describe("several badges", () => {
    it("should be one grouped toast naming up to three badges and totalling the points", () => {
      const summary = summariseCelebrations({
        entries: fresh("fortnight", "notebook", "bullseye"),
        extras: null,
      });

      expect(summary).toMatchObject({
        kind: "toast",
        title: "3 badges earned",
        body: "Fortnight, Notebook and Bullseye. +45 points",
        ids: ["fortnight", "notebook", "bullseye"],
      });
    });

    it("should name two badges with and", () => {
      const summary = summariseCelebrations({
        entries: held("notebook", "bullseye"),
        extras: null,
      });

      expect(summary).toMatchObject({
        title: "2 badges earned",
        body: "Notebook and Bullseye. +20 points",
      });
    });

    it("should count the rest after three names", () => {
      const fourteen = held(...bronzeIds.slice(0, 14));

      const summary = summariseCelebrations({ entries: fourteen, extras: null });

      expect(summary).toMatchObject({
        kind: "toast",
        title: "14 badges earned",
        ids: bronzeIds.slice(0, 14),
      });
      expect(summary?.body).toMatch(/^[^,]+, [^,]+, [^,]+ and 11 more\. \+140 points$/);
    });

    it("should open the highest tier badge, the first of them on a tie", () => {
      const summary = summariseCelebrations({
        entries: held("notebook", "fortnight", "bullseye"),
        extras: null,
      });

      expect(summary?.leadId).toBe("fortnight");
    });
  });

  describe("freeze and level lines", () => {
    const extras = { freezes: 1, levelName: "Sapling" };

    it("should show them as chips when the run's notification carries them", () => {
      const summary = summariseCelebrations({
        entries: fresh("fortnight", "notebook", "bullseye"),
        extras,
      });

      expect(summary?.chips).toEqual([
        { kind: "freeze", label: "+1 freeze" },
        { kind: "level", label: "You reached Sapling" },
      ]);
    });

    it("should read several freezes", () => {
      const summary = summariseCelebrations({
        entries: fresh("hat-trick"),
        extras: { freezes: 3, levelName: null },
      });

      expect(summary?.chips).toEqual([{ kind: "freeze", label: "+3 freezes" }]);
    });

    it("should show none when there are no extras", () => {
      const summary = summariseCelebrations({
        entries: held("fortnight", "notebook"),
        extras: null,
      });

      expect(summary?.chips).toEqual([]);
    });
  });

  describe("Gold and Platinum", () => {
    it("should be the moment for a new Gold, with the other entries in one line", () => {
      const summary = summariseCelebrations({
        entries: [...fresh("month-strong"), ...held("notebook", "bullseye")],
        extras: null,
      });

      expect(summary).toMatchObject({
        kind: "moment",
        leadId: "month-strong",
        leadTier: "gold",
        ids: ["month-strong", "notebook", "bullseye"],
        tierLabel: "GOLD BADGE",
        title: "Month Strong",
        body: "30-day streak.",
        othersLine: "and 2 more badges",
        dialogLabel: "Gold badge earned, Month Strong",
        chips: [{ kind: "points", label: "+70 points" }],
      });
    });

    it("should say one more badge in the singular", () => {
      const summary = summariseCelebrations({
        entries: [...fresh("month-strong"), ...held("notebook")],
        extras: null,
      });

      expect(summary?.othersLine).toBe("and 1 more badge");
    });

    it("should have no line for others when the Gold is alone", () => {
      const summary = summariseCelebrations({ entries: fresh("month-strong"), extras: null });

      expect(summary?.othersLine).toBeNull();
    });

    it("should lead with the Platinum over a new Gold", () => {
      const summary = summariseCelebrations({
        entries: fresh("month-strong", "full-circle"),
        extras: null,
      });

      expect(summary).toMatchObject({
        kind: "moment",
        leadId: "full-circle",
        leadTier: "platinum",
        tierLabel: "PLATINUM BADGE",
        othersLine: "and 1 more badge",
      });
    });

    it("should put the points and freezes on the moment's chips", () => {
      const summary = summariseCelebrations({
        entries: fresh("month-strong"),
        extras: { freezes: 1, levelName: null },
      });

      expect(summary?.chips).toEqual([
        { kind: "points", label: "+50 points" },
        { kind: "freeze", label: "+1 freeze" },
      ]);
    });

    it("should never be the moment for a Gold held from before, even with a new Bronze", () => {
      const summary = summariseCelebrations({
        entries: [...fresh("hat-trick"), ...held("month-strong", "full-circle")],
        extras: null,
      });

      expect(summary).toMatchObject({
        kind: "toast",
        title: "3 badges earned",
        leadId: "full-circle",
      });
    });

    it("should be a toast for a held Gold with nothing new", () => {
      const summary = summariseCelebrations({ entries: held("month-strong"), extras: null });

      expect(summary).toMatchObject({ kind: "toast", title: "Badge earned: Month Strong" });
    });

    it("should lead the moment with the new Gold, not a higher Platinum that is held", () => {
      const summary = summariseCelebrations({
        entries: [...fresh("month-strong"), ...held("full-circle")],
        extras: null,
      });

      expect(summary).toMatchObject({ kind: "moment", leadId: "month-strong" });
    });
  });
});
