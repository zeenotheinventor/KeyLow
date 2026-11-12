import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { ExerciseWeekRowProps } from "@/components/train/ExerciseWeekRow";

import { ExerciseWeekRow } from "@/components/train/ExerciseWeekRow";

const rise: ExerciseWeekRowProps = {
  weekLabel: "Mon 19 Oct",
  value: "62.5 kg for 6 reps",
  change: { text: "+2.5 kg", direction: "up" },
  accessibleName: "Mon 19 Oct, 62.5 kg for 6 reps, +2.5 kg",
  selected: false,
  onPress: () => undefined,
};

const renderRow = (props: ExerciseWeekRowProps) =>
  render(
    <ul>
      <ExerciseWeekRow {...props} />
    </ul>,
  );

describe("ExerciseWeekRow", () => {
  afterEach(cleanup);

  it("should be a button named by the week said in full, with the Monday, the value and the change", () => {
    renderRow(rise);

    const row = screen.getByRole("button", { name: rise.accessibleName });
    expect(within(row).getByText("Mon 19 Oct")).toBeTruthy();
    expect(within(row).getByText("62.5 kg for 6 reps")).toBeTruthy();
    expect(within(row).getByText("+2.5 kg")).toBeTruthy();
  });

  it("should select its week when pressed", async () => {
    const onPress = vi.fn();
    renderRow({ ...rise, onPress });

    await userEvent.click(screen.getByRole("button", { name: rise.accessibleName }));

    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it("should say it is pressed only while its week is selected", () => {
    renderRow({ ...rise, selected: true });

    expect(
      screen.getByRole("button", { name: rise.accessibleName }).getAttribute("aria-pressed"),
    ).toBe("true");
  });

  it("should not be pressed when its week is not the selected one", () => {
    renderRow(rise);

    expect(
      screen.getByRole("button", { name: rise.accessibleName }).getAttribute("aria-pressed"),
    ).toBe("false");
  });

  it("should be plain information for a skipped week, which says Not trained", () => {
    renderRow({
      weekLabel: "Mon 12 Oct",
      value: null,
      change: null,
      accessibleName: "Mon 12 Oct, Not trained",
      selected: false,
    });

    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.getByRole("listitem").textContent).toBe("Mon 12 OctNot trained");
  });

  it.each([
    ["up", "success"],
    ["down", "danger"],
    [null, "neutral"],
  ] as const)("should tone a change that went %s as %s", (direction, tone) => {
    renderRow({ ...rise, change: { text: "the change", direction } });

    expect(screen.getByText("the change").className).toContain(
      { success: "bg-success-muted", danger: "bg-danger-muted", neutral: "bg-surface-sheet" }[tone],
    );
  });
});
