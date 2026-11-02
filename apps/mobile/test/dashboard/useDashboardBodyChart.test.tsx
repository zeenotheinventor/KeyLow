import { act, renderHook, waitFor } from "@testing-library/react-native";

import { startDashboardBodyChartRead, useDashboardBodyChart } from "../../lib/dashboardBodyChart";
import { resetDashboardBodyChartForTests } from "../../lib/dashboardBodyChart/testing";

const mockStorageItems = new Map<string, string>();
const mockGetItem = jest.fn((key: string) => Promise.resolve(mockStorageItems.get(key) ?? null));
const mockSetItem = jest.fn((key: string, value: string) => {
  mockStorageItems.set(key, value);
  return Promise.resolve();
});

jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: {
    getItem: (key: string) => mockGetItem(key),
    setItem: (key: string, value: string) => mockSetItem(key, value),
  },
}));

function pendingRead() {
  let finishRead: (value: string | null) => void = () => undefined;
  mockGetItem.mockReturnValueOnce(
    new Promise<string | null>((resolve) => {
      finishRead = resolve;
    }),
  );
  return (value: string | null) => {
    finishRead(value);
  };
}

describe("useDashboardBodyChart", () => {
  beforeEach(() => {
    mockStorageItems.clear();
    mockGetItem.mockClear();
    mockSetItem.mockClear();
    resetDashboardBodyChartForTests();
  });

  it("should say it is not ready until the read has come back, and be Heat meanwhile", async () => {
    const finishRead = pendingRead();

    const { result } = await renderHook(() => useDashboardBodyChart());

    expect(result.current).toMatchObject({ isReady: false, chart: "heat" });
    await act(() => {
      finishRead("volume");
    });
    await waitFor(() => {
      expect(result.current.isReady).toBe(true);
    });
    expect(result.current.chart).toBe("volume");
  });

  it("should be Heat and ready on a fresh install, when nothing is saved", async () => {
    const { result } = await renderHook(() => useDashboardBodyChart());

    await waitFor(() => {
      expect(result.current.isReady).toBe(true);
    });
    expect(result.current.chart).toBe("heat");
  });

  it("should be Volume when Volume was saved", async () => {
    mockStorageItems.set("dashboard.bodyChart", "volume");

    const { result } = await renderHook(() => useDashboardBodyChart());

    await waitFor(() => {
      expect(result.current.isReady).toBe(true);
    });
    expect(result.current.chart).toBe("volume");
  });

  it("should be Heat when the saved value is not a chart", async () => {
    mockStorageItems.set("dashboard.bodyChart", "gap");

    const { result } = await renderHook(() => useDashboardBodyChart());

    await waitFor(() => {
      expect(result.current.isReady).toBe(true);
    });
    expect(result.current.chart).toBe("heat");
  });

  it("should be Heat, ready, and never throw, when the store cannot be read", async () => {
    mockGetItem.mockRejectedValueOnce(new Error("storage is down"));

    const { result } = await renderHook(() => useDashboardBodyChart());

    await waitFor(() => {
      expect(result.current.isReady).toBe(true);
    });
    expect(result.current.chart).toBe("heat");
  });

  it("should change the chart at once and save it", async () => {
    const { result } = await renderHook(() => useDashboardBodyChart());
    await waitFor(() => {
      expect(result.current.isReady).toBe(true);
    });

    await act(() => {
      result.current.setChart("volume");
    });

    expect(result.current.chart).toBe("volume");
    expect(mockSetItem).toHaveBeenCalledWith("dashboard.bodyChart", "volume");
  });

  it("should keep the chart for this visit, and raise nothing, when it cannot be saved", async () => {
    mockSetItem.mockRejectedValueOnce(new Error("storage is full"));
    const { result } = await renderHook(() => useDashboardBodyChart());
    await waitFor(() => {
      expect(result.current.isReady).toBe(true);
    });

    await act(() => {
      result.current.setChart("volume");
    });

    expect(result.current.chart).toBe("volume");
  });

  it("should reach every reader with one change, and read the store once", async () => {
    const settingRow = await renderHook(() => useDashboardBodyChart());
    const dashboard = await renderHook(() => useDashboardBodyChart());
    await waitFor(() => {
      expect(dashboard.result.current.isReady).toBe(true);
    });

    await act(() => {
      settingRow.result.current.setChart("volume");
    });

    expect(dashboard.result.current.chart).toBe("volume");
    expect(mockGetItem).toHaveBeenCalledTimes(1);
  });

  it("should have read the store already when a reader asks, if the app started the read", async () => {
    mockStorageItems.set("dashboard.bodyChart", "volume");
    startDashboardBodyChartRead();
    await act(async () => {
      await Promise.resolve();
    });

    const { result } = await renderHook(() => useDashboardBodyChart());

    expect(result.current).toMatchObject({ isReady: true, chart: "volume" });
    expect(mockGetItem).toHaveBeenCalledTimes(1);
  });

  it("should keep a choice made before the read came back", async () => {
    const finishRead = pendingRead();
    const { result } = await renderHook(() => useDashboardBodyChart());
    await act(() => {
      result.current.setChart("volume");
    });

    await act(() => {
      finishRead("heat");
    });
    await waitFor(() => {
      expect(result.current.isReady).toBe(true);
    });

    expect(result.current.chart).toBe("volume");
  });

  describe("when the store never answers", () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it("should give up after three seconds and be Heat and ready, so the card is not held for good", async () => {
      mockGetItem.mockReturnValueOnce(new Promise<string | null>(() => undefined));
      const { result } = await renderHook(() => useDashboardBodyChart());

      await act(() => {
        jest.advanceTimersByTime(2999);
      });
      expect(result.current.isReady).toBe(false);
      await act(() => {
        jest.advanceTimersByTime(1);
      });

      expect(result.current).toMatchObject({ isReady: true, chart: "heat" });
    });

    it("should apply a late answer", async () => {
      const finishRead = pendingRead();
      const { result } = await renderHook(() => useDashboardBodyChart());
      await act(() => {
        jest.advanceTimersByTime(3000);
      });

      await act(() => {
        finishRead("volume");
      });

      expect(result.current).toMatchObject({ chart: "volume", isReady: true });
    });

    it("should apply a late answer, but not over a choice made since", async () => {
      const finishRead = pendingRead();
      const { result } = await renderHook(() => useDashboardBodyChart());
      await act(() => {
        jest.advanceTimersByTime(3000);
      });
      await act(() => {
        result.current.setChart("heat");
      });

      await act(() => {
        finishRead("volume");
      });

      expect(result.current.chart).toBe("heat");
    });
  });
});
