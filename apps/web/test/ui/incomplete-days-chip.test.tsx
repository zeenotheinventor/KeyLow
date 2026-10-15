import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { IncompleteDaysChip } from "@/components/ui/IncompleteDaysChip";

describe("IncompleteDaysChip", () => {
  afterEach(() => {
    cleanup();
  });

  it("should say all days are complete at zero", () => {
    render(<IncompleteDaysChip count={0} />);

    expect(screen.getByText("All days complete this week")).toBeTruthy();
  });

  it("should say the week is complete when no count is given", () => {
    render(<IncompleteDaysChip />);

    expect(screen.getByText("All days complete this week")).toBeTruthy();
  });

  it("should count one incomplete day in the singular", () => {
    render(<IncompleteDaysChip count={1} />);

    expect(screen.getByText("1 incomplete day this week")).toBeTruthy();
  });

  it("should count several incomplete days in the plural", () => {
    render(<IncompleteDaysChip count={2} />);

    expect(screen.getByText("2 incomplete days this week")).toBeTruthy();
  });

  it("should not be a button when it has nothing to do", () => {
    render(<IncompleteDaysChip count={2} />);

    expect(screen.queryByRole("button")).toBeNull();
  });

  it("should be a button named by its text when it can be pressed", () => {
    const onPress = vi.fn();
    render(<IncompleteDaysChip count={2} onPress={onPress} />);

    fireEvent.click(screen.getByRole("button", { name: "2 incomplete days this week" }));

    expect(onPress).toHaveBeenCalledOnce();
  });

  it("should use the warning fill while days are incomplete and the success fill when none are", () => {
    const { rerender } = render(<IncompleteDaysChip count={1} />);
    expect(screen.getByText("1 incomplete day this week").className).toContain("bg-warning-muted");

    rerender(<IncompleteDaysChip count={0} />);
    expect(screen.getByText("All days complete this week").className).toContain("bg-success-muted");
  });

  it("should keep warning words in the primary text colour in light mode, and set success words in the success ink", () => {
    const { rerender } = render(<IncompleteDaysChip count={1} />);
    expect(screen.getByText("1 incomplete day this week").className).toContain(
      "light-theme:text-text-primary",
    );

    rerender(<IncompleteDaysChip count={0} />);
    const { className } = screen.getByText("All days complete this week");
    expect(className).toContain("text-success-ink");
    expect(className).not.toContain("light-theme:text-text-primary");
  });

  it("should show a focus ring on a pressable chip", () => {
    render(<IncompleteDaysChip count={1} onPress={() => undefined} />);

    expect(screen.getByRole("button").className).toContain("focus-visible:ring-2");
  });

  it("should reach 8 px above and below a pressable chip so the target is 44 px", () => {
    render(<IncompleteDaysChip count={1} onPress={() => undefined} />);

    expect(screen.getByRole("button").className).toContain("after:-inset-y-2");
  });

  it("should not add a hit area to a chip that cannot be pressed", () => {
    render(<IncompleteDaysChip count={1} />);

    expect(screen.getByText("1 incomplete day this week").className).not.toContain("after:");
  });
});
