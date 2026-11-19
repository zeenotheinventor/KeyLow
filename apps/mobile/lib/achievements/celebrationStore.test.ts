import {
  acknowledgeCelebrations,
  getCelebrationState,
  getQueuedIds,
  recordCelebrations,
  resetCelebrations,
} from "./celebrationStore";

const notification = {
  title: "Badge earned: Hat Trick",
  body: "x",
  achievementId: "hat-trick",
} as const;

describe("celebrationStore", () => {
  beforeEach(() => {
    resetCelebrations();
  });

  it("should add the entries of each run and keep the notification of the last run that had one", () => {
    recordCelebrations(
      {
        entries: [{ id: "hat-trick", isNew: true }],
        extras: { freezes: 1, levelName: null },
        notification,
        backfillSummary: null,
      },
      true,
    );
    recordCelebrations(
      {
        entries: [{ id: "first-bite", isNew: false }],
        extras: null,
        notification: null,
        backfillSummary: null,
      },
      false,
    );

    expect(getCelebrationState()).toEqual({
      entries: [
        { id: "hat-trick", isNew: true },
        { id: "first-bite", isNew: false },
      ],
      extras: { freezes: 1, levelName: null },
      notification,
      wasActive: false,
      backfillSummary: null,
    });
  });

  it("should keep the very same state for a run that decided nothing", () => {
    const before = getCelebrationState();

    recordCelebrations(
      { entries: [], extras: null, notification: null, backfillSummary: null },
      true,
    );

    expect(getCelebrationState()).toBe(before);
  });

  it("should take acknowledged ids out of the queue and remember them for later runs", () => {
    recordCelebrations(
      {
        entries: [{ id: "hat-trick", isNew: true }],
        extras: { freezes: 1, levelName: null },
        notification,
        backfillSummary: null,
      },
      true,
    );

    acknowledgeCelebrations(["hat-trick"]);

    expect(getCelebrationState().entries).toEqual([]);
    expect(getCelebrationState().notification).toBeNull();
    expect(getQueuedIds()).toEqual(["hat-trick"]);
  });

  it("should add up the freezes of the runs that queued entries and keep the latest level", () => {
    recordCelebrations(
      {
        entries: [{ id: "hat-trick", isNew: true }],
        extras: { freezes: 1, levelName: "Sprout" },
        notification: null,
        backfillSummary: null,
      },
      true,
    );
    recordCelebrations(
      {
        entries: [{ id: "first-bite", isNew: true }],
        extras: { freezes: 2, levelName: null },
        notification: null,
        backfillSummary: null,
      },
      true,
    );

    expect(getCelebrationState().extras).toEqual({ freezes: 3, levelName: "Sprout" });
  });

  it("should not keep the extras of a run that queued no entries, so a level reached with no badge never attaches to a later drain", () => {
    recordCelebrations(
      {
        entries: [],
        extras: { freezes: 0, levelName: "Sapling" },
        notification: null,
        backfillSummary: null,
      },
      true,
    );
    recordCelebrations(
      {
        entries: [{ id: "first-bite", isNew: false }],
        extras: null,
        notification: null,
        backfillSummary: null,
      },
      true,
    );

    expect(getCelebrationState().extras).toBeNull();
  });

  it("should drop the extras with the entries they came with", () => {
    recordCelebrations(
      {
        entries: [{ id: "hat-trick", isNew: true }],
        extras: { freezes: 1, levelName: null },
        notification: null,
        backfillSummary: null,
      },
      true,
    );

    acknowledgeCelebrations(["hat-trick"]);

    expect(getCelebrationState().extras).toBeNull();
  });

  it("should forget everything on reset", () => {
    acknowledgeCelebrations(["hat-trick"]);

    resetCelebrations();

    expect(getQueuedIds()).toEqual([]);
  });
});
