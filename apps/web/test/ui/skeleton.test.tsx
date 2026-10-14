import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { compileUtilities, reducedMotionRules } from "./compileUtilities";

import { Skeleton, SkeletonBone } from "@/components/ui/Skeleton";

function wait(milliseconds: number) {
  act(() => {
    vi.advanceTimersByTime(milliseconds);
  });
}

describe("Skeleton", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  describe("delay", () => {
    it("should show nothing for the first 200 ms, so a quick load never flickers", () => {
      render(<Skeleton variant="text" />);

      wait(199);

      expect(screen.getByRole("status").childElementCount).toBe(0);
    });

    it("should show its bones after 200 ms", () => {
      render(<Skeleton variant="text" />);

      wait(200);

      expect(screen.getByRole("status").childElementCount).toBeGreaterThan(0);
    });

    it("should stop waiting when it is removed", () => {
      const { unmount } = render(<Skeleton variant="text" />);

      unmount();

      expect(() => {
        wait(500);
      }).not.toThrow();
    });
  });

  describe("accessible name", () => {
    it("should be a status that says it is loading", () => {
      render(<Skeleton variant="text" />);

      expect(screen.getByRole("status", { name: "Loading" })).toBeTruthy();
    });

    it("should say what is loading when told", () => {
      render(<Skeleton variant="text" label="Loading food" />);

      expect(screen.getByRole("status", { name: "Loading food" })).toBeTruthy();
    });

    it("should hide the bones from screen readers", () => {
      render(<Skeleton variant="text" lines={2} />);
      wait(200);

      for (const bone of Array.from(screen.getByRole("status").children)) {
        expect(bone.getAttribute("aria-hidden")).toBe("true");
      }
    });
  });

  describe("variants", () => {
    it("should draw the lines of text asked for", () => {
      render(<Skeleton variant="text" lines={3} />);
      wait(200);

      expect(screen.getByRole("status").childElementCount).toBe(3);
    });

    it("should draw a card of rows", () => {
      render(<Skeleton variant="rows" count={3} />);
      wait(200);

      const rows = screen.getByRole("status").firstElementChild?.children;

      expect(rows).toHaveLength(3);
    });

    it("should draw a block", () => {
      render(<Skeleton variant="block" />);
      wait(200);

      expect(screen.getByRole("status").childElementCount).toBe(1);
    });

    it("should draw the bones it is given, after the delay", () => {
      render(
        <Skeleton label="Loading food">
          <SkeletonBone className="h-7 w-[70%]" />
          <SkeletonBone className="h-[140px] rounded-large" />
        </Skeleton>,
      );

      expect(screen.getByRole("status").childElementCount).toBe(0);

      wait(200);

      expect(screen.getByRole("status").childElementCount).toBe(2);
    });
  });

  describe("reduced motion", () => {
    it("should hold the shimmer still under prefers-reduced-motion", async () => {
      render(<Skeleton variant="block" />);
      wait(200);
      const bone = screen.getByRole("status").firstElementChild;
      const css = await compileUtilities(bone?.getAttribute("class") ?? "");

      expect(reducedMotionRules(css, "motion-reduce\\:animate-none")).toContain("animation");
    });
  });
});
