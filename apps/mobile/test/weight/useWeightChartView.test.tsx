import { act, renderHook, waitFor } from "@testing-library/react-native";

import { useWeightChartView } from "../../lib/weightChartView";

const mockStorageItems = new Map<string, string>();
const readStoredItem = (key: string) => Promise.resolve(mockStorageItems.get(key) ?? null);
const writeStoredItem = (key: string, value: string) => {
  mockStorageItems.set(key, value);
  return Promise.resolve();
};
const mockGetItem = jest.fn(readStoredItem);
const mockSetItem = jest.fn(writeStoredItem);

jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: {
    getItem: (key: string) => mockGetItem(key),
    setItem: (key: string, value: string) => mockSetItem(key, value),
  },
}));

describe("useWeightChartView", () => {
  beforeEach(() => {
    mockStorageItems.clear();
    mockGetItem.mockReset().mockImplementation(readStoredItem);
    mockSetItem.mockReset().mockImplementation(writeStoredItem);
  });

  it("should say it has not read the store, and show the defaults, until the read has come back", async () => {
    let finishRead: (value: string) => void = () => undefined;
    mockGetItem.mockReturnValueOnce(
      new Promise<string>((resolve) => {
        finishRead = resolve;
      }),
    );

    const { result } = await renderHook(() => useWeightChartView());

    expect(result.current).toMatchObject({ isRead: false, view: "weight", unit: "kg" });
    await act(() => {
      finishRead("composition");
    });
    await waitFor(() => {
      expect(result.current.isRead).toBe(true);
    });
    expect(result.current.view).toBe("composition");
  });

  it("should be Weight in kg and read when nothing is stored", async () => {
    const { result } = await renderHook(() => useWeightChartView());

    await waitFor(() => {
      expect(result.current.isRead).toBe(true);
    });
    expect(result.current).toMatchObject({ view: "weight", unit: "kg" });
  });

  it("should read back a saved Composition view and percentage unit", async () => {
    mockStorageItems.set("weight.chartView", "composition");
    mockStorageItems.set("weight.compositionUnit", "pct");

    const { result } = await renderHook(() => useWeightChartView());

    await waitFor(() => {
      expect(result.current.isRead).toBe(true);
    });
    expect(result.current).toMatchObject({ view: "composition", unit: "pct" });
  });

  it("should read both keys once, on mount", async () => {
    await renderHook(() => useWeightChartView());

    await waitFor(() => {
      expect(mockGetItem).toHaveBeenCalledTimes(2);
    });
    expect(mockGetItem).toHaveBeenCalledWith("weight.chartView");
    expect(mockGetItem).toHaveBeenCalledWith("weight.compositionUnit");
  });

  it("should use the defaults for a saved value it does not know", async () => {
    mockStorageItems.set("weight.chartView", "sideways");
    mockStorageItems.set("weight.compositionUnit", "lb");

    const { result } = await renderHook(() => useWeightChartView());

    await waitFor(() => {
      expect(result.current.isRead).toBe(true);
    });
    expect(result.current).toMatchObject({ view: "weight", unit: "kg" });
  });

  it("should use the defaults, and never throw, when the store cannot be read", async () => {
    mockGetItem.mockRejectedValue(new Error("storage is down"));

    const { result } = await renderHook(() => useWeightChartView());

    await waitFor(() => {
      expect(result.current.isRead).toBe(true);
    });
    expect(result.current).toMatchObject({ view: "weight", unit: "kg" });
  });

  it("should change the view at once and store it", async () => {
    const { result } = await renderHook(() => useWeightChartView());
    await waitFor(() => {
      expect(result.current.isRead).toBe(true);
    });

    await act(() => {
      result.current.setView("composition");
    });

    expect(result.current.view).toBe("composition");
    expect(mockSetItem).toHaveBeenCalledWith("weight.chartView", "composition");
  });

  it("should change the unit at once and store it", async () => {
    const { result } = await renderHook(() => useWeightChartView());
    await waitFor(() => {
      expect(result.current.isRead).toBe(true);
    });

    await act(() => {
      result.current.setUnit("pct");
    });

    expect(result.current.unit).toBe("pct");
    expect(mockSetItem).toHaveBeenCalledWith("weight.compositionUnit", "pct");
  });

  it("should keep the choice, and never throw, when it cannot be stored", async () => {
    mockSetItem.mockRejectedValueOnce(new Error("storage is full"));
    mockSetItem.mockRejectedValueOnce(new Error("storage is full"));
    const { result } = await renderHook(() => useWeightChartView());
    await waitFor(() => {
      expect(result.current.isRead).toBe(true);
    });

    await act(() => {
      result.current.setView("composition");
      result.current.setUnit("pct");
    });

    expect(result.current).toMatchObject({ view: "composition", unit: "pct" });
  });

  it("should not let a read that comes back late overwrite a view chosen before it", async () => {
    let finishRead: (value: string) => void = () => undefined;
    mockGetItem.mockReturnValueOnce(
      new Promise<string>((resolve) => {
        finishRead = resolve;
      }),
    );
    const { result } = await renderHook(() => useWeightChartView());

    await act(() => {
      result.current.setView("composition");
    });
    await act(() => {
      finishRead("weight");
    });

    await waitFor(() => {
      expect(result.current.isRead).toBe(true);
    });
    expect(result.current.view).toBe("composition");
  });

  it("should not let a read that comes back late overwrite a unit chosen before it", async () => {
    let finishRead: (value: string) => void = () => undefined;
    mockGetItem.mockReturnValueOnce(Promise.resolve("composition"));
    mockGetItem.mockReturnValueOnce(
      new Promise<string>((resolve) => {
        finishRead = resolve;
      }),
    );
    const { result } = await renderHook(() => useWeightChartView());

    await act(() => {
      result.current.setUnit("pct");
    });
    await act(() => {
      finishRead("kg");
    });

    await waitFor(() => {
      expect(result.current.isRead).toBe(true);
    });
    expect(result.current).toMatchObject({ view: "composition", unit: "pct" });
  });

  describe("when the store never answers", () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it("should give up after one second and use the defaults, so the card is not held for good", async () => {
      mockGetItem.mockReturnValue(new Promise<string>(() => undefined));
      const { result } = await renderHook(() => useWeightChartView());

      await act(() => {
        jest.advanceTimersByTime(999);
      });
      expect(result.current.isRead).toBe(false);
      await act(() => {
        jest.advanceTimersByTime(1);
      });

      expect(result.current).toMatchObject({ isRead: true, view: "weight", unit: "kg" });
    });

    it("should ignore an answer that comes after it gave up, so the card does not change under the user", async () => {
      let finishRead: (value: string) => void = () => undefined;
      mockGetItem.mockReturnValue(
        new Promise<string>((resolve) => {
          finishRead = resolve;
        }),
      );
      const { result } = await renderHook(() => useWeightChartView());
      await act(() => {
        jest.advanceTimersByTime(1000);
      });

      await act(() => {
        finishRead("composition");
      });

      expect(result.current).toMatchObject({ view: "weight", unit: "kg" });
    });

    it("should take an answer that comes in time, and not give up afterwards", async () => {
      let finishRead: (value: string) => void = () => undefined;
      mockGetItem.mockReturnValue(
        new Promise<string>((resolve) => {
          finishRead = resolve;
        }),
      );
      const { result } = await renderHook(() => useWeightChartView());
      await act(() => {
        jest.advanceTimersByTime(400);
      });

      await act(() => {
        finishRead("composition");
      });
      await act(() => {
        jest.advanceTimersByTime(2000);
      });

      expect(result.current).toMatchObject({ isRead: true, view: "composition" });
    });
  });
});
