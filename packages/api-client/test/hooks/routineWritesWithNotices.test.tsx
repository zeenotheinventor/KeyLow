import {
  ARCHIVE_ACTIVE_REFUSAL,
  ROUTINE_ARCHIVE_FAILED,
  ROUTINE_ARCHIVED_TOAST,
  ROUTINE_MAKE_ACTIVE_FAILED,
  ROUTINE_RESTORE_FAILED,
  describeMakeActiveDialog,
} from "@keylow/core/copy";
import { onlineManager } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { useArchiveRoutineWithUndo } from "../../src/hooks/useArchiveRoutineWithUndo";
import { useMakeRoutineActive } from "../../src/hooks/useMakeRoutineActive";
import { useRestoreRoutine } from "../../src/hooks/useRestoreRoutine";
import {
  RECOGNISABLE_ROUTINE_NAME,
  ROUTINE_ID,
  installRoutinesFake,
  routineDetailRow,
  routineFlagsRow,
} from "../support/routines";
import { createWrapper } from "../support/wrapper";

import type { RoutineNotices } from "../../src/hooks/routineNotices";

const server = setupServer();

beforeAll(() => {
  server.listen({ onUnhandledFrame: "error" });
});
afterEach(() => {
  server.resetHandlers();
  onlineManager.setOnline(true);
});
afterAll(() => {
  server.close();
});

function shownToast(showArchived: ReturnType<typeof vi.fn<RoutineNotices["showArchived"]>>) {
  const toast = showArchived.mock.calls[0]?.[0];
  if (toast === undefined) {
    throw new Error("No archived toast was shown");
  }
  return toast;
}

const question = describeMakeActiveDialog({
  routineName: "Upper Lower",
  previousActiveName: null,
  localDate: "2026-10-15",
});

describe("useMakeRoutineActive", () => {
  it("should make the routine active only when the question is confirmed, and close it", async () => {
    const fake = installRoutinesFake(server, { routines: [routineDetailRow()] });
    const { wrapper } = createWrapper();
    const showFailure = vi.fn();
    const { result } = renderHook(() => useMakeRoutineActive({ showFailure }), { wrapper });

    act(() => {
      result.current.ask({ id: ROUTINE_ID }, question);
    });
    expect(fake.activations).toEqual([]);
    expect(result.current.isOpen).toBe(true);

    await act(() => result.current.confirm());

    expect(fake.activations).toEqual([{ p_routine_id: ROUTINE_ID }]);
    expect(result.current.isOpen).toBe(false);
    expect(showFailure).not.toHaveBeenCalled();
  });

  it("should send one write however many confirms arrive in the same moment", async () => {
    const fake = installRoutinesFake(server, { routines: [routineDetailRow()] });
    const release = fake.holdWrites();
    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useMakeRoutineActive({ showFailure: vi.fn() }), {
      wrapper,
    });
    act(() => {
      result.current.ask({ id: ROUTINE_ID }, question);
    });

    await act(async () => {
      const first = result.current.confirm();
      const second = result.current.confirm();
      await new Promise((resolve) => setTimeout(resolve, 50));
      release();
      await Promise.all([first, second]);
    });

    expect(fake.activations).toHaveLength(1);
  });

  it("should not close the question on Cancel once the answer is on its way", async () => {
    const fake = installRoutinesFake(server, { routines: [routineDetailRow()] });
    const release = fake.holdWrites();
    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useMakeRoutineActive({ showFailure: vi.fn() }), {
      wrapper,
    });
    act(() => {
      result.current.ask({ id: ROUTINE_ID }, question);
    });

    await act(async () => {
      const answer = result.current.confirm();
      await new Promise((resolve) => setTimeout(resolve, 50));
      result.current.cancel();
      expect(result.current.isOpen).toBe(true);
      release();
      await answer;
    });

    expect(result.current.isOpen).toBe(false);
  });

  it("should send nothing offline, close the question and say once that it did not go through", async () => {
    const fake = installRoutinesFake(server, { routines: [routineDetailRow()] });
    onlineManager.setOnline(false);
    const { wrapper } = createWrapper();
    const showFailure = vi.fn();
    const { result } = renderHook(() => useMakeRoutineActive({ showFailure }), { wrapper });
    act(() => {
      result.current.ask({ id: ROUTINE_ID }, question);
    });

    await act(() => result.current.confirm());

    expect(fake.requestCount).toBe(0);
    expect(showFailure.mock.calls).toEqual([[ROUTINE_MAKE_ACTIVE_FAILED]]);
    expect(result.current.isOpen).toBe(false);
  });

  it("should say it did not go through, without the error, when the write fails", async () => {
    const fake = installRoutinesFake(server);
    fake.failWith("XX000");
    const { wrapper } = createWrapper();
    const showFailure = vi.fn();
    const { result } = renderHook(() => useMakeRoutineActive({ showFailure }), { wrapper });
    act(() => {
      result.current.ask({ id: ROUTINE_ID }, question);
    });

    await act(() => result.current.confirm());

    expect(showFailure.mock.calls).toEqual([[ROUTINE_MAKE_ACTIVE_FAILED]]);
    expect(JSON.stringify(showFailure.mock.calls)).not.toContain(RECOGNISABLE_ROUTINE_NAME);
  });
});

