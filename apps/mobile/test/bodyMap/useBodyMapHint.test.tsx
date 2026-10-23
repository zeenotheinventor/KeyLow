import { act, renderHook, waitFor } from "@testing-library/react-native";

import { useBodyMapHint } from "../../lib/bodyMapHint";

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

describe("useBodyMapHint", () => {
  beforeEach(() => {
    mockStorageItems.clear();
    mockGetItem.mockClear();
    mockSetItem.mockClear();
  });

  it("should say it has not read the store, and that nothing is seen, until the read has come back", async () => {
    let finishRead: (value: string | null) => void = () => undefined;
    mockGetItem.mockReturnValueOnce(
      new Promise<string | null>((resolve) => {
        finishRead = resolve;
      }),
    );

    const { result } = await renderHook(() => useBodyMapHint());

    expect(result.current).toMatchObject({ isRead: false, hasSeen: false });
    await act(() => {
      finishRead("true");
    });
    await waitFor(() => {
      expect(result.current.isRead).toBe(true);
    });
    expect(result.current.hasSeen).toBe(true);
  });

  it("should be read and not seen on a first open", async () => {
    const { result } = await renderHook(() => useBodyMapHint());

    await waitFor(() => {
      expect(result.current.isRead).toBe(true);
    });
    expect(result.current.hasSeen).toBe(false);
  });

  it("should be read and seen, and never throw, when the store cannot be read", async () => {
    mockGetItem.mockRejectedValueOnce(new Error("storage is down"));

    const { result } = await renderHook(() => useBodyMapHint());

    await waitFor(() => {
      expect(result.current.isRead).toBe(true);
    });
    expect(result.current.hasSeen).toBe(true);
  });

  it("should mark the hint seen at once and store it", async () => {
    const { result } = await renderHook(() => useBodyMapHint());
    await waitFor(() => {
      expect(result.current.isRead).toBe(true);
    });

    await act(() => {
      result.current.markSeen();
    });

    expect(result.current.hasSeen).toBe(true);
    expect(mockSetItem).toHaveBeenCalledWith("bodyMap.hintSeen", "true");
  });

  it("should stay seen for this visit when the store cannot be written", async () => {
    mockSetItem.mockRejectedValueOnce(new Error("storage is full"));
    const { result } = await renderHook(() => useBodyMapHint());
    await waitFor(() => {
      expect(result.current.isRead).toBe(true);
    });

    await act(() => {
      result.current.markSeen();
    });

    expect(result.current.hasSeen).toBe(true);
  });

  it("should not let a read that comes back after Got it show the hint again", async () => {
    let finishRead: (value: string | null) => void = () => undefined;
    mockGetItem.mockReturnValueOnce(
      new Promise<string | null>((resolve) => {
        finishRead = resolve;
      }),
    );
    const { result } = await renderHook(() => useBodyMapHint());

    await act(() => {
      result.current.markSeen();
    });
    await act(() => {
      finishRead(null);
    });

    expect(result.current.hasSeen).toBe(true);
  });
});
