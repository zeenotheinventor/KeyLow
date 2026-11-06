import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { CountingNumeral } from "@/components/ui/CountingNumeral";

const motion = vi.hoisted(() => ({ isReduced: false }));
vi.mock("@/lib/motion", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/motion")>()),
  useReducedMotion: () => motion.isReduced,
}));

afterEach(() => {
  cleanup();
  motion.isReduced = false;
});

describe("CountingNumeral", () => {
  it("should draw the value as it is, with the given class, when nothing arrived", () => {
    render(<CountingNumeral value={1970} from={null} className="text-display-numeral" />);

    const figure = screen.getByText("1,970");
    expect(figure.className).toBe("text-display-numeral");
    expect(figure.getAttribute("aria-hidden")).toBeNull();
  });

  it("should begin at the start figure, flashing, with the final figure alone for a screen reader", () => {
    render(<CountingNumeral value={1970} from={0} className="text-display-numeral" />);

    const [hidden] = screen.getAllByText("0");
    expect(hidden?.getAttribute("aria-hidden")).toBe("true");
    expect(hidden?.className).toContain("animate-flash");
    expect(hidden?.className).toContain("text-display-numeral");
    expect(screen.getByText("1,970").className).toContain("sr-only");
  });

  it("should show the value at once, with no flash, under reduced motion", () => {
    motion.isReduced = true;

    render(<CountingNumeral value={1970} from={0} className="text-display-numeral" />);

    const hidden = screen
      .getAllByText("1,970")
      .find((figure) => figure.hasAttribute("aria-hidden"));
    expect(hidden?.className).not.toContain("animate-flash");
  });
});
