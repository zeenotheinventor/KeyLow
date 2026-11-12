import { describe, expect, it } from "vitest";

import { compileUtilities, reducedMotionRules } from "../ui/compileUtilities";

describe("the cut-in animation", () => {
  it("should be emitted as the design's kl-cut-in over the standard duration, leaving the side and landing upright", async () => {
    const css = await compileUtilities("animate-kl-cut-in");

    expect(css).toContain("@keyframes kl-cut-in");
    expect(css).toContain("translateX(28px) skewX(-8deg)");
    expect(css).toContain("translateX(-3px) skewX(2deg)");
    expect(css).toContain("animation: kl-cut-in 220ms cubic-bezier(0.18,1.25,0.3,1) both");
  });

  it("should become a fade over the quick duration under reduced motion, with no movement", async () => {
    const css = await compileUtilities("animate-kl-cut-in motion-reduce:animate-kl-fade-in");
    const reduced = reducedMotionRules(css, "kl-fade-in");

    expect(css).toContain("@keyframes kl-fade-in");
    expect(reduced).toContain("animation: kl-fade-in 160ms ease both");
    const keyframes = css.split("@keyframes kl-fade-in")[1]?.split("@keyframes")[0] ?? "";
    expect(keyframes).not.toContain("transform");
    expect(keyframes.replaceAll(/\s/g, "")).toContain("from{opacity:0}to{opacity:1}");
  });
});
