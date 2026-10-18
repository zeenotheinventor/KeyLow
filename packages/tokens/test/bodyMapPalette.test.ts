import { describe, expect, it } from "vitest";

import { bodyMapPalette } from "../src";

// The values are the Ki-Lo training canvas's (kilo-training-proposals-v2.css, approved on KEY-339),
// written out here and not read back from the code under test.
describe("bodyMapPalette", () => {
  it("should return the canvas's dark values", () => {
    expect(bodyMapPalette("dark")).toEqual({
      silhouette: "#262D3A",
      separator: "#141821",
      heat: ["#3A4355", "#5E5647", "#8F6D3A", "#C98B2E", "#F2803A", "#FF7A6B"],
      heatGlow: "rgba(255,122,107,0.55)",
      volume: {
        under: "#4A86F7",
        maintaining: "#8DB0E8",
        productive: "#5CD67A",
        over: "#FF5C5C",
        notTargeted: "#303746",
      },
      gap: {
        behind: "#5B95FF",
        onPlan: "#596274",
        ahead: "#FF9F43",
        notInPlan: "#303746",
      },
    });
  });

  it("should return the canvas's light values", () => {
    expect(bodyMapPalette("light")).toEqual({
      silhouette: "#E2E6EC",
      separator: "#F7F8FA",
      heat: ["#C9CED8", "#DDB577", "#D99A45", "#CC7A22", "#BF5424", "#A8231D"],
      heatGlow: "rgba(168,35,29,0.35)",
      volume: {
        under: "#1F5BD6",
        maintaining: "#6E92D6",
        productive: "#1F9D4E",
        over: "#D93030",
        notTargeted: "#D7DBE2",
      },
      gap: {
        behind: "#1F5BD6",
        onPlan: "#B4BAC6",
        ahead: "#B35C00",
        notInPlan: "#D7DBE2",
      },
    });
  });

  it("should draw not in plan as not targeted, as the canvas does", () => {
    for (const scheme of ["dark", "light"] as const) {
      const palette = bodyMapPalette(scheme);

      expect(palette.gap.notInPlan).toBe(palette.volume.notTargeted);
    }
  });

  it("should hold six heat steps, from rested to peak", () => {
    expect(bodyMapPalette("dark").heat).toHaveLength(6);
    expect(bodyMapPalette("light").heat).toHaveLength(6);
  });
});
