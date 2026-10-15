import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { ToastFocusAction } from "@/components/ui/Toast";

import { useKeyboardUndo } from "@/lib/keyboardUndo";

type Result = { focusAction?: ToastFocusAction };

// What afterPressingButton gave on each press, to be called when the action finishes.
let settlers: (() => Result)[] = [];

// A log of two foods, a control the page hides at this width, and the buttons after the log.
function Log({ onResult }: { onResult: (result: Result) => void }) {
  const keyboardUndo = useKeyboardUndo();

  return (
    <div>
      <ul aria-label="Foods">
        <li>
          <span>Porridge</span>
          <button
            type="button"
            onClick={() => {
              onResult(keyboardUndo.afterRemovingRow());
            }}
          >
            Delete porridge
          </button>
        </li>
        <li>
          <span>Milk</span>
          <button
            type="button"
            onClick={() => {
              onResult(keyboardUndo.afterRemovingRow());
            }}
          >
            Delete milk
          </button>
        </li>
      </ul>
      <button type="button">Hidden copy</button>
      <button
        type="button"
        onClick={() => {
          settlers.push(keyboardUndo.afterPressingButton());
        }}
      >
        Copy to today
      </button>
      <button type="button">Elsewhere</button>
      <button type="button" role="switch" aria-checked="false">
        Mark day complete
      </button>
    </div>
  );
}

function renderLog() {
  const results: Result[] = [];
  settlers = [];
  render(
    <Log
      onResult={(result) => {
        results.push(result);
      }}
    />,
  );

  return results;
}

const keyboard = () => fireEvent.keyDown(document, { key: "Enter" });
const pointer = () => fireEvent.pointerDown(document);

// A keyboard press is a click with no detail, a mouse click has one or more, as in a browser.
function press(name: string, detail = 0) {
  const button = screen.getByRole("button", { name });
  button.focus();
  fireEvent.click(button, { detail });
}

describe("useKeyboardUndo", () => {
  afterEach(() => {
    cleanup();
  });

  describe("afterRemovingRow", () => {
    it("should ask for focus on Undo and return it to the next row's first control", () => {
      const results = renderLog();
      keyboard();

      press("Delete porridge");

      expect(results[0]?.focusAction?.returnTo).toBe(
        screen.getByRole("button", { name: "Delete milk" }),
      );
    });

    it("should skip a control the page does not show, so the last row's focus lands on the one after", () => {
      const results = renderLog();
      // jsdom draws nothing, so the page's check for a control that is not shown is told which one.
      Object.defineProperty(
        screen.getByRole("button", { name: "Hidden copy" }),
        "checkVisibility",
        {
          value: () => false,
        },
      );
      keyboard();

      press("Delete milk");

      expect(results[0]?.focusAction?.returnTo).toBe(
        screen.getByRole("button", { name: "Copy to today" }),
      );
    });

    it("should fall back to the control before the row when nothing after it is shown", () => {
      const results = renderLog();
      for (const name of ["Hidden copy", "Copy to today", "Elsewhere", "Mark day complete"]) {
        Object.defineProperty(
          screen.getByRole(name === "Mark day complete" ? "switch" : "button", { name }),
          "checkVisibility",
          {
            value: () => false,
          },
        );
      }
      keyboard();

      press("Delete milk");

      expect(results[0]?.focusAction?.returnTo).toBe(
        screen.getByRole("button", { name: "Delete porridge" }),
      );
    });

    it("should ask for nothing when the last press was a pointer", () => {
      const results = renderLog();
      pointer();

      press("Delete porridge", 1);

      expect(results[0]).toEqual({});
    });

    it("should ask for nothing again once a pointer follows the keyboard", () => {
      const results = renderLog();
      keyboard();
      pointer();

      press("Delete porridge", 1);

      expect(results[0]).toEqual({});
    });

    it("should ask for focus on Undo with nowhere to return to when nothing in the page has focus", () => {
      const results = renderLog();
      keyboard();

      fireEvent.click(screen.getByRole("button", { name: "Delete porridge" }));

      expect(results[0]).toEqual({ focusAction: { returnTo: null } });
    });
  });

  describe("a click with no detail", () => {
    it("should count as the keyboard, so a screen reader's virtual click gets the route", () => {
      const results = renderLog();

      press("Delete porridge");

      expect(results[0]?.focusAction?.returnTo).toBe(
        screen.getByRole("button", { name: "Delete milk" }),
      );
    });

    it("should count as a pointer when it has a detail, whatever key was pressed before", () => {
      const results = renderLog();
      keyboard();

      press("Delete porridge", 1);

      expect(results[0]).toEqual({});
    });
  });

  describe("afterPressingButton", () => {
    it("should return focus to the button that was pressed, when the action finishes with focus still on it", () => {
      renderLog();
      keyboard();
      press("Copy to today");

      expect(settlers[0]?.().focusAction?.returnTo).toBe(
        screen.getByRole("button", { name: "Copy to today" }),
      );
    });

    it("should still ask when the action finishes with focus lost to the page", () => {
      renderLog();
      keyboard();
      press("Copy to today");
      screen.getByRole("button", { name: "Copy to today" }).blur();

      expect(settlers[0]?.().focusAction?.returnTo).toBe(
        screen.getByRole("button", { name: "Copy to today" }),
      );
    });

    it("should ask for nothing when the person has moved focus to another control meanwhile", () => {
      renderLog();
      keyboard();
      press("Copy to today");
      screen.getByRole("button", { name: "Elsewhere" }).focus();

      expect(settlers[0]?.()).toEqual({});
    });

    it("should ask for nothing when the last press was a pointer", () => {
      renderLog();
      pointer();

      press("Copy to today", 1);

      expect(settlers[0]?.()).toEqual({});
    });
  });

  it("should stop listening to the page when the screen using it has gone", () => {
    const remove = vi.spyOn(document, "removeEventListener");
    renderLog();

    cleanup();

    expect(remove.mock.calls.map(([type]) => type)).toEqual(
      expect.arrayContaining(["keydown", "pointerdown", "click"]),
    );
    remove.mockRestore();
  });
});
