import { hasWeeklyGain } from "../lib/reminderScheduler/hasWeeklyGain";

// 2026-10-22 is a Thursday, so the week of the 22nd starts on Monday the 19th and the one before on the 12th.
const TODAY = "2026-10-22";
const EXERCISE_ID = "00000000-0000-4000-8000-000000000001";

const days = [
  {
    id: "day-1",
    name: "Day one",
    position: 0,
    exercises: [{ exercise_id: EXERCISE_ID, position: 0 }],
  },
];

const workingSet = (localDate: string, loadKg: number, reps: number) => ({
  exercise_id: EXERCISE_ID,
  set_type: "working" as const,
  reps,
  load_kg: loadKg,
  local_date: localDate,
});

const gainOf = (sets: ReturnType<typeof workingSet>[]) =>
  hasWeeklyGain({ days, rows: { sets, earlier: [] }, timeZone: "Europe/London", today: TODAY });

describe("the weekly gain", () => {
  it("should be true when this week's load is heavier than the week trained before", () => {
    expect(gainOf([workingSet("2026-10-13", 50, 8), workingSet("2026-10-20", 55, 8)])).toBe(true);
  });

  it("should be true when this week's reps beat the same load", () => {
    expect(gainOf([workingSet("2026-10-13", 50, 8), workingSet("2026-10-20", 50, 9)])).toBe(true);
  });

  it("should be false when this week matches last week", () => {
    expect(gainOf([workingSet("2026-10-13", 50, 8), workingSet("2026-10-20", 50, 8)])).toBe(false);
  });

  it("should be false when this week is lighter", () => {
    expect(gainOf([workingSet("2026-10-13", 55, 8), workingSet("2026-10-20", 50, 8)])).toBe(false);
  });

  it("should be false when only an earlier week was trained", () => {
    expect(gainOf([workingSet("2026-10-06", 50, 8), workingSet("2026-10-13", 55, 8)])).toBe(false);
  });

  it("should be false for a first trained week, which has nothing to beat", () => {
    expect(gainOf([workingSet("2026-10-20", 55, 8)])).toBe(false);
  });

  it("should be false with no sets", () => {
    expect(gainOf([])).toBe(false);
  });
});
