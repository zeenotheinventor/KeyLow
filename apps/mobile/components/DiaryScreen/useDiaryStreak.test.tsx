import { useAchievementState } from "@keylow/api-client";
import { renderHook } from "@testing-library/react-native";

import { useDiaryStreak } from "./useDiaryStreak";

import type * as ApiClient from "@keylow/api-client";

jest.mock("@keylow/api-client", () => ({
  ...jest.requireActual<typeof ApiClient>("@keylow/api-client"),
  useAchievementState: jest.fn(),
}));

const mockState = jest.mocked(useAchievementState);
const now = new Date("2026-11-19T10:00:00Z");

// Only the part of the query result the hook reads, so the rest of the query result is cast away.
function stateWith(daily: { current: number; today: "complete" | "at_risk" } | undefined) {
  mockState.mockReturnValue({
    data: daily === undefined ? undefined : { run: { streaks: { daily } } },
  } as ReturnType<typeof useAchievementState>);
}

describe("useDiaryStreak", () => {
  beforeEach(() => {
    mockState.mockReset();
  });

  it("should say the streak and that today is counted when today is complete", async () => {
    stateWith({ current: 12, today: "complete" });

    const { result } = await renderHook(() => useDiaryStreak(now, true));

    expect(result.current).toEqual({ current: 12, isTodayCounted: true });
  });

  it("should say today is not counted while today is at risk", async () => {
    stateWith({ current: 11, today: "at_risk" });

    const { result } = await renderHook(() => useDiaryStreak(now, true));

    expect(result.current).toEqual({ current: 11, isTodayCounted: false });
  });

  it("should be null while the stats are not read", async () => {
    stateWith(undefined);

    const { result } = await renderHook(() => useDiaryStreak(now, true));

    expect(result.current).toBeNull();
  });

  it("should read only when reads are enabled", async () => {
    stateWith(undefined);

    await renderHook(() => useDiaryStreak(now, false));

    expect(mockState).toHaveBeenCalledWith(expect.objectContaining({ enabled: false, now }));
  });
});
