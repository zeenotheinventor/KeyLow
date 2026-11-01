import { act, renderHook, waitFor } from "@testing-library/react-native";

import { startDashboardBodyScaleRead, useDashboardBodyScale } from "../../lib/dashboardBodyScale";
import { resetDashboardBodyScaleForTests } from "../../lib/dashboardBodyScale/testing";

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

describe("useDashboardBodyScale", () => {
  beforeEach(() => {
    mockStorageItems.clear();
    mockGetItem.mockClear();
    mockSetItem.mockClear();
    resetDashboardBodyScaleForTests();
  });

  it("should say it is not ready until the read has come back, and be heat meanwhile", async () => {
    const finishRead = pendingRead();

    const { result } = await renderHook(() => useDashboardBodyScale());

    expect(result.current).toMatchObject({ isReady: false, scale: "heat" });
    await act(() => {
      finishRead("volume");
    });
    await waitFor(() => {
      expect(result.current.isReady).toBe(true);
    });
    expect(result.current.scale).toBe("volume");
  });

  it("should be heat and ready on a fresh install, when nothing is saved", async () => {
    const { result } = await renderHook(() => useDashboardBodyScale());

    await waitFor(() => {
      expect(result.current.isReady).toBe(true);
    });
    expect(result.current.scale).toBe("heat");
  });

  it("should be weekly volume when weekly volume was saved", async () => {
    mockStorageItems.set("bodyMap.dashboardScale", "volume");

    const { result } = await renderHook(() => useDashboardBodyScale());

    await waitFor(() => {
      expect(result.current.isReady).toBe(true);
    });
    expect(result.current.scale).toBe("volume");
  });

  it("should be heat when the saved value is not a dashboard chart", async () => {
    mockStorageItems.set("bodyMap.dashboardScale", "gap");

    const { result } = await renderHook(() => useDashboardBodyScale());

    await waitFor(() => {
      expect(result.current.isReady).toBe(true);
    });
    expect(result.current.scale).toBe("heat");
  });

  it("should be heat, ready, and never throw, when the store cannot be read", async () => {
    mockGetItem.mockRejectedValueOnce(new Error("storage is down"));

    const { result } = await renderHook(() => useDashboardBodyScale());

    await waitFor(() => {
      expect(result.current.isReady).toBe(true);
    });
    expect(result.current.scale).toBe("heat");
  });

  it("should change the chart at once and save it", async () => {
    const { result } = await renderHook(() => useDashboardBodyScale());
    await waitFor(() => {
      expect(result.current.isReady).toBe(true);
    });

    await act(() => {
      result.current.setScale("volume");
    });

    expect(result.current.scale).toBe("volume");
    expect(mockSetItem).toHaveBeenCalledWith("bodyMap.dashboardScale", "volume");
  });

  it("should keep the chart for this visit, and raise nothing, when it cannot be saved", async () => {
    mockSetItem.mockRejectedValueOnce(new Error("storage is full"));
    const { result } = await renderHook(() => useDashboardBodyScale());
    await waitFor(() => {
      expect(result.current.isReady).toBe(true);
    });

    await act(() => {
      result.current.setScale("volume");
    });

    expect(result.current.scale).toBe("volume");
  });

  it("should share the chart between every reader, and read the store once", async () => {
    mockStorageItems.set("bodyMap.dashboardScale", "heat");
    const settingRow = await renderHook(() => useDashboardBodyScale());
    const dashboard = await renderHook(() => useDashboardBodyScale());
    await waitFor(() => {
      expect(dashboard.result.current.isReady).toBe(true);
    });

    await act(() => {
      settingRow.result.current.setScale("volume");
    });

    expect(dashboard.result.current.scale).toBe("volume");
    expect(mockGetItem).toHaveBeenCalledTimes(1);
  });

  it("should have read the store already when a reader asks, if the app started the read", async () => {
    mockStorageItems.set("bodyMap.dashboardScale", "volume");
    startDashboardBodyScaleRead();
    await act(async () => {
      await Promise.resolve();
    });

    const { result } = await renderHook(() => useDashboardBodyScale());

    expect(result.current).toMatchObject({ isReady: true, scale: "volume" });
    expect(mockGetItem).toHaveBeenCalledTimes(1);
  });

  it("should keep a choice made before the read came back", async () => {
    const finishRead = pendingRead();
    const { result } = await renderHook(() => useDashboardBodyScale());
    await act(() => {
      result.current.setScale("volume");
    });

    await act(() => {
      finishRead("heat");
    });
    await waitFor(() => {
      expect(result.current.isReady).toBe(true);
    });

    expect(result.current.scale).toBe("volume");
  });

  describe("when the store never answers", () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it("should give up after three seconds and be heat and ready, so the dashboard is not held for good", async () => {
      mockGetItem.mockReturnValueOnce(new Promise<string | null>(() => undefined));
      const { result } = await renderHook(() => useDashboardBodyScale());

      await act(() => {
        jest.advanceTimersByTime(2999);
      });
      expect(result.current.isReady).toBe(false);
      await act(() => {
        jest.advanceTimersByTime(1);
      });

      expect(result.current).toMatchObject({ isReady: true, scale: "heat" });
    });

    it("should apply a late answer", async () => {
      const finishRead = pendingRead();
      const { result } = await renderHook(() => useDashboardBodyScale());
      await act(() => {
        jest.advanceTimersByTime(3000);
      });
      expect(result.current.scale).toBe("heat");

      await act(() => {
        finishRead("volume");
      });

      expect(result.current).toMatchObject({ scale: "volume", isReady: true });
    });

    it("should apply a late answer, but not over a choice made since", async () => {
      const finishRead = pendingRead();
      const { result } = await renderHook(() => useDashboardBodyScale());
      await act(() => {
        jest.advanceTimersByTime(3000);
      });
      await act(() => {
        result.current.setScale("heat");
      });

      await act(() => {
        finishRead("volume");
      });

      expect(result.current.scale).toBe("heat");
    });
  });
});
