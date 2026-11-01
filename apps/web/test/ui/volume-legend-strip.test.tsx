import { BODY_MAP } from "@keylow/core/copy";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { compileUtilities } from "./compileUtilities";

import { VolumeLegendStrip } from "@/components/ui/VolumeLegendStrip";

const legend = () => screen.getByRole("img", { name: BODY_MAP.legendNames.volume });

describe("VolumeLegendStrip", () => {
  afterEach(() => {
    cleanup();
  });

  it("should be one image named for the volume legend", () => {
    render(<VolumeLegendStrip />);

    expect(legend()).toBeTruthy();
  });

  it("should name the two ends, High at the top and Not trained at the bottom", () => {
    render(<VolumeLegendStrip />);

    const words = Array.from(legend().querySelectorAll("p")).map((word) => word.textContent);
    expect(words).toStrictEqual(["High", "Not trained"]);
  });

  it("should draw five swatches from High down to Not trained", () => {
    render(<VolumeLegendStrip />);

    const swatches = Array.from(legend().querySelectorAll("span"));
    expect(swatches.map((swatch) => /bg-volume-[a-z-]+/.exec(swatch.className)?.[0])).toStrictEqual(
      [
        "bg-volume-high",
        "bg-volume-productive",
        "bg-volume-growing",
        "bg-volume-maintaining",
        "bg-volume-not-trained",
      ],
    );
  });

  it("should use classes the app's Tailwind config emits", async () => {
    render(<VolumeLegendStrip />);

    const css = await compileUtilities(legend().outerHTML);

    for (const className of ["bg-volume-high", "bg-volume-not-trained"]) {
      expect(css).toContain(`.${className}`);
    }
  });
});
