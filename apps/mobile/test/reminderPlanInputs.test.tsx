import { MISSED_LOOKBACK_DAYS, planTrainingReminders } from "@keylow/core/training";
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

// What each week's sessions read is given, by the Monday of the week. Weeks not named read as `mockReads.sessions`.
const mockWeekReads = new Map<string, Read>();
const mockWeekSessionsCalls: { weekStart: string | null; enabled: boolean }[] = [];

// The reads have their own tests in the api-client. Here they are whatever the test says they are.
jest.mock("@keylow/api-client", () => ({
  ...jest.requireActual<Pick<typeof import("@keylow/api-client"), "weekStartOf" | "planRoutineOf">>(
    "@keylow/api-client",
  ),
  useProfileTimeZone: () => mockReads.zone,
  useActiveRoutine: () => mockReads.routine,
  useWeekSessionRows: (args: { weekStart: string | null; enabled: boolean }) => {
    mockWeekSessionsCalls.push(args);
    return (
      (args.weekStart === null ? undefined : mockWeekReads.get(args.weekStart)) ??
      mockReads.sessions
    );
  },
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

// 2026-10-22 is a Thursday, in the week that starts on Monday 2026-10-19.
const NOW = new Date("2026-10-22T09:00:00.000Z");
const THIS_WEEK = "2026-10-19";
const WEEKS_BACK = ["2026-10-12", "2026-10-05", "2026-09-28"];

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
    mockWeekReads.clear();
    mockWeekSessionsCalls.length = 0;
    jest.useFakeTimers({ now: NOW });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("should give the zone, the plan, the sessions, the sets and the gain once everything is read", async () => {
    withActiveRoutine();

    const { result } = await renderHook(() =>
      useReminderPlanInputs({ enabled: true, includeEarlierWeeks: true }),
    );

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

      const { result } = await renderHook(() =>
        useReminderPlanInputs({ enabled: true, includeEarlierWeeks: true }),
      );

      expect(result.current).toBeNull();
    });
  });

  describe("the sessions for the missed day rules", () => {
    const session = (localDate: string) => ({
      id: `session-${localDate}`,
      local_date: localDate,
      started_at: `${localDate}T08:00:00Z`,
      ended_at: `${localDate}T09:00:00Z`,
      deleted_at: null,
      routine_day_id: "day-1",
    });

    it("should read this week and every earlier week the core looks back into", async () => {
      await renderHook(() => useReminderPlanInputs({ enabled: true, includeEarlierWeeks: true }));

      const weekStarts = new Set(mockWeekSessionsCalls.map(({ weekStart }) => weekStart));
      expect([...weekStarts]).toEqual([THIS_WEEK, ...WEEKS_BACK]);
      // The first day the core looks at, 21 days before today, is inside the oldest week read.
      expect(MISSED_LOOKBACK_DAYS).toBeLessThanOrEqual(7 * WEEKS_BACK.length);
    });

    it("should give the sessions of every week, the oldest first", async () => {
      mockWeekReads.set(THIS_WEEK, { data: [session("2026-10-21")] });
      mockWeekReads.set("2026-10-12", { data: [session("2026-10-14")] });
      mockWeekReads.set("2026-09-28", { data: [session("2026-09-30")] });

      const { result } = await renderHook(() =>
        useReminderPlanInputs({ enabled: true, includeEarlierWeeks: true }),
      );

      expect(result.current?.sessions.map(({ local_date }) => local_date)).toEqual([
        "2026-09-30",
        "2026-10-14",
        "2026-10-21",
      ]);
    });

    it("should read none of the weeks while it is not enabled", async () => {
      await renderHook(() => useReminderPlanInputs({ enabled: false, includeEarlierWeeks: true }));

      expect(mockWeekSessionsCalls.length).toBeGreaterThan(0);
      expect(mockWeekSessionsCalls.every(({ enabled }) => !enabled)).toBe(true);
    });
  });

  describe("what the missed day rules need from the caller", () => {
    // The core cannot tell by itself that these are missing: it judges the lookback without them.
    const plannedDay = (id: string, weekday: number) => ({
      id,
      name: id,
      position: weekday,
      weekday,
      exercises: [],
    });
    const planFrom = (inputs: ReturnType<typeof useReminderPlanInputs>) => {
      if (inputs === null) {
        throw new Error("The inputs were not read");
      }
      return planTrainingReminders({
        ...inputs,
        now: "2026-10-22T06:00:00.000Z",
        settings: {
          trainEnabled: false,
          progressEnabled: false,
          easeEnabled: false,
          trainTime: "17:30",
          missedEnabled: true,
          checkinEnabled: true,
        },
        lastVariantIds: {},
      }).map(({ type, fireAt }) => ({ type, fireAt }));
    };

    it("should carry the day when the routine began, so the days before it are not judged missed", async () => {
      // Wednesday is the one planned day, and the routine was made active on Monday 19th, London time.
      mockReads.routine = {
        data: {
          id: "routine-1",
          name: "Routine",
          activatedAt: "2026-10-19T08:00:00.000Z",
          days: [plannedDay("day-2", 2)],
        },
      };
      mockReads.detail = { data: { days: [] } };

      const { result } = await renderHook(() =>
        useReminderPlanInputs({ enabled: true, includeEarlierWeeks: true }),
      );

      expect(result.current?.plan?.activeFrom).toBe("2026-10-19");
      // Wednesday's one miss is a fresh start. Without the start, the weeks before count and it is a check in.
      expect(planFrom(result.current)[0]).toEqual({
        type: "missed",
        fireAt: "2026-10-22T08:00:00.000Z",
      });
    });

    it("should hand the planner the days' ids and each session's fields as they were read, so it sees a make-up", async () => {
      // Tuesday's day was done late on Wednesday, so Wednesday's own day is the one that was missed.
      mockReads.routine = {
        data: {
          id: "routine-1",
          name: "Routine",
          activatedAt: "2026-10-19T08:00:00.000Z",
          days: [plannedDay("day-1", 1), plannedDay("day-2", 2)],
        },
      };
      mockReads.detail = { data: { days: [] } };
      mockWeekReads.set(THIS_WEEK, {
        data: [
          {
            id: "session-1",
            local_date: "2026-10-21",
            started_at: "2026-10-21T08:00:00Z",
            ended_at: "2026-10-21T09:00:00Z",
            deleted_at: null,
            routine_day_id: "day-1",
          },
        ],
      });

      const { result } = await renderHook(() =>
        useReminderPlanInputs({ enabled: true, includeEarlierWeeks: true }),
      );

      expect(result.current?.plan?.days).toEqual([
        expect.objectContaining({ id: "day-1", position: 1 }),
        expect.objectContaining({ id: "day-2", position: 2 }),
      ]);
      expect(result.current?.sessions[0]).toEqual(
        expect.objectContaining({
          id: "session-1",
          started_at: "2026-10-21T08:00:00Z",
          routine_day_id: "day-1",
        }),
      );
      expect(planFrom(result.current)[0]).toEqual({
        type: "missed",
        fireAt: "2026-10-22T08:00:00.000Z",
      });
    });
  });

  describe("until an earlier week is read", () => {
    it.each(WEEKS_BACK)(
      "should be null while the sessions of the week of %s are not read",
      async (weekStart) => {
        mockWeekReads.set(weekStart, { data: undefined });

        const { result } = await renderHook(() =>
          useReminderPlanInputs({ enabled: true, includeEarlierWeeks: true }),
        );

        expect(result.current).toBeNull();
      },
    );
  });

  describe("without the earlier weeks", () => {
    it("should read this week only, and leave the earlier weeks unread", async () => {
      await renderHook(() => useReminderPlanInputs({ enabled: true, includeEarlierWeeks: false }));

      const read = mockWeekSessionsCalls
        .filter(({ enabled }) => enabled)
        .map(({ weekStart }) => weekStart);
      expect(new Set(read)).toEqual(new Set([THIS_WEEK]));
    });

    it("should not wait for, or be blocked by, an earlier week that cannot be read", async () => {
      WEEKS_BACK.forEach((weekStart) => mockWeekReads.set(weekStart, { data: undefined }));
      mockWeekReads.set(THIS_WEEK, { data: [{ local_date: "2026-10-21" }] });

      const { result } = await renderHook(() =>
        useReminderPlanInputs({ enabled: true, includeEarlierWeeks: false }),
      );

      expect(result.current?.sessions).toEqual([{ local_date: "2026-10-21" }]);
    });
  });

  describe("a zone whose Monday is not the UTC Monday", () => {
    it("should read the weeks from the local Monday", async () => {
      // Sunday 23:30 UTC is already Monday 26 October at 12:30 in Auckland.
      mockReads.zone = { data: "Pacific/Auckland" };
      jest.setSystemTime(new Date("2026-10-25T23:30:00.000Z"));

      await renderHook(() => useReminderPlanInputs({ enabled: true, includeEarlierWeeks: true }));

      const weekStarts = new Set(
        mockWeekSessionsCalls
          .filter(({ weekStart }) => weekStart !== null)
          .map(({ weekStart }) => weekStart),
      );
      expect([...weekStarts]).toEqual(["2026-10-26", "2026-10-19", "2026-10-12", "2026-10-05"]);
    });
  });

  describe("with no active routine", () => {
    it("should give the inputs without the routine's days or trend, and no gain", async () => {
      mockReads.detail = { data: undefined };
      mockReads.trend = { data: undefined };

      const { result } = await renderHook(() =>
        useReminderPlanInputs({ enabled: true, includeEarlierWeeks: true }),
      );

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

      const { result } = await renderHook(() =>
        useReminderPlanInputs({ enabled: true, includeEarlierWeeks: true }),
      );

      expect(result.current?.weeklyGain).toBe(true);
    });

    it("should be false when the routine is not found", async () => {
      withActiveRoutine();
      mockReads.detail = { data: null };

      const { result } = await renderHook(() =>
        useReminderPlanInputs({ enabled: true, includeEarlierWeeks: true }),
      );

      expect(result.current?.weeklyGain).toBe(false);
    });
  });

  it("should read a profile with no zone in UTC", async () => {
    mockReads.zone = { data: null };

    const { result } = await renderHook(() =>
      useReminderPlanInputs({ enabled: true, includeEarlierWeeks: true }),
    );

    expect(result.current?.timeZone).toBe("UTC");
  });

  describe("its identity", () => {
    it("should stay the same object across a render and a tick of the clock", async () => {
      withActiveRoutine();
      const { result, rerender } = await renderHook(() =>
        useReminderPlanInputs({ enabled: true, includeEarlierWeeks: true }),
      );
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
      const { result, rerender } = await renderHook(() =>
        useReminderPlanInputs({ enabled: true, includeEarlierWeeks: true }),
      );
      const before = result.current;

      const finished = [
        { local_date: "2026-10-22", ended_at: "2026-10-22T09:00:00Z", deleted_at: null },
      ];
      mockWeekReads.set(THIS_WEEK, { data: finished });
      await rerender(undefined);

      expect(result.current).not.toBe(before);
      expect(result.current?.sessions).toEqual(finished);
    });
  });
});
