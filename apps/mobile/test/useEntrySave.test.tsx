import { KeyLowProvider } from "@keylow/api-client";
import { act, renderHook, waitFor } from "@testing-library/react-native";

import { createDiaryQueryClient, diaryBackend } from "./support/diaryBackend";
import { chickenEntry } from "./support/entries";
import { entryClient, resetEntryBackend } from "./support/entryBackend";
import { useEntrySave } from "../components/EntryScreen/useEntrySave";

import type { EntryUpdate } from "@keylow/api-client";
import type { ReactNode } from "react";

// The write that Save and "Update to current food data" share, against the fake database.

const wrapper = ({ children }: { children: ReactNode }) => (
  <KeyLowProvider client={entryClient} queryClient={createDiaryQueryClient()}>
    {children}
  </KeyLowProvider>
);

const timeUpdate = (hour = "09:00"): EntryUpdate => ({
  entry: chickenEntry(),
  time: { loggedAt: `2026-10-15T${hour}:00.000Z`, timeZone: "Europe/London" },
});

describe("useEntrySave", () => {
  beforeEach(() => {
    resetEntryBackend();
    diaryBackend.entries = [{ ...chickenEntry() }];
  });

  it("should write once and leave once when Save is pressed twice in the same tick", async () => {
    const onLeave = jest.fn();
    const { result } = await renderHook(() => useEntrySave(onLeave), { wrapper });

    await act(async () => {
      await Promise.all([result.current.save(timeUpdate()), result.current.save(timeUpdate())]);
    });

    expect(diaryBackend.writes).toHaveLength(1);
    expect(onLeave).toHaveBeenCalledTimes(1);
  });

  it("should ignore a Save pressed while the first write is under way", async () => {
    diaryBackend.holdUpdates = true;
    const onLeave = jest.fn();
    const { result } = await renderHook(() => useEntrySave(onLeave), { wrapper });

    await act(() => {
      void result.current.save(timeUpdate());
    });
    await waitFor(() => {
      expect(diaryBackend.heldUpdates).toHaveLength(1);
    });
    await act(async () => {
      await result.current.save(timeUpdate());
    });
    await act(() => {
      diaryBackend.heldUpdates[0]?.();
    });

    await waitFor(() => {
      expect(onLeave).toHaveBeenCalledTimes(1);
    });
    expect(diaryBackend.writes).toHaveLength(1);
  });

  it("should write once when Save and Update to current food data are pressed in the same tick", async () => {
    const onLeave = jest.fn();
    const { result } = await renderHook(() => useEntrySave(onLeave), { wrapper });

    await act(async () => {
      await Promise.all([result.current.save(timeUpdate()), result.current.update(timeUpdate())]);
    });

    expect(diaryBackend.writes).toHaveLength(1);
  });

  it("should not write or leave again when Save is pressed once more while the screen is closing", async () => {
    const onLeave = jest.fn();
    const { result } = await renderHook(() => useEntrySave(onLeave), { wrapper });
    await act(async () => {
      await result.current.save(timeUpdate());
    });

    await act(async () => {
      await result.current.save(timeUpdate());
    });

    expect(diaryBackend.writes).toHaveLength(1);
    expect(onLeave).toHaveBeenCalledTimes(1);
  });

  it("should leave once when Save is pressed twice with nothing changed", async () => {
    const onLeave = jest.fn();
    const { result } = await renderHook(() => useEntrySave(onLeave), { wrapper });

    await act(async () => {
      await Promise.all([result.current.save(null), result.current.save(null)]);
    });

    expect(onLeave).toHaveBeenCalledTimes(1);
  });

  it("should let a Save through after an Update to current food data that succeeded", async () => {
    const onLeave = jest.fn();
    const { result } = await renderHook(() => useEntrySave(onLeave), { wrapper });
    await act(async () => {
      await result.current.update(timeUpdate());
    });

    await act(async () => {
      await result.current.save(timeUpdate("10:00"));
    });

    expect(diaryBackend.writes).toHaveLength(2);
    expect(onLeave).toHaveBeenCalledTimes(1);
  });

  it("should not leave when the screen has gone before the write finishes", async () => {
    diaryBackend.holdUpdates = true;
    const onLeave = jest.fn();
    const { result, unmount } = await renderHook(() => useEntrySave(onLeave), { wrapper });
    await act(() => {
      void result.current.save(timeUpdate());
    });
    await waitFor(() => {
      expect(diaryBackend.heldUpdates).toHaveLength(1);
    });

    await unmount();
    await act(() => {
      diaryBackend.heldUpdates[0]?.();
    });

    await waitFor(() => {
      expect(diaryBackend.writes).toHaveLength(1);
    });
    expect(onLeave).not.toHaveBeenCalled();
  });

  it("should stay saving through the closing of the screen after a write that left", async () => {
    const { result } = await renderHook(() => useEntrySave(jest.fn()), { wrapper });

    await act(async () => {
      await result.current.save(timeUpdate());
    });

    expect(result.current.isSaving).toBe(true);
  });

  it("should write again after a write that failed", async () => {
    diaryBackend.failingUpdates = 1;
    const onLeave = jest.fn();
    const { result } = await renderHook(() => useEntrySave(onLeave), { wrapper });

    await act(async () => {
      await result.current.save(timeUpdate());
    });
    expect(result.current.hasSaveError).toBe(true);
    expect(onLeave).not.toHaveBeenCalled();

    await act(async () => {
      await result.current.save(timeUpdate());
    });

    expect(result.current.hasSaveError).toBe(false);
    expect(onLeave).toHaveBeenCalledTimes(1);
  });
});
