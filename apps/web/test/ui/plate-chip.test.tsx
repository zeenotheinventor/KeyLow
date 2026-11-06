import { controlHeight, touchTarget } from "@keylow/tokens";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { compileUtilities } from "./compileUtilities";
import { reachOf } from "./hitArea";

import { PlateChip } from "@/components/ui/PlateChip";

afterEach(() => {
  cleanup();
});

describe("PlateChip", () => {
  it("should be a button named Your plate and the count, for one food", () => {
    render(<PlateChip count={1} onPress={() => undefined} />);

    expect(screen.getByRole("button", { name: "Your plate, 1 food" })).toBeTruthy();
  });

  it("should be named for several foods", () => {
    render(<PlateChip count={4} onPress={() => undefined} />);

    expect(screen.getByRole("button", { name: "Your plate, 4 foods" })).toBeTruthy();
  });

  it("should show the count as text beside the icon", () => {
    render(<PlateChip count={4} onPress={() => undefined} />);

    expect(screen.getByRole("button", { name: "Your plate, 4 foods" }).textContent).toBe("4");
  });

  it("should draw nothing at none, as the phone does", () => {
    const { container } = render(<PlateChip count={0} onPress={() => undefined} />);

    expect(container.firstChild).toBeNull();
  });

  it("should call onPress when pressed", () => {
    const onPress = vi.fn();
    render(<PlateChip count={2} onPress={onPress} />);

    fireEvent.click(screen.getByRole("button", { name: "Your plate, 2 foods" }));

    expect(onPress).toHaveBeenCalledTimes(1);
  });

  describe("expanded", () => {
    it("should say it is collapsed when the plate is closed", () => {
      render(<PlateChip count={2} onPress={() => undefined} />);

      expect(
        screen.getByRole("button", { name: "Your plate, 2 foods" }).getAttribute("aria-expanded"),
      ).toBe("false");
    });

    it("should say it is expanded and fill with the accent while the plate is open", async () => {
      render(<PlateChip count={2} isExpanded onPress={() => undefined} />);
      const chip = screen.getByRole("button", { name: "Your plate, 2 foods" });
      const css = await compileUtilities(chip.className);

      expect(chip.getAttribute("aria-expanded")).toBe("true");
      expect(css).toContain("background-color: rgb(var(--kl-accent) / var(--tw-bg-opacity, 1))");
    });
  });

  describe("disabled", () => {
    it("should dim, say so and not respond to a press", () => {
      const onPress = vi.fn();
      render(<PlateChip count={2} disabled onPress={onPress} />);
      const chip = screen.getByRole("button", { name: "Your plate, 2 foods" });

      fireEvent.click(chip);

      expect(chip.getAttribute("aria-disabled")).toBe("true");
      expect(chip.className).toContain("opacity-40");
      expect(onPress).not.toHaveBeenCalled();
    });

    it("should stay in the tab order, so a screen reader still finds it", () => {
      render(<PlateChip count={2} disabled onPress={() => undefined} />);

      expect(
        screen.getByRole("button", { name: "Your plate, 2 foods" }).getAttribute("disabled"),
      ).toBeNull();
    });
  });

  describe("the pill", () => {
    it("should be 36 high with the accent border on the muted accent, a pill radius and accent ink", async () => {
      render(<PlateChip count={2} onPress={() => undefined} />);
      const css = await compileUtilities(
        screen.getByRole("button", { name: "Your plate, 2 foods" }).className,
      );

      expect(css).toContain(`height: ${controlHeight.sm}px`);
      expect(css).toContain("border-color: rgb(var(--kl-accent) / var(--tw-border-opacity, 1))");
      expect(css).toContain("background-color: var(--kl-accent-muted)");
      expect(css).toContain("border-radius: 999px");
      expect(css).toContain("color: rgb(var(--kl-accent-ink) / var(--tw-text-opacity, 1))");
    });

    it("should reach a touch target high", async () => {
      render(<PlateChip count={2} onPress={() => undefined} />);
      const chip = screen.getByRole("button", { name: "Your plate, 2 foods" });
      const reach = await reachOf(chip, "after:", 1);

      expect(controlHeight.sm + reach.top + reach.bottom).toBe(touchTarget);
    });
  });
});
