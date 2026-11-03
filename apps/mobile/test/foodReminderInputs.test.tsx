import { renderHook } from "@testing-library/react-native";

import { useFoodReminderInputs } from "../lib/reminderScheduler/useFoodReminderInputs";

const mockReads = {
  zone: { data: "Europe/London" as string | null | undefined },
  day: { data: { entries: [] } as { entries: unknown[] } | undefined },
};
const mockUseDiaryDay = jest.fn(
  (_localDate: string, _options: { enabled: boolean }) => mockReads.day,
);

// The reads have their own tests in the api-client. Here they are whatever the test says they are.
jest.mock("@keylow/api-client", () => ({
  useProfileTimeZone: () => mockReads.zone,
  useDiaryDay: (localDate: string, options: { enabled: boolean }) =>
    mockUseDiaryDay(localDate, options),
}));

// 2026-10-22 23:30 UTC is already Friday 2026-10-23 in Sydney (UTC+11) and still Thursday in London (UTC+1).
const NOW = new Date("2026-10-22T23:30:00.000Z");

describe("what the food reminder is planned from", () => {
  beforeEach(() => {
    mockReads.zone = { data: "Europe/London" };
    mockReads.day = { data: { entries: [] } };
    mockUseDiaryDay.mockClear();
    jest.useFakeTimers({ now: NOW });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("should say nothing was logged today when today's diary has no entry", async () => {
    const { result } = await renderHook(() => useFoodReminderInputs({ enabled: true }));

    expect(result.current).toEqual({ timeZone: "Europe/London", loggedToday: false });
  });

  it("should say something was logged today when today's diary has an entry", async () => {
    mockReads.day = { data: { entries: [{}] } };

    const { result } = await renderHook(() => useFoodReminderInputs({ enabled: true }));

    expect(result.current).toEqual({ timeZone: "Europe/London", loggedToday: true });
  });

  it("should read the diary day of the person's own zone", async () => {
    mockReads.zone = { data: "Australia/Sydney" };

    const { result } = await renderHook(() => useFoodReminderInputs({ enabled: true }));

    expect(mockUseDiaryDay).toHaveBeenLastCalledWith("2026-10-23", { enabled: true });
    expect(result.current?.timeZone).toBe("Australia/Sydney");
  });

  it("should read in UTC for a profile with no zone", async () => {
    mockReads.zone = { data: null };

    const { result } = await renderHook(() => useFoodReminderInputs({ enabled: true }));

    expect(result.current?.timeZone).toBe("UTC");
    expect(mockUseDiaryDay).toHaveBeenLastCalledWith("2026-10-22", { enabled: true });
  });

  it("should be null until the zone is read, and read no diary day", async () => {
    mockReads.zone = { data: undefined };

    const { result } = await renderHook(() => useFoodReminderInputs({ enabled: true }));

    expect(result.current).toBeNull();
    expect(mockUseDiaryDay).toHaveBeenLastCalledWith(expect.any(String), { enabled: false });
  });

  it("should be null until the diary day is read", async () => {
    mockReads.day = { data: undefined };

    const { result } = await renderHook(() => useFoodReminderInputs({ enabled: true }));

    expect(result.current).toBeNull();
  });

  it("should read nothing while it is not enabled", async () => {
    await renderHook(() => useFoodReminderInputs({ enabled: false }));

    expect(mockUseDiaryDay).toHaveBeenLastCalledWith(expect.any(String), { enabled: false });
  });
});
