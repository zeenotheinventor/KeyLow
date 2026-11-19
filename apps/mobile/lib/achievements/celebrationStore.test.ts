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
      { entries: [{ id: "hat-trick", isNew: true }], notification, backfillSummary: null },
      true,
    );
    recordCelebrations(
      { entries: [{ id: "first-bite", isNew: false }], notification: null, backfillSummary: null },
      false,
    );

    expect(getCelebrationState()).toEqual({
      entries: [
        { id: "hat-trick", isNew: true },
        { id: "first-bite", isNew: false },
      ],
      notification,
      wasActive: false,
      backfillSummary: null,
    });
  });

  it("should keep the very same state for a run that decided nothing", () => {
    const before = getCelebrationState();

    recordCelebrations({ entries: [], notification: null, backfillSummary: null }, true);

    expect(getCelebrationState()).toBe(before);
  });

  it("should take acknowledged ids out of the queue and remember them for later runs", () => {
    recordCelebrations(
      { entries: [{ id: "hat-trick", isNew: true }], notification, backfillSummary: null },
      true,
    );

    acknowledgeCelebrations(["hat-trick"]);

    expect(getCelebrationState().entries).toEqual([]);
    expect(getCelebrationState().notification).toBeNull();
    expect(getQueuedIds()).toEqual(["hat-trick"]);
  });

  it("should forget everything on reset", () => {
    acknowledgeCelebrations(["hat-trick"]);

    resetCelebrations();

    expect(getQueuedIds()).toEqual([]);
  });
});
