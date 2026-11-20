import { describe, expect, it } from "vitest";

import { decideCelebrations } from "../../src/achievements/celebrations";

import type { CelebrationInput } from "../../src/achievements/celebrations";

const quietRun: CelebrationInput["run"] = {
  newUnlocks: [],
  levelUp: null,
  freezeEventsToWrite: [],
};

const input = (overrides: Partial<CelebrationInput>): CelebrationInput => ({
  run: quietRun,
  recorded: [],
  held: [],
  isBackfill: false,
  alreadyQueued: [],
  ...overrides,
});

describe("decideCelebrations", () => {
  describe("an ordinary run", () => {
    it("should queue an id the database recorded as new, with the notification for it", () => {
      const decision = decideCelebrations(
        input({
          run: { ...quietRun, newUnlocks: ["first-bite"] },
          recorded: ["first-bite"],
        }),
      );

      expect(decision.entries).toEqual([{ id: "first-bite", isNew: true }]);
      expect(decision.notification).toEqual({
        title: "Badge earned: First Bite",
        body: "Logging your first food. +10 points",
        achievementId: "first-bite",
      });
      expect(decision.backfillSummary).toBeNull();
    });

    it("should give only the points of the recorded badges, not the all-time total", () => {
      const decision = decideCelebrations(
        input({
          run: { ...quietRun, newUnlocks: ["first-bite"] },
          recorded: ["first-bite"],
        }),
      );

      expect(decision.notification?.body).toBe("Logging your first food. +10 points");
    });

    it("should sum the points of several recorded badges", () => {
      const decision = decideCelebrations(
        input({
          run: { ...quietRun, newUnlocks: ["diarist", "first-bite"] },
          recorded: ["diarist", "first-bite"],
        }),
      );

      expect(decision.notification?.body).toContain("+60 points");
    });

    it("should not queue an id the engine found but another device had already recorded", () => {
      const decision = decideCelebrations(
        input({
          run: { ...quietRun, newUnlocks: ["first-bite"] },
          recorded: [],
          held: [{ id: "first-bite", seenAt: "2026-11-19T09:00:00.000Z", backfilled: false }],
        }),
      );

      expect(decision.entries).toEqual([]);
      expect(decision.notification).toBeNull();
    });

    it("should carry the freezes and the level of the run as numbers", () => {
      const decision = decideCelebrations(
        input({
          run: {
            ...quietRun,
            newUnlocks: ["first-bite"],
            levelUp: { from: 0, to: 1, name: "Sprout" },
            freezeEventsToWrite: [
              { kind: "earned", reason: "level", reference: "1", date: "2026-11-19", count: 2 },
              {
                kind: "used",
                reason: "gap",
                reference: "2026-11-18",
                date: "2026-11-19",
                count: 1,
              },
            ],
          },
          recorded: ["first-bite"],
        }),
      );

      expect(decision.extras).toEqual({ freezes: 2, levelName: "Sprout" });
    });

    it("should carry no extras when the run earned no freeze and reached no level", () => {
      const decision = decideCelebrations(
        input({
          run: { ...quietRun, newUnlocks: ["first-bite"] },
          recorded: ["first-bite"],
        }),
      );

      expect(decision.extras).toBeNull();
    });

    it("should queue a held row that was never seen as not new, with no notification", () => {
      const decision = decideCelebrations(
        input({ held: [{ id: "hat-trick", seenAt: null, backfilled: false }] }),
      );

      expect(decision.entries).toEqual([{ id: "hat-trick", isNew: false }]);
      expect(decision.notification).toBeNull();
    });

    it("should skip a held row that was already seen", () => {
      const decision = decideCelebrations(
        input({
          held: [{ id: "hat-trick", seenAt: "2026-11-19T09:00:00.000Z", backfilled: false }],
        }),
      );

      expect(decision.entries).toEqual([]);
    });

    it("should never queue a backfilled row but count it for the summary card", () => {
      const decision = decideCelebrations(
        input({
          held: [
            { id: "hat-trick", seenAt: null, backfilled: true },
            { id: "first-bite", seenAt: null, backfilled: true },
          ],
        }),
      );

      expect(decision.entries).toEqual([]);
      expect(decision.notification).toBeNull();
      expect(decision.backfillSummary).toBe(2);
    });

    it("should not count a backfilled row whose card was already seen", () => {
      const decision = decideCelebrations(
        input({
          held: [{ id: "hat-trick", seenAt: "2026-11-19T09:00:00.000Z", backfilled: true }],
        }),
      );

      expect(decision.backfillSummary).toBeNull();
    });

    it("should leave out an id already in the queue", () => {
      const decision = decideCelebrations(
        input({
          held: [{ id: "hat-trick", seenAt: null, backfilled: false }],
          alreadyQueued: ["hat-trick"],
        }),
      );

      expect(decision.entries).toEqual([]);
    });

    it("should ignore a held id the catalogue does not know", () => {
      const decision = decideCelebrations(
        input({ held: [{ id: "not-a-badge", seenAt: null, backfilled: false }] }),
      );

      expect(decision.entries).toEqual([]);
    });

    it("should put the new ids first, in the engine's order, then the held ones", () => {
      const decision = decideCelebrations(
        input({
          run: { ...quietRun, newUnlocks: ["first-bite", "hat-trick"] },
          recorded: ["hat-trick", "first-bite"],
          held: [{ id: "set-the-course", seenAt: null, backfilled: false }],
        }),
      );

      expect(decision.entries).toEqual([
        { id: "first-bite", isNew: true },
        { id: "hat-trick", isNew: true },
        { id: "set-the-course", isNew: false },
      ]);
    });
  });

  describe("a backfill run", () => {
    it("should queue nothing, send nothing and give the recorded count as the summary", () => {
      const decision = decideCelebrations(
        input({
          isBackfill: true,
          run: { ...quietRun, newUnlocks: ["first-bite", "hat-trick", "set-the-course"] },
          recorded: ["first-bite", "hat-trick", "set-the-course"],
        }),
      );

      expect(decision).toEqual({
        entries: [],
        extras: null,
        notification: null,
        backfillSummary: 3,
      });
    });

    it("should still yield no summary when nothing was earned", () => {
      const decision = decideCelebrations(input({ isBackfill: true }));

      expect(decision.backfillSummary).toBeNull();
    });
  });
});
