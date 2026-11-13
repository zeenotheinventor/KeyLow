import { describe, expect, it } from "vitest";

import { loadingMarkAnimations, loadingMarkPoses } from "./loadingMarkKeyframes";
import loadingMark from "../../tailwind/animations/loading-mark.json";
import { compileUtilities, reducedMotionRules } from "../ui/compileUtilities";

const parts = [
  "loading-knock",
  "loading-plate-one",
  "loading-plate-two",
  "loading-arc-one",
  "loading-arc-two",
];

describe("the loading mark's animation", () => {
  it("should be the loop the prototype's pose maths gives, as the generated file holds it", () => {
    expect(loadingMark).toEqual(loadingMarkAnimations());
  });

  it("should start on the complete logo, with every plate seated and both arcs drawn in full", () => {
    const rest = loadingMarkPoses(0.72);

    expect(rest["loading-plate-one"]).toEqual({ transform: "translate(0px, 0px)", opacity: "1" });
    expect(rest["loading-plate-two"]).toEqual({ transform: "translate(0px, 0px)", opacity: "1" });
    for (const arc of [rest["loading-arc-one"], rest["loading-arc-two"]]) {
      expect(arc).toEqual({ strokeDasharray: "205 1000", strokeDashoffset: "0", opacity: "1" });
    }
    expect(
      Number.parseFloat(rest["loading-knock"].transform.slice("translate(".length)),
    ).toBeLessThan(0.01);
  });

  it("should empty the bar at the start of the loop, plates off and arcs hidden", () => {
    const start = loadingMarkPoses(0);

    expect(start["loading-plate-one"].opacity).toBe("0");
    expect(start["loading-arc-one"].opacity).toBe("0");
    expect(start["loading-arc-two"].opacity).toBe("0");
  });

  it("should be emitted for each part as one 2200 ms loop that begins 0.72 of the way through", async () => {
    const css = await compileUtilities(parts.map((part) => `animate-${part}`).join(" "));

    for (const part of parts) {
      expect(css).toContain(`@keyframes ${part}`);
      expect(css).toContain(`animation: ${part} 2200ms linear -1584ms infinite`);
    }
  });

  it("should stop under reduced motion, which leaves the complete logo as drawn", async () => {
    const css = await compileUtilities("animate-loading-arc-one motion-reduce:animate-none");

    expect(reducedMotionRules(css, "animate-none")).toContain("animation: none");
  });
});
