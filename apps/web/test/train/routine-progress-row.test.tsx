import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import type { RoutineProgressRowProps } from "@/components/train/RoutineProgressRow";

import { RoutineProgressRow } from "@/components/train/RoutineProgressRow";

const rise: RoutineProgressRowProps = {
  name: "Bench press",
  line: "62.5 kg for 6 reps",
  change: { text: "+2.5 kg", direction: "up" },
  accessibleName: "Bench press, 62.5 kg for 6 reps, up 2.5 kg on the last trained week",
  points: [60, 60, null, 62.5],
};

const renderRow = (props: RoutineProgressRowProps) =>
  render(
    <ul>
      <RoutineProgressRow {...props} />
    </ul>,
  );

/** The classes the sparkline's line is drawn with, which give it its colour. */
const lineClasses = (container: HTMLElement) =>
  container.getElementsByTagName("path")[0]?.getAttribute("class") ?? "";

describe("a row of the Progress section", () => {
  afterEach(cleanup);

  it("should read its name, its line and the change in words, as a link named in full to where it goes", () => {
    renderRow({ ...rise, href: "/train/progress/bench" });

    const row = screen.getByRole("link", { name: rise.accessibleName });
    expect(row.getAttribute("href")).toBe("/train/progress/bench");
    expect(within(row).getByText("Bench press")).toBeTruthy();
    expect(within(row).getByText("62.5 kg for 6 reps")).toBeTruthy();
    expect(within(row).getByText("+2.5 kg")).toBeTruthy();
  });

  it("should be plain information, with no link and no chevron, when it has nowhere to go", () => {
    const { container } = renderRow(rise);

    expect(screen.queryByRole("link")).toBeNull();
    // Only the sparkline is drawn, so there is no chevron after it.
    expect(container.getElementsByTagName("svg")).toHaveLength(1);
  });

  it("should draw the line green for a rise, red for a fall and plain for no change", () => {
    const up = renderRow(rise);
    expect(lineClasses(up.container)).toContain("stroke-success-ink");
    cleanup();

    const down = renderRow({ ...rise, change: { text: "−2.5 kg", direction: "down" } });
    expect(lineClasses(down.container)).toContain("stroke-danger");
    cleanup();

    const none = renderRow({ ...rise, change: null });
    expect(lineClasses(none.container)).toContain("stroke-chart-trend");
  });

  it("should colour the pill green for a rise and red for a fall, its sign and words saying the same", () => {
    renderRow(rise);
    expect(screen.getByText("+2.5 kg").className).toContain("bg-success-muted");
    cleanup();

    renderRow({ ...rise, change: { text: "−2.5 kg", direction: "down" } });
    expect(screen.getByText("−2.5 kg").className).toContain("bg-danger-muted");
  });

  it("should draw no pill without a change", () => {
    renderRow({ ...rise, change: null });

    expect(screen.queryByText("+2.5 kg")).toBeNull();
  });

  it("should draw no sparkline when no week was trained", () => {
    const { container } = renderRow({
      ...rise,
      line: "Not trained yet",
      change: null,
      points: [null, null, null],
    });

    expect(container.getElementsByTagName("svg")).toHaveLength(0);
  });

  it("should leave the sparkline out of what a screen reader reads, since the row says it in full", () => {
    renderRow({ ...rise, href: "/train/progress/bench" });

    expect(screen.queryByRole("img")).toBeNull();
  });
});
