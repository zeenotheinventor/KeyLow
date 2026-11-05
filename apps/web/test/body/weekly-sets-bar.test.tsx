import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import type { WeeklySetsBarProps } from "@/components/body/MuscleSheet/WeeklySetsBar";

import { WeeklySetsBar } from "@/components/body/MuscleSheet/WeeklySetsBar";

const labels = { start: "0", growing: "4", productive: "10", high: "20" };
const name =
  "5.5 sets done, Growing, 11 planned. Growing from 4 sets, Productive from 10, High above 20";
const weeklySets: WeeklySetsBarProps["weeklySets"] = {
  actual: 5.5,
  planned: 11,
  bands: { growingFromSets: 4, productiveFromSets: 10, highAboveSets: 20 },
  actualStatus: "growing",
  plannedStatus: "productive",
  volumeStatus: "growing",
};

const renderBar = (props: Partial<WeeklySetsBarProps> = {}) =>
  render(<WeeklySetsBar labels={labels} name={name} weeklySets={weeklySets} {...props} />);

describe("WeeklySetsBar", () => {
  afterEach(cleanup);

  it("should be one image named by the copy, so colour is never the only signal", () => {
    renderBar();

    expect(screen.getByRole("img", { name })).toBeTruthy();
  });

  it("should write the number under each band edge and the start", () => {
    renderBar();

    const bar = screen.getByRole("img", { name });
    for (const label of Object.values(labels)) {
      expect(within(bar).getByText(label)).toBeTruthy();
    }
  });

  it("should place the done fill, the planned tick and the High edge along the 0 to 24 track", () => {
    renderBar();

    const bar = screen.getByRole("img", { name });
    const shareOf = (property: string) => parseFloat(bar.style.getPropertyValue(property));
    expect(shareOf("--done")).toBeCloseTo(22.92, 2);
    expect(shareOf("--planned")).toBeCloseTo(45.83, 2);
    expect(shareOf("--high")).toBeCloseTo(83.33, 2);
  });

  it.each([
    ["not_trained", "bg-volume-not-trained"],
    ["maintaining", "bg-volume-maintaining"],
    ["growing", "bg-volume-growing"],
    ["productive", "bg-volume-productive"],
    ["high", "bg-volume-high"],
  ] as const)("should fill %s in its band colour", (volumeStatus, fillClass) => {
    renderBar({ weeklySets: { ...weeklySets, volumeStatus } });

    expect(screen.getByTestId("sets-bar-fill").classList.contains(fillClass)).toBe(true);
  });
});
