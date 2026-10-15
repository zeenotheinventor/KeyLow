import { act, cleanup, fireEvent, render, renderHook, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { AddFoodDialogProps } from "@/components/diary/AddFoodDialog";
import type { EditEntryDialogProps } from "@/components/diary/EditEntryDialog";
import type { QuickAddDialogProps } from "@/components/diary/QuickAddDialog";

import { FoodLogActionsProvider, useFoodLogActions } from "@/lib/foodLogActions";

const { pathname } = vi.hoisted(() => ({ pathname: { current: "/diary" } }));

vi.mock("next/navigation", () => ({ usePathname: () => pathname.current }));

vi.mock("@/components/diary/AddFoodDialog", () => ({
  AddFoodDialog: ({ request, opener, onClose, onQuickAdd }: AddFoodDialogProps) => (
    <div role="dialog" aria-label="Add food" data-opener={opener?.textContent ?? "none"}>
      <button type="button" onClick={onQuickAdd}>
        Open quick add
      </button>
      <p>{`Adding on ${request.date}${request.time === undefined ? "" : ` at ${request.time}`}`}</p>
      <button type="button" onClick={onClose}>
        Close the add dialog
      </button>
    </div>
  ),
}));

vi.mock("@/components/diary/EditEntryDialog", () => ({
  EditEntryDialog: ({ entryId, date, opener, onClose }: EditEntryDialogProps) => (
    <div role="dialog" aria-label="Edit entry" data-opener={opener?.textContent ?? "none"}>
      <p>{`Editing ${entryId} on ${date}`}</p>
      <button type="button" onClick={onClose}>
        Close the edit dialog
      </button>
    </div>
  ),
}));

vi.mock("@/components/diary/QuickAddDialog", () => ({
  QuickAddDialog: ({ request, opener, onClose }: QuickAddDialogProps) => (
    <div role="dialog" aria-label="Quick add" data-opener={opener?.textContent ?? "none"}>
      <p>{`Quick adding on ${request.date}${request.time === undefined ? "" : ` at ${request.time}`}`}</p>
      <button type="button" onClick={onClose}>
        Close the quick add dialog
      </button>
    </div>
  ),
}));

function wrapper({ children }: { children: React.ReactNode }) {
  return <FoodLogActionsProvider>{children}</FoodLogActionsProvider>;
}

describe("FoodLogActionsProvider", () => {
  beforeEach(() => {
    pathname.current = "/diary";
  });

  afterEach(() => {
    cleanup();
  });

  describe("openAddFood", () => {
    it("should show no dialog until it is asked to", () => {
      render(<FoodLogActionsProvider>{null}</FoodLogActionsProvider>);

      expect(screen.queryByRole("dialog")).toBeNull();
    });

    it("should open the add food dialog for the day", () => {
      const { result } = renderHook(() => useFoodLogActions(), { wrapper });

      act(() => {
        result.current.openAddFood({ date: "2026-10-15" });
      });

      expect(screen.getByText("Adding on 2026-10-15")).toBeTruthy();
    });

    it("should hand the hour of an hour's plus to the dialog", () => {
      const { result } = renderHook(() => useFoodLogActions(), { wrapper });

      act(() => {
        result.current.openAddFood({ date: "2026-10-15", time: "12:00" });
      });

      expect(screen.getByText("Adding on 2026-10-15 at 12:00")).toBeTruthy();
    });

    it("should close the dialog when the dialog asks to", () => {
      const { result } = renderHook(() => useFoodLogActions(), { wrapper });
      act(() => {
        result.current.openAddFood({ date: "2026-10-15" });
      });

      act(() => {
        screen.getByRole("button", { name: "Close the add dialog" }).click();
      });

      expect(screen.queryByRole("dialog")).toBeNull();
    });

    it("should close the dialog when the page changes under it", () => {
      const { result, rerender } = renderHook(() => useFoodLogActions(), { wrapper });
      act(() => {
        result.current.openAddFood({ date: "2026-10-15" });
      });

      pathname.current = "/foods/new";
      rerender();

      expect(screen.queryByRole("dialog")).toBeNull();
    });

    it("should start the next request fresh, with its own hour", () => {
      const { result } = renderHook(() => useFoodLogActions(), { wrapper });
      act(() => {
        result.current.openAddFood({ date: "2026-10-15", time: "12:00" });
      });
      act(() => {
        screen.getByRole("button", { name: "Close the add dialog" }).click();
      });

      act(() => {
        result.current.openAddFood({ date: "2026-10-15", time: "08:00" });
      });

      expect(screen.getByText("Adding on 2026-10-15 at 08:00")).toBeTruthy();
    });
  });

  describe("openEditEntry", () => {
    it("should open the edit dialog for the entry, on the day on view", () => {
      const { result } = renderHook(() => useFoodLogActions(), { wrapper });
      act(() => {
        result.current.setViewedDate("2026-10-14");
      });

      act(() => {
        result.current.openEditEntry("entry-1");
      });

      expect(screen.getByText("Editing entry-1 on 2026-10-14")).toBeTruthy();
    });

    it("should do nothing away from the diary, where no day is on view", () => {
      const { result } = renderHook(() => useFoodLogActions(), { wrapper });

      act(() => {
        result.current.openEditEntry("entry-1");
      });

      expect(screen.queryByRole("dialog")).toBeNull();
    });

    it("should close the dialog when the dialog asks to", () => {
      const { result } = renderHook(() => useFoodLogActions(), { wrapper });
      act(() => {
        result.current.setViewedDate("2026-10-14");
      });
      act(() => {
        result.current.openEditEntry("entry-1");
      });

      act(() => {
        screen.getByRole("button", { name: "Close the edit dialog" }).click();
      });

      expect(screen.queryByRole("dialog")).toBeNull();
    });
  });

  describe("openQuickAdd", () => {
    it("should open the quick add dialog with the day and the hour", () => {
      const { result } = renderHook(() => useFoodLogActions(), { wrapper });

      act(() => {
        result.current.openQuickAdd({ date: "2026-10-15", time: "12:00" });
      });

      expect(screen.getByText("Quick adding on 2026-10-15 at 12:00")).toBeTruthy();
    });

    it("should have one dialog open at a time", () => {
      const { result } = renderHook(() => useFoodLogActions(), { wrapper });
      act(() => {
        result.current.openAddFood({ date: "2026-10-15" });
      });

      act(() => {
        result.current.openQuickAdd({ date: "2026-10-15" });
      });

      expect(screen.getAllByRole("dialog")).toHaveLength(1);
      expect(screen.getByRole("dialog", { name: "Quick add" })).toBeTruthy();
    });
  });

  describe("the control a dialog was opened from", () => {
    function Triggers() {
      const { openAddFood, openEditEntry, setViewedDate } = useFoodLogActions();

      return (
        <>
          <button
            type="button"
            onClick={() => {
              setViewedDate("2026-10-15");
              openAddFood({ date: "2026-10-15", time: "12:00" });
            }}
          >
            Hour plus
          </button>
          <button
            type="button"
            onClick={() => {
              openEditEntry("entry-1");
            }}
          >
            Edit row
          </button>
        </>
      );
    }

    it("should hand the add dialog the control that was focused when it opened", () => {
      render(
        <FoodLogActionsProvider>
          <Triggers />
        </FoodLogActionsProvider>,
      );
      const plus = screen.getByRole("button", { name: "Hour plus" });
      plus.focus();

      fireEvent.click(plus);

      expect(screen.getByRole("dialog", { name: "Add food" }).getAttribute("data-opener")).toBe(
        "Hour plus",
      );
    });

    it("should carry that control to quick add when it is opened from inside the add dialog", () => {
      render(
        <FoodLogActionsProvider>
          <Triggers />
        </FoodLogActionsProvider>,
      );
      const plus = screen.getByRole("button", { name: "Hour plus" });
      plus.focus();
      fireEvent.click(plus);
      // Focus is inside the add dialog by now, as it is for a person.
      const quickRow = screen.getByRole("button", { name: "Open quick add" });
      quickRow.focus();

      fireEvent.click(quickRow);

      expect(screen.getByRole("dialog", { name: "Quick add" }).getAttribute("data-opener")).toBe(
        "Hour plus",
      );
    });

    it("should open quick add for the same day and hour as the add dialog", () => {
      render(
        <FoodLogActionsProvider>
          <Triggers />
        </FoodLogActionsProvider>,
      );
      fireEvent.click(screen.getByRole("button", { name: "Hour plus" }));

      fireEvent.click(screen.getByRole("button", { name: "Open quick add" }));

      expect(screen.getByText("Quick adding on 2026-10-15 at 12:00")).toBeTruthy();
    });

    it("should forget the control once the dialog is closed, so the next one has its own", () => {
      render(
        <FoodLogActionsProvider>
          <Triggers />
        </FoodLogActionsProvider>,
      );
      const plus = screen.getByRole("button", { name: "Hour plus" });
      plus.focus();
      fireEvent.click(plus);
      fireEvent.click(screen.getByRole("button", { name: "Close the add dialog" }));
      const edit = screen.getByRole("button", { name: "Edit row" });
      edit.focus();

      fireEvent.click(edit);

      expect(screen.getByRole("dialog", { name: "Edit entry" }).getAttribute("data-opener")).toBe(
        "Edit row",
      );
    });
  });

  it("should know no day on view until a page says which", () => {
    const { result } = renderHook(() => useFoodLogActions(), { wrapper });

    expect(result.current.viewedDate).toBeUndefined();

    act(() => {
      result.current.setViewedDate("2026-10-14");
    });

    expect(result.current.viewedDate).toBe("2026-10-14");
  });

  it("should refuse to be used outside the provider", () => {
    expect(() => render(<Probe />)).toThrow("useFoodLogActions must be used inside");
  });
});

function Probe() {
  useFoodLogActions();
  return null;
}
