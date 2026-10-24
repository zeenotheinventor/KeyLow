import { describe, expect, it } from "vitest";

import { bodyMapPalette } from "../src";

// The values are the Ki-Lo training canvas's (the v3 "tokens · body-map-scales" board, KEY-515, with the
// two light values the orchestrator darkened to hold 3:1), written out here and not read back from the code under test.
describe("bodyMapPalette", () => {
  it("should return the canvas's dark values", () => {
    expect(bodyMapPalette("dark")).toEqual({
      silhouette: "#262D3A",
      separator: "#141821",
      skin: "#8FA6C8",
      core: "#1E2430",
      clay: "#B3A79B",
      otherMuscle: "#262D3A",
      heat: ["#3A4355", "#3FA463", "#C8C13A", "#E5A13A", "#EE6E36", "#F04848"],
      heatGlow: "rgba(240,72,72,0.55)",
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
      skin: "#6F829F",
      core: "#848FA4",
      clay: "#CDBFB0",
      otherMuscle: "#E2E6EC",
      heat: ["#C9CED8", "#2F8F4E", "#9E8E19", "#BE7E19", "#CF5A26", "#C9313A"],
      heatGlow: "rgba(201,49,58,0.35)",
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
