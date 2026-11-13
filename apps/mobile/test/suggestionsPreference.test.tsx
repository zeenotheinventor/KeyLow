import { act, renderHook, waitFor } from "@testing-library/react-native";

import {
  suggestionsPreferenceStorageKey,
  useSuggestionsEnabled,
} from "../lib/suggestionsPreference";

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

// The Workout suggestions switch of More: whether the Train tab suggests a workout, kept on this device.

describe("whether workouts are suggested", () => {
  beforeEach(() => {
    stored.clear();
    mockStorage.getItem.mockClear();
    mockStorage.setItem.mockClear();
  });

  it("should be unknown until the device has been read, then on for a device that has stored nothing", async () => {
    let finishReading: (text: string | null) => void = () => undefined;
    mockStorage.getItem.mockReturnValueOnce(
      new Promise<string | null>((resolve) => {
        finishReading = resolve;
      }),
    );
    const { result } = await renderHook(() => useSuggestionsEnabled());

    expect(result.current.isEnabled).toBeUndefined();
    await act(() => {
      finishReading(null);
    });
    expect(result.current.isEnabled).toBe(true);
  });

  it("should be off when the device stored off", async () => {
    stored.set(suggestionsPreferenceStorageKey, "false");
    const { result } = await renderHook(() => useSuggestionsEnabled());

    await waitFor(() => {
      expect(result.current.isEnabled).toBe(false);
    });
  });

  it("should be on when the device holds anything that is not a yes or no", async () => {
    stored.set(suggestionsPreferenceStorageKey, '"off"');
    const { result } = await renderHook(() => useSuggestionsEnabled());

    await waitFor(() => {
      expect(result.current.isEnabled).toBe(true);
    });
  });

  it("should be on when the device cannot be read", async () => {
    mockStorage.getItem.mockRejectedValueOnce(new Error("unreadable"));
    const { result } = await renderHook(() => useSuggestionsEnabled());

    await waitFor(() => {
      expect(result.current.isEnabled).toBe(true);
    });
  });

  it("should change at once and be stored when it is turned off", async () => {
    const { result } = await renderHook(() => useSuggestionsEnabled());
    await waitFor(() => {
      expect(result.current.isEnabled).toBe(true);
    });

    await act(() => {
      result.current.setEnabled(false);
    });

    expect(result.current.isEnabled).toBe(false);
    expect(stored.get(suggestionsPreferenceStorageKey)).toBe("false");
  });

  it("should still apply for this visit when the choice cannot be stored", async () => {
    mockStorage.setItem.mockRejectedValueOnce(new Error("full"));
    const { result } = await renderHook(() => useSuggestionsEnabled());
    await waitFor(() => {
      expect(result.current.isEnabled).toBe(true);
    });

    await act(() => {
      result.current.setEnabled(false);
    });

    expect(result.current.isEnabled).toBe(false);
  });

  it("should keep a choice made while the device was being read", async () => {
    let finishReading: (text: string | null) => void = () => undefined;
    mockStorage.getItem.mockReturnValueOnce(
      new Promise<string | null>((resolve) => {
        finishReading = resolve;
      }),
    );
    const { result } = await renderHook(() => useSuggestionsEnabled());

    await act(() => {
      result.current.setEnabled(false);
    });
    await act(() => {
      finishReading(null);
    });

    expect(result.current.isEnabled).toBe(false);
  });

  it("should reach every reader, so a mounted Train tab follows the switch in More", async () => {
    const more = await renderHook(() => useSuggestionsEnabled());
    const train = await renderHook(() => useSuggestionsEnabled());
    await waitFor(() => {
      expect(train.result.current.isEnabled).toBe(true);
    });

    await act(() => {
      more.result.current.setEnabled(false);
    });

    expect(train.result.current.isEnabled).toBe(false);
  });
});
