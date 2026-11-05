import { renderHook } from "@testing-library/react";
import { CircleAlert } from "lucide-react";
import { describe, expect, it, vi } from "vitest";

import { useRoutineNotices } from "@/components/train/useRoutineNotices";

const show = vi.hoisted(() => vi.fn());
vi.mock("@/components/ui/Toast", () => ({ useToast: () => ({ show, dismiss: vi.fn() }) }));

describe("the routine notices", () => {
  it("should show a failure as a danger toast with the alert icon and nothing else", () => {
    const { result } = renderHook(() => useRoutineNotices());

    result.current.showFailure("It did not go through");

    expect(show).toHaveBeenLastCalledWith({
      message: "It did not go through",
      tone: "danger",
      icon: CircleAlert,
    });
  });

  it("should show the archived toast with its action, and no danger tone", () => {
    const onAction = vi.fn();
    const { result } = renderHook(() => useRoutineNotices());

    result.current.showArchived({ message: "Routine archived", actionLabel: "Undo", onAction });

    expect(show).toHaveBeenLastCalledWith({
      message: "Routine archived",
      actionLabel: "Undo",
      onAction,
    });
  });
});