describe("a confirm pressed twice in one tick", () => {
  it("should tell a failure once, because the second call is ignored and not joined to the first", async () => {
    const fake = installRoutinesFake(server);
    fake.failWith("XX000");
    const { wrapper } = createWrapper();
    const showFailure = vi.fn();
    const { result } = renderHook(() => useMakeRoutineActive({ showFailure }), { wrapper });
    act(() => {
      result.current.ask({ id: ROUTINE_ID }, question);
    });

    const outcomes = await act(() =>
      Promise.all([result.current.confirm(), result.current.confirm()]),
    );

    expect(outcomes).toEqual([false, false]);
    expect(showFailure.mock.calls).toEqual([[ROUTINE_MAKE_ACTIVE_FAILED]]);
  });

  it("should resolve to whether the routine was made active", async () => {
    installRoutinesFake(server, { routines: [routineDetailRow()] });
    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useMakeRoutineActive({ showFailure: vi.fn() }), {
      wrapper,
    });
    act(() => {
      result.current.ask({ id: ROUTINE_ID }, question);
    });

    expect(await act(() => result.current.confirm())).toBe(true);
  });
});

describe("useRestoreRoutine", () => {
  it("should restore the routine and resolve true", async () => {
    const fake = installRoutinesFake(server, { archived: routineFlagsRow() });
    const { wrapper } = createWrapper();
    const showFailure = vi.fn();
    const { result } = renderHook(() => useRestoreRoutine({ showFailure }), { wrapper });

    const isRestored = await act(() => result.current(ROUTINE_ID));

    expect(isRestored).toBe(true);
    expect(fake.archives.map(({ body }) => body)).toEqual([{ is_archived: false }]);
    expect(showFailure).not.toHaveBeenCalled();
  });

  it("should tell a failure once and resolve false when pressed twice in one tick", async () => {
    const fake = installRoutinesFake(server);
    fake.failWith("XX000");
    const { wrapper } = createWrapper();
    const showFailure = vi.fn();
    const { result } = renderHook(() => useRestoreRoutine({ showFailure }), { wrapper });

    const outcomes = await act(() =>
      Promise.all([result.current(ROUTINE_ID), result.current(ROUTINE_ID)]),
    );

    expect(outcomes).toEqual([false, false]);
    expect(showFailure.mock.calls).toEqual([[ROUTINE_RESTORE_FAILED]]);
  });

  it("should send nothing offline and say it was not restored", async () => {
    const fake = installRoutinesFake(server);
    onlineManager.setOnline(false);
    const { wrapper } = createWrapper();
    const showFailure = vi.fn();
    const { result } = renderHook(() => useRestoreRoutine({ showFailure }), { wrapper });

    const isRestored = await act(() => result.current(ROUTINE_ID));

    expect(isRestored).toBe(false);
    expect(fake.requestCount).toBe(0);
    expect(showFailure.mock.calls).toEqual([[ROUTINE_RESTORE_FAILED]]);
  });
});

