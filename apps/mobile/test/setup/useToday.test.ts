import { renderHook } from "@testing-library/react-native";

import { useToday } from "../../components/SetupScreen/useToday";

// 13:30 UTC on 23 October 2026 is 02:30 on the 24th in Auckland, which is on summer time.
const now = new Date("2026-10-23T13:30:00Z");

function deviceTimeZone(timeZone: string) {
  jest
    .spyOn(Intl.DateTimeFormat.prototype, "resolvedOptions")
    .mockImplementation(() => ({ timeZone }) as Intl.ResolvedDateTimeFormatOptions);
}

describe("useToday", () => {
  beforeEach(() => {
    jest.useFakeTimers({ now });
    deviceTimeZone("UTC");
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it("should be today in the device's time zone when it is given no zone", async () => {
    const { result } = await renderHook(() => useToday());

    expect(result.current).toBe("2026-10-23");
  });

  it("should be today in the zone it is given, which can be another date than the device's", async () => {
    const { result } = await renderHook(() => useToday("Pacific/Auckland"));

    expect(result.current).toBe("2026-10-24");
  });

  it("should fall back to the device's zone for a zone that is not one", async () => {
    const { result } = await renderHook(() => useToday("Not/AZone"));

    expect(result.current).toBe("2026-10-23");
  });

  it.each([null, undefined])("should fall back to the device's zone for %s", async (zone) => {
    deviceTimeZone("Pacific/Auckland");

    const { result } = await renderHook(() => useToday(zone));

    expect(result.current).toBe("2026-10-24");
  });
});
