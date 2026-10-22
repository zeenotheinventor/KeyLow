import { act, renderHook } from "@testing-library/react-native";

import { useReminderPlanInputs } from "../lib/reminderScheduler/useReminderPlanInputs";

type Read = { data: unknown };

const EXERCISE_ID = "00000000-0000-4000-8000-000000000001";

const mockReads: Record<"zone" | "routine" | "sessions" | "heatSets" | "detail" | "trend", Read> = {
  zone: { data: "Europe/London" },
  routine: { data: null },
  sessions: { data: [] },
  heatSets: { data: [] },
  detail: { data: null },
  trend: { data: { sets: [], earlier: [] } },
};

// The reads have their own tests in the api-client. Here they are whatever the test says they are.
jest.mock("@keylow/api-client", () => ({
  weekStartOf:
    jest.requireActual<typeof import("@keylow/api-client")>("@keylow/api-client").weekStartOf,
  useProfileTimeZone: () => mockReads.zone,
  useActiveRoutine: () => mockReads.routine,
  useWeekSessionRows: () => mockReads.sessions,
  useHeatSets: () => mockReads.heatSets,
  useRoutine: () => mockReads.detail,
  useRoutineTrendSets: () => mockReads.trend,
}));

const activeRoutine = { id: "routine-1", days: [{ weekday: 3, exercises: [] }] };
const routineDetail = {
  days: [
    {
      id: "day-1",
      name: "Day one",
      position: 0,
      exercises: [{ exercise_id: EXERCISE_ID, position: 0 }],
    },
  ],
};
const workingSet = (localDate: string, loadKg: number) => ({
  exercise_id: EXERCISE_ID,
  set_type: "working",
  reps: 8,
  load_kg: loadKg,
  local_date: localDate,
});

// 2026-10-22 is a Thursday.
const NOW = new Date("2026-10-22T09:00:00.000Z");

function withActiveRoutine() {
  mockReads.routine = { data: activeRoutine };
  mockReads.detail = { data: routineDetail };
}

describe("what the reminders are planned from", () => {
  beforeEach(() => {
    mockReads.zone = { data: "Europe/London" };
    mockReads.routine = { data: null };
    mockReads.sessions = { data: [] };
    mockReads.heatSets = { data: [] };
    mockReads.detail = { data: null };
    mockReads.trend = { data: { sets: [], earlier: [] } };
    jest.useFakeTimers({ now: NOW });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("should give the zone, the plan, the sessions, the sets and the gain once everything is read", async () => {
    withActiveRoutine();

    const { result } = await renderHook(() => useReminderPlanInputs({ enabled: true }));

    expect(result.current).toEqual({
      timeZone: "Europe/London",
      plan: activeRoutine,
      sessions: [],
      heatSets: [],
      weeklyGain: false,
    });
  });

  describe("until every read is there", () => {
    const missing: [string, () => void][] = [
      ["the time zone", () => (mockReads.zone = { data: undefined })],
      ["the active routine", () => (mockReads.routine = { data: undefined })],
      ["this week's sessions", () => (mockReads.sessions = { data: undefined })],
      ["the sets of the heat window", () => (mockReads.heatSets = { data: undefined })],
      ["the routine's days", () => (mockReads.detail = { data: undefined })],
      ["the routine's trend rows", () => (mockReads.trend = { data: undefined })],
    ];

    it.each(missing)("should be null while %s is not read", async (_name, makeMissing) => {
      withActiveRoutine();
      makeMissing();

      const { result } = await renderHook(() => useReminderPlanInputs({ enabled: true }));

      expect(result.current).toBeNull();
    });
  });

  describe("with no active routine", () => {
    it("should give the inputs without the routine's days or trend, and no gain", async () => {
      mockReads.detail = { data: undefined };
      mockReads.trend = { data: undefined };

      const { result } = await renderHook(() => useReminderPlanInputs({ enabled: true }));

      expect(result.current).toEqual({
        timeZone: "Europe/London",
        plan: null,
        sessions: [],
        heatSets: [],
        weeklyGain: false,
      });
    });
  });

  describe("the weekly gain", () => {
    it("should be true when an exercise of the routine went up this week", async () => {
      withActiveRoutine();
      mockReads.trend = {
        data: {
          sets: [workingSet("2026-10-13", 50), workingSet("2026-10-20", 55)],
          earlier: [],
        },
      };

      const { result } = await renderHook(() => useReminderPlanInputs({ enabled: true }));

      expect(result.current?.weeklyGain).toBe(true);
    });

    it("should be false when the routine is not found", async () => {
      withActiveRoutine();
      mockReads.detail = { data: null };

      const { result } = await renderHook(() => useReminderPlanInputs({ enabled: true }));

      expect(result.current?.weeklyGain).toBe(false);
    });
  });

  it("should read a profile with no zone in UTC", async () => {
    mockReads.zone = { data: null };

    const { result } = await renderHook(() => useReminderPlanInputs({ enabled: true }));

    expect(result.current?.timeZone).toBe("UTC");
  });

  describe("its identity", () => {
    it("should stay the same object across a render and a tick of the clock", async () => {
      withActiveRoutine();
      const { result, rerender } = await renderHook(() => useReminderPlanInputs({ enabled: true }));
      const first = result.current;
      expect(first).not.toBeNull();

      await rerender(undefined);
      await act(async () => {
        await jest.advanceTimersByTimeAsync(60_000);
      });

      expect(result.current).toBe(first);
    });

    it("should be a new object carrying the sessions when a session is finished", async () => {
      withActiveRoutine();
      const { result, rerender } = await renderHook(() => useReminderPlanInputs({ enabled: true }));
      const before = result.current;

      const finished = [
        { local_date: "2026-10-22", ended_at: "2026-10-22T09:00:00Z", deleted_at: null },
      ];
      mockReads.sessions = { data: finished };
      await rerender(undefined);

      expect(result.current).not.toBe(before);
      expect(result.current?.sessions).toBe(finished);
    });
  });
});
