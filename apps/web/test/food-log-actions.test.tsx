import { act, cleanup, render, renderHook, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { AddFoodDialogProps } from "@/components/diary/AddFoodDialog";

import { FoodLogActionsProvider, useFoodLogActions } from "@/lib/foodLogActions";

const { pathname } = vi.hoisted(() => ({ pathname: { current: "/diary" } }));

vi.mock("next/navigation", () => ({ usePathname: () => pathname.current }));

vi.mock("@/components/diary/AddFoodDialog", () => ({
  AddFoodDialog: ({ request, onClose }: AddFoodDialogProps) => (
    <div role="dialog" aria-label="Add food">
      <p>{`Adding on ${request.date}${request.time === undefined ? "" : ` at ${request.time}`}`}</p>
      <button type="button" onClick={onClose}>
        Close the add dialog
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
