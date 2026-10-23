import { act, renderHook, waitFor } from "@testing-library/react-native";

import { useBodyMapView } from "../../lib/bodyMapView";

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

describe("useBodyMapView", () => {
  beforeEach(() => {
    mockStorageItems.clear();
    mockGetItem.mockClear();
    mockSetItem.mockClear();
  });

  it("should say it has not read the store until the read has come back", async () => {
    let finishRead: (value: string) => void = () => undefined;
    mockGetItem.mockReturnValueOnce(
      new Promise<string>((resolve) => {
        finishRead = resolve;
      }),
    );

    const { result } = await renderHook(() => useBodyMapView());

    expect(result.current).toMatchObject({ isRead: false, view: "actual" });
    await act(() => {
      finishRead("projected");
    });
    await waitFor(() => {
      expect(result.current.isRead).toBe(true);
    });
    expect(result.current.view).toBe("projected");
  });

  it("should be Actual and read when nothing is stored", async () => {
    const { result } = await renderHook(() => useBodyMapView());

    await waitFor(() => {
      expect(result.current.isRead).toBe(true);
    });
    expect(result.current.view).toBe("actual");
  });

  it("should be Actual and read, and never throw, when the store cannot be read", async () => {
    mockGetItem.mockRejectedValueOnce(new Error("storage is down"));

    const { result } = await renderHook(() => useBodyMapView());

    await waitFor(() => {
      expect(result.current.isRead).toBe(true);
    });
    expect(result.current.view).toBe("actual");
  });

  it("should change the view at once and store it", async () => {
    const { result } = await renderHook(() => useBodyMapView());
    await waitFor(() => {
      expect(result.current.isRead).toBe(true);
    });

    await act(() => {
      result.current.setView("projected");
    });

    expect(result.current.view).toBe("projected");
    expect(mockSetItem).toHaveBeenCalledWith("bodyMap.view", "projected");
  });

  it("should change the view of every screen that holds it, so the list and the map agree", async () => {
    const map = await renderHook(() => useBodyMapView());
    const list = await renderHook(() => useBodyMapView());
    await waitFor(() => {
      expect(map.result.current.isRead && list.result.current.isRead).toBe(true);
    });

    await act(() => {
      list.result.current.setView("projected");
    });

    expect(map.result.current.view).toBe("projected");
    expect(list.result.current.view).toBe("projected");
  });

  describe("when the store never answers", () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it("should give up after one second and be Actual and read, so the screen is not held for good", async () => {
      mockGetItem.mockReturnValueOnce(new Promise<string>(() => undefined));
      const { result } = await renderHook(() => useBodyMapView());

      await act(() => {
        jest.advanceTimersByTime(999);
      });
      expect(result.current.isRead).toBe(false);
      await act(() => {
        jest.advanceTimersByTime(1);
      });

      expect(result.current).toMatchObject({ isRead: true, view: "actual" });
    });

    it("should ignore an answer that comes after it gave up, so the view does not change under the user", async () => {
      let finishRead: (value: string) => void = () => undefined;
      mockGetItem.mockReturnValueOnce(
        new Promise<string>((resolve) => {
          finishRead = resolve;
        }),
      );
      const { result } = await renderHook(() => useBodyMapView());
      await act(() => {
        jest.advanceTimersByTime(1000);
      });

      await act(() => {
        finishRead("projected");
      });

      expect(result.current.view).toBe("actual");
    });

    it("should take an answer that comes in time, and not give up afterwards", async () => {
      let finishRead: (value: string) => void = () => undefined;
      mockGetItem.mockReturnValueOnce(
        new Promise<string>((resolve) => {
          finishRead = resolve;
        }),
      );
      const { result } = await renderHook(() => useBodyMapView());
      await act(() => {
        jest.advanceTimersByTime(400);
      });

      await act(() => {
        finishRead("projected");
      });
      await act(() => {
        jest.advanceTimersByTime(2000);
      });

      expect(result.current).toMatchObject({ isRead: true, view: "projected" });
    });
  });
});
