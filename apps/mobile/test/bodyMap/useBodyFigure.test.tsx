import { act, renderHook, waitFor } from "@testing-library/react-native";

import { startBodyFigureRead, useBodyFigure } from "../../lib/bodyFigure";
import { resetBodyFigureForTests } from "../../lib/bodyFigure/testing";

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

describe("useBodyFigure", () => {
  beforeEach(() => {
    mockStorageItems.clear();
    mockGetItem.mockClear();
    mockSetItem.mockClear();
    resetBodyFigureForTests();
  });

  it("should say it is not ready until the read has come back, and be Male meanwhile", async () => {
    const finishRead = pendingRead();

    const { result } = await renderHook(() => useBodyFigure());

    expect(result.current).toMatchObject({ isReady: false, figure: "male", hasChosen: false });
    await act(() => {
      finishRead("female");
    });
    await waitFor(() => {
      expect(result.current.isReady).toBe(true);
    });
    expect(result.current).toMatchObject({ figure: "female", hasChosen: true });
  });

  it("should be Male, ready and not yet chosen when nothing is stored", async () => {
    const { result } = await renderHook(() => useBodyFigure());

    await waitFor(() => {
      expect(result.current.isReady).toBe(true);
    });
    expect(result.current).toMatchObject({ figure: "male", hasChosen: false });
  });

  it("should be Male, ready and chosen, and never throw, when the store cannot be read", async () => {
    mockGetItem.mockRejectedValueOnce(new Error("storage is down"));

    const { result } = await renderHook(() => useBodyFigure());

    await waitFor(() => {
      expect(result.current.isReady).toBe(true);
    });
    expect(result.current).toMatchObject({ figure: "male", hasChosen: true });
  });

  it("should change the figure at once, count it as chosen and store it", async () => {
    const { result } = await renderHook(() => useBodyFigure());
    await waitFor(() => {
      expect(result.current.isReady).toBe(true);
    });

    await act(() => {
      result.current.setFigure("female");
    });

    expect(result.current).toMatchObject({ figure: "female", hasChosen: true });
    expect(mockSetItem).toHaveBeenCalledWith("bodyMap.figure", "female");
  });

  it("should keep the figure for this visit when it cannot be stored", async () => {
    mockSetItem.mockRejectedValueOnce(new Error("storage is full"));
    const { result } = await renderHook(() => useBodyFigure());
    await waitFor(() => {
      expect(result.current.isReady).toBe(true);
    });

    await act(() => {
      result.current.setFigure("female");
    });

    expect(result.current.figure).toBe("female");
  });

  it("should share the figure between every screen that reads it, and read the store once", async () => {
    mockStorageItems.set("bodyMap.figure", "male");
    const first = await renderHook(() => useBodyFigure());
    const second = await renderHook(() => useBodyFigure());
    await waitFor(() => {
      expect(second.result.current.isReady).toBe(true);
    });

    await act(() => {
      first.result.current.setFigure("female");
    });

    expect(second.result.current.figure).toBe("female");
    expect(mockGetItem).toHaveBeenCalledTimes(1);
  });

  it("should have read the store already when a screen asks, if the app started the read", async () => {
    mockStorageItems.set("bodyMap.figure", "female");
    startBodyFigureRead();
    await act(async () => {
      await Promise.resolve();
    });

    const { result } = await renderHook(() => useBodyFigure());

    expect(result.current).toMatchObject({ isReady: true, figure: "female" });
    expect(mockGetItem).toHaveBeenCalledTimes(1);
  });

  it("should keep a choice made before the read came back", async () => {
    const finishRead = pendingRead();
    const { result } = await renderHook(() => useBodyFigure());
    await act(() => {
      result.current.setFigure("female");
    });

    await act(() => {
      finishRead("male");
    });
    await waitFor(() => {
      expect(result.current.isReady).toBe(true);
    });

    expect(result.current).toMatchObject({ figure: "female", hasChosen: true });
  });

  describe("when the store never answers", () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it("should give up after three seconds and be Male, ready and chosen, so the screen is not held for good", async () => {
      mockGetItem.mockReturnValueOnce(new Promise<string | null>(() => undefined));
      const { result } = await renderHook(() => useBodyFigure());

      await act(() => {
        jest.advanceTimersByTime(2999);
      });
      expect(result.current.isReady).toBe(false);
      await act(() => {
        jest.advanceTimersByTime(1);
      });

      expect(result.current).toMatchObject({ isReady: true, figure: "male", hasChosen: true });
    });

    it("should apply a late answer, without asking for it", async () => {
      const finishRead = pendingRead();
      const { result } = await renderHook(() => useBodyFigure());
      await act(() => {
        jest.advanceTimersByTime(3000);
      });
      expect(result.current).toMatchObject({ figure: "male", hasChosen: true });

      await act(() => {
        finishRead("female");
      });

      // Stored Female shows, though the read was slow, and nobody is asked late.
      expect(result.current).toMatchObject({ figure: "female", hasChosen: true, isReady: true });
    });

    it("should apply a late answer, but not over a choice made since", async () => {
      const finishRead = pendingRead();
      const { result } = await renderHook(() => useBodyFigure());
      await act(() => {
        jest.advanceTimersByTime(3000);
      });
      await act(() => {
        result.current.setFigure("male");
      });

      await act(() => {
        finishRead("female");
      });

      expect(result.current.figure).toBe("male");
    });
  });
});
