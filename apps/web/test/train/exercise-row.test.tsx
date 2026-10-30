import { describeAddExerciseName } from "@keylow/core/copy";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { ExerciseRowProps } from "@/components/train/ExerciseRow";

import { ExerciseRow } from "@/components/train/ExerciseRow";

const renderRow = (props: Partial<ExerciseRowProps> = {}) => {
  const onAdd = vi.fn();
  render(
    <ul>
      <ExerciseRow
        name="Side lateral raise"
        equipment="dumbbell"
        isCustom={false}
        primaryMuscles={["delt_side"]}
        secondaryMuscles={[]}
        onAdd={onAdd}
        {...props}
      />
    </ul>,
  );
  return { onAdd };
};

describe("an exercise row", () => {
  afterEach(cleanup);

  it("should show the name, the equipment and the muscle it works", () => {
    renderRow();

    expect(screen.getByRole("listitem").textContent).toContain("Side lateral raise");
    expect(screen.getByText(/^Dumbbell/)).toBeTruthy();
    expect(screen.getByText("Side delts")).toBeTruthy();
  });

  it("should add the exercise from a button named for it", async () => {
    const { onAdd } = renderRow();

    await userEvent.click(
      screen.getByRole("button", { name: describeAddExerciseName("Side lateral raise") }),
    );

    expect(onAdd).toHaveBeenCalledTimes(1);
  });

  it("should draw the Custom pill for the person's own exercise only", () => {
    renderRow({ isCustom: true });
    expect(screen.getByText("Custom")).toBeTruthy();

    cleanup();
    renderRow({ isCustom: false });
    expect(screen.queryByText("Custom")).toBeNull();
  });

  it("should draw at most two muscles, the primary first and then the secondary", () => {
    renderRow({
      primaryMuscles: ["delt_side"],
      secondaryMuscles: ["traps_upper", "biceps"],
    });

    expect(screen.getByText("Side delts")).toBeTruthy();
    expect(screen.getByText("Upper traps")).toBeTruthy();
    expect(screen.queryByText("Biceps")).toBeNull();
  });

  it("should leave the secondary muscles out once two primary ones fill the row", () => {
    renderRow({ primaryMuscles: ["delt_side", "quads"], secondaryMuscles: ["traps_upper"] });

    expect(screen.getByText("Side delts")).toBeTruthy();
    expect(screen.getByText("Quads")).toBeTruthy();
    expect(screen.queryByText("Upper traps")).toBeNull();
  });
});
