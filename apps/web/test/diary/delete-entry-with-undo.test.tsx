import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { foodEntry } from "./support";

import type { LogEntry } from "@keylow/api-client";

import { ToastProvider } from "@/components/ui/Toast";
import { useDeleteEntryWithUndo } from "@/lib/foodLogActions/useDeleteEntryWithUndo";

const api = vi.hoisted(() => ({
  deleteEntry: { mutateAsync: undefined as never },
  restoreEntry: { mutateAsync: undefined as never },
}));

vi.mock("@keylow/api-client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@keylow/api-client")>()),
  useDeleteEntry: () => api.deleteEntry,
  useRestoreEntry: () => api.restoreEntry,
}));

const entry: LogEntry = foodEntry({
  date: "2026-10-15",
  time: "08:05",
  name: "Porridge oats",
  quantity: 50,
  unit: "g",
  kcal: 187,
  protein: 5.6,
  fat: 4.2,
  carbs: 30.2,
});

function Remover() {
  const remove = useDeleteEntryWithUndo();

  return (
    <button
      type="button"
      onClick={() => {
        remove(entry);
      }}
    >
      Remove
    </button>
  );
}

// The component that made the call is gone, as the edit dialog is once it has closed. The toast is not.
function renderThenUnmountAfterRemoving() {
  const view = render(
    <ToastProvider>
      <Remover />
    </ToastProvider>,
  );
  fireEvent.click(screen.getByRole("button", { name: "Remove" }));
  view.rerender(<ToastProvider>{null}</ToastProvider>);
}

describe("useDeleteEntryWithUndo after the component that used it has gone", () => {
  beforeEach(() => {
    api.deleteEntry.mutateAsync = vi.fn(() => Promise.resolve()) as never;
    api.restoreEntry.mutateAsync = vi.fn(() => Promise.resolve()) as never;
  });

  afterEach(() => {
    cleanup();
  });

  it("should still say so when the delete fails", async () => {
    api.deleteEntry.mutateAsync = vi.fn(() => Promise.reject(new Error("RAW"))) as never;

    renderThenUnmountAfterRemoving();

    expect(await screen.findByText("Something went wrong. Try again.")).toBeTruthy();
    expect(screen.queryByText(/RAW/)).toBeNull();
  });

  it("should still say so when the Undo fails", async () => {
    api.restoreEntry.mutateAsync = vi.fn(() => Promise.reject(new Error("RAW"))) as never;
    renderThenUnmountAfterRemoving();

    fireEvent.click(screen.getByRole("button", { name: "Undo" }));

    expect(await screen.findByText("Something went wrong. Try again.")).toBeTruthy();
  });

  it("should say nothing when both go through", async () => {
    renderThenUnmountAfterRemoving();
    fireEvent.click(screen.getByRole("button", { name: "Undo" }));
    await act(async () => {
      await Promise.resolve();
    });

    expect(screen.queryByText("Something went wrong. Try again.")).toBeNull();
  });
});
