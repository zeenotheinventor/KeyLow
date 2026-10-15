import { act, cleanup, render, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { FoodLogActionsProvider, useFoodLogActions } from "@/lib/foodLogActions";

const { push } = vi.hoisted(() => ({ push: vi.fn<(href: string) => void>() }));

vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

function wrapper({ children }: { children: React.ReactNode }) {
  return <FoodLogActionsProvider>{children}</FoodLogActionsProvider>;
}

describe("FoodLogActionsProvider", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it("should send an add food request to the food search until the dialog exists", () => {
    const { result } = renderHook(() => useFoodLogActions(), { wrapper });

    result.current.openAddFood({ date: "2026-10-15", time: "12:00" });

    expect(push).toHaveBeenCalledExactlyOnceWith("/foods");
  });

  it("should do nothing for an edit request until the dialog exists", () => {
    const { result } = renderHook(() => useFoodLogActions(), { wrapper });

    result.current.openEditEntry("entry-1");

    expect(push).not.toHaveBeenCalled();
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
