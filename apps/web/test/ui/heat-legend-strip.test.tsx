import { BODY_MAP } from "@keylow/core/copy";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { compileUtilities } from "./compileUtilities";

import { HeatLegendStrip } from "@/components/ui/HeatLegendStrip";

const legend = () => screen.getByRole("img", { name: BODY_MAP.legendNames.heat });

describe("HeatLegendStrip", () => {
  afterEach(() => {
    cleanup();
  });

  it("should be one image named for the heat legend", () => {
    render(<HeatLegendStrip />);

    expect(legend()).toBeTruthy();
  });

  it("should name the two ends, Peak at the top and Rested at the bottom", () => {
    render(<HeatLegendStrip />);

    const words = Array.from(legend().querySelectorAll("p")).map((word) => word.textContent);
    expect(words).toStrictEqual([
      BODY_MAP.dashboardCard.hottestStep,
      BODY_MAP.dashboardCard.coolestStep,
    ]);
    expect(words).toStrictEqual(["Peak", "Rested"]);
  });

  it("should draw six swatches from the peak down to rested, and only the peak glows", () => {
    render(<HeatLegendStrip />);

    const swatches = Array.from(legend().querySelectorAll("span"));
    expect(swatches.map((swatch) => /bg-heat-\d/.exec(swatch.className)?.[0])).toStrictEqual([
      "bg-heat-5",
      "bg-heat-4",
      "bg-heat-3",
      "bg-heat-2",
      "bg-heat-1",
      "bg-heat-0",
    ]);
    expect(swatches.filter((swatch) => swatch.className.includes("shadow-heat-glow"))).toHaveLength(
      1,
    );
    expect(swatches[0]?.className).toContain("shadow-heat-glow");
  });

  it("should use classes the app's Tailwind config emits", async () => {
    render(<HeatLegendStrip />);

    const css = await compileUtilities(legend().outerHTML);

    for (const className of ["bg-heat-0", "bg-heat-5", "shadow-heat-glow"]) {
      expect(css).toContain(`.${className}`);
    }
  });
});