describe("useArchiveRoutineWithUndo", () => {
  it("should archive, resolve true and offer Undo, whose action restores after the hook is unmounted", async () => {
    const fake = installRoutinesFake(server, { archived: routineFlagsRow({ is_archived: true }) });
    const { wrapper } = createWrapper();
    const showFailure = vi.fn();
    const showArchived = vi.fn<RoutineNotices["showArchived"]>();
    const { result, unmount } = renderHook(
      () => useArchiveRoutineWithUndo({ showFailure, showArchived }),
      { wrapper },
    );

    const isArchived = await act(() => result.current(ROUTINE_ID));
    expect(isArchived).toBe(true);
    expect(fake.archives.map(({ body }) => body)).toEqual([{ is_archived: true }]);
    expect(showArchived).toHaveBeenCalledTimes(1);
    const toast = shownToast(showArchived);
    expect(toast).toMatchObject({
      message: ROUTINE_ARCHIVED_TOAST.message,
      actionLabel: ROUTINE_ARCHIVED_TOAST.undoAction,
    });

    unmount();
    await act(async () => {
      toast.onAction();
      await vi.waitFor(() => {
        expect(fake.archives).toHaveLength(2);
      });
    });

    expect(fake.archives.map(({ body }) => body)).toEqual([
      { is_archived: true },
      { is_archived: false },
    ]);
  });

  it("should tell the refusal, and offer no Undo, when the database says the routine is active", async () => {
    const fake = installRoutinesFake(server);
    fake.failWith("23514", 'violates check constraint "routines_active_not_archived"');
    const { wrapper } = createWrapper();
    const showFailure = vi.fn();
    const showArchived = vi.fn<RoutineNotices["showArchived"]>();
    const { result } = renderHook(() => useArchiveRoutineWithUndo({ showFailure, showArchived }), {
      wrapper,
    });

    const isArchived = await act(() => result.current(ROUTINE_ID));

    expect(isArchived).toBe(false);
    expect(showFailure.mock.calls).toEqual([[ARCHIVE_ACTIVE_REFUSAL]]);
    expect(showArchived).not.toHaveBeenCalled();
  });

  it("should send nothing offline and say the archive did not go through", async () => {
    const fake = installRoutinesFake(server);
    onlineManager.setOnline(false);
    const { wrapper } = createWrapper();
    const showFailure = vi.fn();
    const showArchived = vi.fn<RoutineNotices["showArchived"]>();
    const { result } = renderHook(() => useArchiveRoutineWithUndo({ showFailure, showArchived }), {
      wrapper,
    });

    const isArchived = await act(() => result.current(ROUTINE_ID));

    expect(isArchived).toBe(false);
    expect(fake.requestCount).toBe(0);
    expect(showFailure.mock.calls).toEqual([[ROUTINE_ARCHIVE_FAILED]]);
    expect(showArchived).not.toHaveBeenCalled();
  });

  it("should say the routine was not restored when an Undo cannot reach the database", async () => {
    installRoutinesFake(server, { archived: routineFlagsRow({ is_archived: true }) });
    const { wrapper } = createWrapper();
    const showFailure = vi.fn();
    const showArchived = vi.fn<RoutineNotices["showArchived"]>();
    const { result } = renderHook(() => useArchiveRoutineWithUndo({ showFailure, showArchived }), {
      wrapper,
    });
    await act(() => result.current(ROUTINE_ID));

    onlineManager.setOnline(false);
    await act(async () => {
      shownToast(showArchived).onAction();
      await vi.waitFor(() => {
        expect(showFailure.mock.calls).toEqual([[ROUTINE_RESTORE_FAILED]]);
      });
    });
  });

  it("should ignore a second press while the first is on its way", async () => {
    const fake = installRoutinesFake(server, { archived: routineFlagsRow({ is_archived: true }) });
    const release = fake.holdWrites();
    const { wrapper } = createWrapper();
    const { result } = renderHook(
      () => useArchiveRoutineWithUndo({ showFailure: vi.fn(), showArchived: vi.fn() }),
      { wrapper },
    );

    const outcomes = await act(async () => {
      const first = result.current(ROUTINE_ID);
      const second = result.current(ROUTINE_ID);
      await new Promise((resolve) => setTimeout(resolve, 50));
      release();
      return Promise.all([first, second]);
    });

    expect(outcomes).toEqual([true, false]);
    expect(fake.archives).toHaveLength(1);
  });
});
