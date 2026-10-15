import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useRef } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { ToastOptions } from "@/components/ui/Toast";

import { Toast, ToastProvider, useToast } from "@/components/ui/Toast";

function wait(milliseconds: number) {
  act(() => {
    vi.advanceTimersByTime(milliseconds);
  });
}

type RowsProps = {
  onUndo?: () => void;
  /** Whether the toast asks for focus. */
  focusesUndo?: boolean;
  options?: Partial<ToastOptions>;
};

// A delete button, the row after it, and a link far down the page, as the diary has them.
function Rows({ onUndo = () => undefined, focusesUndo = true, options = {} }: RowsProps) {
  const toast = useToast();
  const nextRow = useRef<HTMLButtonElement>(null);

  return (
    <>
      <button
        type="button"
        onClick={() => {
          toast.show({
            message: "Entry deleted",
            actionLabel: "Undo",
            onAction: onUndo,
            ...(focusesUndo ? { focusAction: { returnTo: nextRow.current } } : {}),
            ...options,
          });
        }}
      >
        Delete
      </button>
      <button type="button" ref={nextRow}>
        Next row
      </button>
      <a href="/elsewhere">Elsewhere</a>
    </>
  );
}

function renderRows(props: RowsProps = {}) {
  render(
    <ToastProvider>
      <Rows {...props} />
    </ToastProvider>,
  );
}

const deleteButton = () => screen.getByRole("button", { name: "Delete" });
const undoButton = () => screen.getByRole("button", { name: "Undo" });
const nextRow = () => screen.getByRole("button", { name: "Next row" });

function pressDelete() {
  deleteButton().focus();
  fireEvent.click(deleteButton());
}

describe("the keyboard route to Undo", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  describe("when the toast asks for focus", () => {
    it("should move focus to the Undo button", () => {
      renderRows();

      pressDelete();

      expect(document.activeElement).toBe(undoButton());
    });

    it("should leave focus where it is when the toast does not ask", () => {
      renderRows({ focusesUndo: false });

      pressDelete();

      expect(document.activeElement).toBe(deleteButton());
    });

    it("should wait while focus is on Undo, however long that is", () => {
      renderRows();
      pressDelete();

      wait(60_000);

      expect(undoButton()).toBe(document.activeElement);
    });

    it("should run the action when Undo is pressed and give focus to the row it was told", () => {
      const onUndo = vi.fn();
      renderRows({ onUndo });
      pressDelete();

      fireEvent.click(undoButton());

      expect(onUndo).toHaveBeenCalledTimes(1);
      expect(screen.queryByRole("button", { name: "Undo" })).toBeNull();
      expect(document.activeElement).toBe(nextRow());
    });

    it("should close on Escape and give focus to the row it was told", () => {
      const onUndo = vi.fn();
      renderRows({ onUndo });
      pressDelete();

      fireEvent.keyDown(undoButton(), { key: "Escape" });

      expect(onUndo).not.toHaveBeenCalled();
      expect(screen.queryByRole("button", { name: "Undo" })).toBeNull();
      expect(document.activeElement).toBe(nextRow());
    });

    it("should not close on another key", () => {
      renderRows();
      pressDelete();

      fireEvent.keyDown(undoButton(), { key: "a" });

      expect(undoButton()).toBeTruthy();
    });

    it("should close five seconds after focus leaves it, and leave focus where the person put it", () => {
      renderRows();
      pressDelete();

      act(() => {
        screen.getByRole("link", { name: "Elsewhere" }).focus();
      });
      wait(4999);
      expect(screen.getByRole("button", { name: "Undo" })).toBeTruthy();
      wait(1);

      expect(screen.queryByRole("button", { name: "Undo" })).toBeNull();
      expect(document.activeElement).toBe(screen.getByRole("link", { name: "Elsewhere" }));
    });

    it("should look for the place to go back to only when it closes", () => {
      const lateRow = document.createElement("button");
      const resolve = vi.fn(() => lateRow);
      renderRows({ options: { focusAction: { returnTo: resolve } } });
      pressDelete();
      expect(resolve).not.toHaveBeenCalled();
      // The place appears while the toast waits, as the rows of a copied day do.
      document.body.append(lateRow);

      fireEvent.keyDown(undoButton(), { key: "Escape" });

      expect(resolve).toHaveBeenCalledOnce();
      expect(document.activeElement).toBe(lateRow);
      lateRow.remove();
    });

    it("should close quietly when the place it is asked to go back to is not there", () => {
      renderRows({ options: { focusAction: { returnTo: () => null } } });
      pressDelete();

      fireEvent.keyDown(undoButton(), { key: "Escape" });

      expect(screen.queryByRole("button", { name: "Undo" })).toBeNull();
      expect(document.activeElement).toBe(document.body);
    });

    it("should close quietly when there is no row to give focus to", () => {
      renderRows({ options: { focusAction: { returnTo: null } } });
      pressDelete();

      fireEvent.keyDown(undoButton(), { key: "Escape" });

      expect(screen.queryByRole("button", { name: "Undo" })).toBeNull();
      expect(document.activeElement).toBe(document.body);
    });

    it("should close quietly when the row it was told has left the page", () => {
      const goneRow = document.createElement("button");
      renderRows({ options: { focusAction: { returnTo: goneRow } } });
      pressDelete();

      fireEvent.keyDown(undoButton(), { key: "Escape" });

      expect(screen.queryByRole("button", { name: "Undo" })).toBeNull();
      expect(document.activeElement).toBe(document.body);
    });

    it("should give focus to the Undo of a toast that replaces it, not to the row", () => {
      renderRows();
      pressDelete();

      pressDelete();

      expect(document.activeElement).toBe(undoButton());
      expect(screen.getAllByRole("button", { name: "Undo" })).toHaveLength(1);
    });
  });

  describe("announcing", () => {
    it("should announce the message once, in the one live region", () => {
      renderRows();

      pressDelete();

      expect(screen.getAllByRole("status")).toHaveLength(1);
      expect(screen.getAllByText("Entry deleted")).toHaveLength(1);
      expect(screen.getByRole("status").textContent).toBe("Entry deletedUndo");
    });

    it("should not write the message again when focus moves onto Undo and off it", () => {
      renderRows();
      pressDelete();
      const message = screen.getByText("Entry deleted");

      screen.getByRole("link", { name: "Elsewhere" }).focus();
      undoButton().focus();

      expect(screen.getByText("Entry deleted")).toBe(message);
    });

    it("should name the button by its label alone, so the message is not read a second time", () => {
      renderRows();

      pressDelete();

      expect(undoButton().getAttribute("aria-label")).toBeNull();
      expect(undoButton().getAttribute("aria-describedby")).toBeNull();
    });
  });
});

describe("a Toast on its own", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it("should call onClose on Escape while focus is inside it", () => {
    const onClose = vi.fn();
    render(<Toast message="Entry deleted" actionLabel="Undo" onClose={onClose} />);

    fireEvent.keyDown(undoButton(), { key: "Escape" });

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("should move focus to its action when told to", () => {
    render(<Toast message="Entry deleted" actionLabel="Undo" focusAction={{ returnTo: null }} />);

    expect(document.activeElement).toBe(undoButton());
  });

  it("should not move focus when it has no action to give it to", () => {
    render(<Toast message="Entry deleted" focusAction={{ returnTo: null }} />);

    expect(document.activeElement).toBe(document.body);
  });
});
