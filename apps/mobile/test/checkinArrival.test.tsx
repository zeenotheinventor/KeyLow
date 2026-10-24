import { act, renderHook, waitFor } from "@testing-library/react-native";

import { useCheckinArrival } from "../lib/checkinSeen";
import {
  asyncStorageMock,
  resetCheckinSeenStore,
  seeCheckinAsAlreadySeen,
  storedCheckinDate,
} from "./support/checkinSeenStoreMock";

jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: jest.requireActual<{ asyncStorageMock: unknown }>("./support/checkinSeenStoreMock")
    .asyncStorageMock,
}));

// Whether the Programme screen has shown the arrival motion for a check-in, remembered per device as a date.

describe("the arrival of a new check-in", () => {
  beforeEach(() => {
    resetCheckinSeenStore();
  });

  it("should be new when this device has never seen a check-in, and remember its date", async () => {
    const { result } = await renderHook(() => useCheckinArrival("2026-10-09"));

    await waitFor(() => {
      expect(result.current.isNew).toBe(true);
    });
    expect(storedCheckinDate()).toBe("2026-10-09");
  });

  it("should be new for a check-in newer than the one this device saw", async () => {
    seeCheckinAsAlreadySeen("2026-10-02");
    const { result } = await renderHook(() => useCheckinArrival("2026-10-09"));

    await waitFor(() => {
      expect(result.current.isNew).toBe(true);
    });
    expect(storedCheckinDate()).toBe("2026-10-09");
  });

  it("should not be new for the check-in this device already saw, and write nothing", async () => {
    seeCheckinAsAlreadySeen("2026-10-09");
    const { result } = await renderHook(() => useCheckinArrival("2026-10-09"));

    await waitFor(() => {
      expect(result.current.isRead).toBe(true);
    });
    expect(result.current.isNew).toBe(false);
    expect(asyncStorageMock.setItem).not.toHaveBeenCalled();
  });

  it("should be new once only: the next open of the screen finds the check-in seen", async () => {
    const first = await renderHook(() => useCheckinArrival("2026-10-09"));
    await waitFor(() => {
      expect(first.result.current.isNew).toBe(true);
    });
    await first.unmount();

    const second = await renderHook(() => useCheckinArrival("2026-10-09"));

    await waitFor(() => {
      expect(second.result.current.isRead).toBe(true);
    });
    expect(second.result.current.isNew).toBe(false);
  });

  it("should stay new for the rest of the visit, once decided", async () => {
    const { result, rerender } = await renderHook(() => useCheckinArrival("2026-10-09"));
    await waitFor(() => {
      expect(result.current.isNew).toBe(true);
    });

    await rerender({});

    expect(result.current.isNew).toBe(true);
  });

  it("should wait for the check-in's date, and be new when it arrives", async () => {
    let checkinDate: string | null = null;
    const { result, rerender } = await renderHook(() => useCheckinArrival(checkinDate));
    await waitFor(() => {
      expect(result.current.isRead).toBe(true);
    });
    expect(result.current.isNew).toBe(false);

    checkinDate = "2026-10-09";
    await rerender({});

    await waitFor(() => {
      expect(result.current.isNew).toBe(true);
    });
  });

  it("should never be new, and write nothing, when the store cannot be read", async () => {
    asyncStorageMock.getItem.mockRejectedValueOnce(new Error("unreadable"));
    const { result } = await renderHook(() => useCheckinArrival("2026-10-09"));

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    // The answer is that there is none, so a screen waiting for it does not wait for ever.
    expect(result.current.isRead).toBe(true);
    expect(result.current.isNew).toBe(false);
    expect(asyncStorageMock.setItem).not.toHaveBeenCalled();
  });

  it("should store a date and nothing else", async () => {
    const { result } = await renderHook(() => useCheckinArrival("2026-10-09"));
    await waitFor(() => {
      expect(result.current.isNew).toBe(true);
    });

    expect(asyncStorageMock.setItem).toHaveBeenCalledWith("program.checkinSeen", "2026-10-09");
  });
});
