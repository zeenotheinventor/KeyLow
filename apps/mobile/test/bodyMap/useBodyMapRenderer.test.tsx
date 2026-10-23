import { act, renderHook, waitFor } from "@testing-library/react-native";

import { startBodyMapRendererRead, useBodyMapRenderer } from "../../lib/bodyMapRenderer";
import { resetBodyMapRendererForTests } from "../../lib/bodyMapRenderer/testing";

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

describe("useBodyMapRenderer", () => {
  beforeEach(() => {
    mockStorageItems.clear();
    mockGetItem.mockClear();
    mockSetItem.mockClear();
    resetBodyMapRendererForTests();
  });

  it("should say it is not ready until the read has come back, and be 2D meanwhile", async () => {
    const finishRead = pendingRead();

    const { result } = await renderHook(() => useBodyMapRenderer());

    expect(result.current).toMatchObject({ isReady: false, renderer: "2d" });
    await act(() => {
      finishRead("3d");
    });
    await waitFor(() => {
      expect(result.current.isReady).toBe(true);
    });
    expect(result.current.renderer).toBe("3d");
  });

  it("should be 2D and ready on a fresh install, when nothing is saved", async () => {
    const { result } = await renderHook(() => useBodyMapRenderer());

    await waitFor(() => {
      expect(result.current.isReady).toBe(true);
    });
    expect(result.current.renderer).toBe("2d");
  });

  it("should be 3D when 3D was saved", async () => {
    mockStorageItems.set("bodyMap.renderer", "3d");

    const { result } = await renderHook(() => useBodyMapRenderer());

    await waitFor(() => {
      expect(result.current.isReady).toBe(true);
    });
    expect(result.current.renderer).toBe("3d");
  });

  it("should be 2D when the saved value is not a renderer", async () => {
    mockStorageItems.set("bodyMap.renderer", "4d");

    const { result } = await renderHook(() => useBodyMapRenderer());

    await waitFor(() => {
      expect(result.current.isReady).toBe(true);
    });
    expect(result.current.renderer).toBe("2d");
  });

  it("should be 2D, ready, and never throw, when the store cannot be read", async () => {
    mockGetItem.mockRejectedValueOnce(new Error("storage is down"));

    const { result } = await renderHook(() => useBodyMapRenderer());

    await waitFor(() => {
      expect(result.current.isReady).toBe(true);
    });
    expect(result.current.renderer).toBe("2d");
  });

  it("should change the renderer at once and save it", async () => {
    const { result } = await renderHook(() => useBodyMapRenderer());
    await waitFor(() => {
      expect(result.current.isReady).toBe(true);
    });

    await act(() => {
      result.current.setRenderer("3d");
    });

    expect(result.current.renderer).toBe("3d");
    expect(mockSetItem).toHaveBeenCalledWith("bodyMap.renderer", "3d");
  });

  it("should keep the renderer for this visit, and raise nothing, when it cannot be saved", async () => {
    mockSetItem.mockRejectedValueOnce(new Error("storage is full"));
    const { result } = await renderHook(() => useBodyMapRenderer());
    await waitFor(() => {
      expect(result.current.isReady).toBe(true);
    });

    await act(() => {
      result.current.setRenderer("3d");
    });

    expect(result.current.renderer).toBe("3d");
  });

  it("should share the renderer between every reader, and read the store once", async () => {
    mockStorageItems.set("bodyMap.renderer", "2d");
    const settingRow = await renderHook(() => useBodyMapRenderer());
    const bodyMap = await renderHook(() => useBodyMapRenderer());
    await waitFor(() => {
      expect(bodyMap.result.current.isReady).toBe(true);
    });

    await act(() => {
      settingRow.result.current.setRenderer("3d");
    });

    expect(bodyMap.result.current.renderer).toBe("3d");
    expect(mockGetItem).toHaveBeenCalledTimes(1);
  });

  it("should have read the store already when a reader asks, if the app started the read", async () => {
    mockStorageItems.set("bodyMap.renderer", "3d");
    startBodyMapRendererRead();
    await act(async () => {
      await Promise.resolve();
    });

    const { result } = await renderHook(() => useBodyMapRenderer());

    expect(result.current).toMatchObject({ isReady: true, renderer: "3d" });
    expect(mockGetItem).toHaveBeenCalledTimes(1);
  });

  it("should keep a choice made before the read came back", async () => {
    const finishRead = pendingRead();
    const { result } = await renderHook(() => useBodyMapRenderer());
    await act(() => {
      result.current.setRenderer("3d");
    });

    await act(() => {
      finishRead("2d");
    });
    await waitFor(() => {
      expect(result.current.isReady).toBe(true);
    });

    expect(result.current.renderer).toBe("3d");
  });

  describe("when the store never answers", () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it("should give up after three seconds and be 2D and ready, so the map is not held for good", async () => {
      mockGetItem.mockReturnValueOnce(new Promise<string | null>(() => undefined));
      const { result } = await renderHook(() => useBodyMapRenderer());

      await act(() => {
        jest.advanceTimersByTime(2999);
      });
      expect(result.current.isReady).toBe(false);
      await act(() => {
        jest.advanceTimersByTime(1);
      });

      expect(result.current).toMatchObject({ isReady: true, renderer: "2d" });
    });

    it("should apply a late answer", async () => {
      const finishRead = pendingRead();
      const { result } = await renderHook(() => useBodyMapRenderer());
      await act(() => {
        jest.advanceTimersByTime(3000);
      });
      expect(result.current.renderer).toBe("2d");

      await act(() => {
        finishRead("3d");
      });

      expect(result.current).toMatchObject({ renderer: "3d", isReady: true });
    });

    it("should apply a late answer, but not over a choice made since", async () => {
      const finishRead = pendingRead();
      const { result } = await renderHook(() => useBodyMapRenderer());
      await act(() => {
        jest.advanceTimersByTime(3000);
      });
      await act(() => {
        result.current.setRenderer("2d");
      });

      await act(() => {
        finishRead("3d");
      });

      expect(result.current.renderer).toBe("2d");
    });
  });
});
