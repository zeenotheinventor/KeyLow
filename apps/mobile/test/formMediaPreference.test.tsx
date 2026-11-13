import { act, renderHook, waitFor } from "@testing-library/react-native";

import { startFormMediaPreferenceRead, useFormMediaPreference } from "../lib/formMediaPreference";
import { resetFormMediaPreferenceForTests } from "../lib/formMediaPreference/testing";

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

describe("useFormMediaPreference", () => {
  beforeEach(() => {
    mockStorageItems.clear();
    mockGetItem.mockClear();
    mockSetItem.mockClear();
    resetFormMediaPreferenceForTests();
  });

  it("should say it is not ready until the read has come back, and be Video meanwhile", async () => {
    const finishRead = pendingRead();

    const { result } = await renderHook(() => useFormMediaPreference());

    expect(result.current).toMatchObject({ isReady: false, preference: "video" });
    await act(() => {
      finishRead("both");
    });
    await waitFor(() => {
      expect(result.current.isReady).toBe(true);
    });
    expect(result.current.preference).toBe("both");
  });

  it("should be Video and ready on a fresh install, when nothing is saved", async () => {
    const { result } = await renderHook(() => useFormMediaPreference());

    await waitFor(() => {
      expect(result.current.isReady).toBe(true);
    });
    expect(result.current.preference).toBe("video");
  });

  it("should be Photos when Photos was saved", async () => {
    mockStorageItems.set("exerciseForm.mediaPreference", "photos");

    const { result } = await renderHook(() => useFormMediaPreference());

    await waitFor(() => {
      expect(result.current.isReady).toBe(true);
    });
    expect(result.current.preference).toBe("photos");
  });

  it("should be Video when the saved value is not a preference", async () => {
    mockStorageItems.set("exerciseForm.mediaPreference", "slideshow");

    const { result } = await renderHook(() => useFormMediaPreference());

    await waitFor(() => {
      expect(result.current.isReady).toBe(true);
    });
    expect(result.current.preference).toBe("video");
  });

  it("should be Video, ready, and never throw, when the store cannot be read", async () => {
    mockGetItem.mockRejectedValueOnce(new Error("storage is down"));

    const { result } = await renderHook(() => useFormMediaPreference());

    await waitFor(() => {
      expect(result.current.isReady).toBe(true);
    });
    expect(result.current.preference).toBe("video");
  });

  it("should change the preference at once and save it", async () => {
    const { result } = await renderHook(() => useFormMediaPreference());
    await waitFor(() => {
      expect(result.current.isReady).toBe(true);
    });

    await act(() => {
      result.current.setPreference("both");
    });

    expect(result.current.preference).toBe("both");
    expect(mockSetItem).toHaveBeenCalledWith("exerciseForm.mediaPreference", "both");
  });

  it("should keep the preference for this visit, and raise nothing, when it cannot be saved", async () => {
    mockSetItem.mockRejectedValueOnce(new Error("storage is full"));
    const { result } = await renderHook(() => useFormMediaPreference());
    await waitFor(() => {
      expect(result.current.isReady).toBe(true);
    });

    await act(() => {
      result.current.setPreference("photos");
    });

    expect(result.current.preference).toBe("photos");
  });

  it("should reach every reader with one change, and read the store once", async () => {
    const settingRow = await renderHook(() => useFormMediaPreference());
    const sheet = await renderHook(() => useFormMediaPreference());
    await waitFor(() => {
      expect(sheet.result.current.isReady).toBe(true);
    });

    await act(() => {
      settingRow.result.current.setPreference("photos");
    });

    expect(sheet.result.current.preference).toBe("photos");
    expect(mockGetItem).toHaveBeenCalledTimes(1);
  });

  it("should have read the store already when a reader asks, if the app started the read", async () => {
    mockStorageItems.set("exerciseForm.mediaPreference", "both");
    startFormMediaPreferenceRead();
    await act(async () => {
      await Promise.resolve();
    });

    const { result } = await renderHook(() => useFormMediaPreference());

    expect(result.current).toMatchObject({ isReady: true, preference: "both" });
    expect(mockGetItem).toHaveBeenCalledTimes(1);
  });

  it("should keep a choice made before the read came back", async () => {
    const finishRead = pendingRead();
    const { result } = await renderHook(() => useFormMediaPreference());
    await act(() => {
      result.current.setPreference("photos");
    });

    await act(() => {
      finishRead("video");
    });
    await waitFor(() => {
      expect(result.current.isReady).toBe(true);
    });

    expect(result.current.preference).toBe("photos");
  });

  describe("when the store never answers", () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it("should give up after three seconds and be Video and ready, so a sheet is not held for good", async () => {
      mockGetItem.mockReturnValueOnce(new Promise<string | null>(() => undefined));
      const { result } = await renderHook(() => useFormMediaPreference());

      await act(() => {
        jest.advanceTimersByTime(2999);
      });
      expect(result.current.isReady).toBe(false);
      await act(() => {
        jest.advanceTimersByTime(1);
      });

      expect(result.current).toMatchObject({ isReady: true, preference: "video" });
    });

    it("should apply a late answer", async () => {
      const finishRead = pendingRead();
      const { result } = await renderHook(() => useFormMediaPreference());
      await act(() => {
        jest.advanceTimersByTime(3000);
      });

      await act(() => {
        finishRead("photos");
      });

      expect(result.current).toMatchObject({ preference: "photos", isReady: true });
    });

    it("should apply a late answer, but not over a choice made since", async () => {
      const finishRead = pendingRead();
      const { result } = await renderHook(() => useFormMediaPreference());
      await act(() => {
        jest.advanceTimersByTime(3000);
      });
      await act(() => {
        result.current.setPreference("video");
      });

      await act(() => {
        finishRead("photos");
      });

      expect(result.current.preference).toBe("video");
    });
  });
});
