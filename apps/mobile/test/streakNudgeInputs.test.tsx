import { renderHook } from "@testing-library/react-native";

import { useStreakNudgeInputs } from "../lib/reminderScheduler/useStreakNudgeInputs";

const mockReads = {
  zone: { data: "Europe/London" as string | null | undefined },
  state: {
    data: { run: { streaks: { daily: { today: "at_risk", current: 12 } } } } as
      | { run: { streaks: { daily: { today: "complete" | "at_risk"; current: number } } } }
      | undefined,
  },
};
const mockUseAchievementState = jest.fn((_options: { enabled: boolean }) => mockReads.state);

jest.mock("@keylow/api-client", () => ({
  useProfileTimeZone: () => mockReads.zone,
  useAchievementState: (options: { enabled: boolean }) => mockUseAchievementState(options),
}));
jest.mock("../lib/reminderSettings", () => ({
  useReminderSettings: () => ({ settings: { trainEnabled: false, foodEnabled: false } }),
}));

// 2026-10-22 22:30 UTC is already Friday 2026-10-23 in Sydney (UTC+11) and still Thursday in London (UTC+1).
const NOW = new Date("2026-10-22T22:30:00.000Z");

describe("what the streak nudge is planned from", () => {
  beforeEach(() => {
    mockReads.zone = { data: "Europe/London" };
    mockReads.state = {
      data: { run: { streaks: { daily: { today: "at_risk", current: 12 } } } },
    };
    mockUseAchievementState.mockClear();
    jest.useFakeTimers({ now: NOW });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("should give the zone, the local date and the core's daily streak", async () => {
    const { result } = await renderHook(() => useStreakNudgeInputs({ enabled: true }));

    expect(result.current).toEqual({
      timeZone: "Europe/London",
      localDate: "2026-10-22",
      today: "at_risk",
      currentStreak: 12,
    });
  });

  it("should take the local date from the person's own zone", async () => {
    mockReads.zone = { data: "Australia/Sydney" };

    const { result } = await renderHook(() => useStreakNudgeInputs({ enabled: true }));

    expect(result.current?.localDate).toBe("2026-10-23");
  });

  it("should read in UTC for a profile with no zone", async () => {
    mockReads.zone = { data: null };

    const { result } = await renderHook(() => useStreakNudgeInputs({ enabled: true }));

    expect(result.current?.timeZone).toBe("UTC");
  });

  it("should be null until the zone and the streak are both read", async () => {
    mockReads.state = { data: undefined };
    const first = await renderHook(() => useStreakNudgeInputs({ enabled: true }));
    expect(first.result.current).toBeNull();

    mockReads.state = { data: { run: { streaks: { daily: { today: "complete", current: 1 } } } } };
    mockReads.zone = { data: undefined };
    const second = await renderHook(() => useStreakNudgeInputs({ enabled: true }));
    expect(second.result.current).toBeNull();
  });

  it("should pass on whether it may read", async () => {
    await renderHook(() => useStreakNudgeInputs({ enabled: false }));

    expect(mockUseAchievementState).toHaveBeenLastCalledWith(
      expect.objectContaining({ enabled: false }),
    );
  });
});
