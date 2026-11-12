import { act, renderHook, waitFor } from "@testing-library/react-native";

import { suggestionDismissedStorageKey, useSuggestionDismissed } from "../lib/suggestionDismissed";

const stored = new Map<string, string>();
const mockStorage = {
  getItem: jest.fn((key: string) => Promise.resolve(stored.get(key) ?? null)),
  setItem: jest.fn((key: string, value: string) => {
    stored.set(key, value);
    return Promise.resolve();
  }),
};
jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: {
    getItem: (key: string) => mockStorage.getItem(key),
    setItem: (key: string, value: string) => mockStorage.setItem(key, value),
  },
}));

// Not now on the suggestion card: the days whose suggestion the person put off, kept on this device as dates.

describe("the days whose suggestion was put off", () => {
  beforeEach(() => {
    stored.clear();
    mockStorage.getItem.mockClear();
    mockStorage.setItem.mockClear();
  });

  it("should be unknown until the device has been read, then none for a device that has stored none", async () => {
    let finishReading: (text: string | null) => void = () => undefined;
    mockStorage.getItem.mockReturnValueOnce(
      new Promise<string | null>((resolve) => {
        finishReading = resolve;
      }),
    );
    const { result } = await renderHook(() => useSuggestionDismissed());

    expect(result.current.dismissedDays).toBeUndefined();
    await act(() => {
      finishReading(null);
    });
    expect(result.current.dismissedDays).toEqual([]);
  });

  it("should give the days the device stored", async () => {
    stored.set(suggestionDismissedStorageKey, JSON.stringify(["2026-10-15"]));
    const { result } = await renderHook(() => useSuggestionDismissed());

    await waitFor(() => {
      expect(result.current.dismissedDays).toEqual(["2026-10-15"]);
    });
  });

  it("should add the day at once and store it when a day is put off", async () => {
    const { result } = await renderHook(() => useSuggestionDismissed());
    await waitFor(() => {
      expect(result.current.dismissedDays).toEqual([]);
    });

    await act(() => {
      result.current.dismiss("2026-10-15");
    });

    expect(result.current.dismissedDays).toEqual(["2026-10-15"]);
    expect(stored.get(suggestionDismissedStorageKey)).toBe(JSON.stringify(["2026-10-15"]));
  });

  it("should keep a day once when it is put off twice", async () => {
    const { result } = await renderHook(() => useSuggestionDismissed());
    await waitFor(() => {
      expect(result.current.dismissedDays).toEqual([]);
    });

    await act(() => {
      result.current.dismiss("2026-10-15");
      result.current.dismiss("2026-10-15");
    });

    expect(result.current.dismissedDays).toEqual(["2026-10-15"]);
  });

  it("should keep only the newest fourteen days, so the store does not grow for ever", async () => {
    const fifteenDays = Array.from(
      { length: 15 },
      (_, index) => `2026-10-${String(index + 1).padStart(2, "0")}`,
    );
    stored.set(suggestionDismissedStorageKey, JSON.stringify(fifteenDays.slice(0, 14)));
    const { result } = await renderHook(() => useSuggestionDismissed());
    await waitFor(() => {
      expect(result.current.dismissedDays).toHaveLength(14);
    });

    await act(() => {
      result.current.dismiss("2026-10-15");
    });

    expect(result.current.dismissedDays).toEqual(fifteenDays.slice(1));
  });

  it("should treat a store that cannot be read as none put off, so the card is shown", async () => {
    mockStorage.getItem.mockRejectedValueOnce(new Error("unreadable"));
    const { result } = await renderHook(() => useSuggestionDismissed());

    await waitFor(() => {
      expect(result.current.dismissedDays).toEqual([]);
    });
  });

  it("should treat stored data that is not a list of days as none put off", async () => {
    stored.set(suggestionDismissedStorageKey, JSON.stringify({ days: ["2026-10-15"] }));
    const { result } = await renderHook(() => useSuggestionDismissed());

    await waitFor(() => {
      expect(result.current.dismissedDays).toEqual([]);
    });
  });
});
