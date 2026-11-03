import { describe, expect, it } from "vitest";

import { NOW, sampleSnapshot } from "./sampleSnapshot";
import { buildBodyFigureSvg, buildCalorieRingSvg, widgetViewModel } from "../../src/widgets";

import type { WidgetPalette } from "../../src/widgets";

// Each role is its own name, so a test can see which role a shape was filled with.
const palette: WidgetPalette = {
  text: "role-text",
  textMuted: "role-textMuted",
  textSubtle: "role-textSubtle",
  accent: "role-accent",
  onAccent: "role-onAccent",
  track: "role-track",
  silhouette: "role-silhouette",
  success: "role-success",
  warning: "role-warning",
  danger: "role-danger",
  "heat-0": "role-heat-0",
  "heat-1": "role-heat-1",
  "heat-2": "role-heat-2",
  "heat-3": "role-heat-3",
  "heat-4": "role-heat-4",
  "heat-5": "role-heat-5",
  "volume-not-trained": "role-volume-not-trained",
  "volume-maintaining": "role-volume-maintaining",
  "volume-growing": "role-volume-growing",
  "volume-productive": "role-volume-productive",
  "volume-high": "role-volume-high",
  "gap-behind": "role-gap-behind",
  "gap-on-plan": "role-gap-on-plan",
  "gap-ahead": "role-gap-ahead",
  "role-primary": "role-role-primary",
  "role-secondary": "role-role-secondary",
  "role-assist": "role-role-assist",
};

const ringOf = () => {
  const model = widgetViewModel({ status: "ready", snapshot: sampleSnapshot() }, "today_ring", NOW);
  if (model.kind !== "today_ring" || model.state !== "ready") {
    throw new Error("expected the ready ring");
  }
  return model.ring;
};

const bodyMapOf = () => {
  const model = widgetViewModel({ status: "ready", snapshot: sampleSnapshot() }, "body_map", NOW);
  if (model.kind !== "body_map" || model.state !== "ready") {
    throw new Error("expected the ready body map");
  }
  return model.figure;
};

describe("buildCalorieRingSvg", () => {
  it("should draw the board's regular ring: radius 46, stroke 11, 740 and kcal left", () => {
    const svg = buildCalorieRingSvg({ ring: ringOf(), size: "regular", palette });

    expect(svg).toContain('viewBox="0 0 112 112"');
    expect(svg).toContain('r="46"');
    expect(svg).toContain('stroke-width="11"');
    expect(svg).toContain('stroke="role-track"');
    expect(svg).toContain('stroke="role-accent"');
    expect(svg).toContain(">740</text>");
    expect(svg).toContain(">kcal left</text>");
    expect(svg).toContain('aria-label="1,460 of 2,200 kcal eaten"');
  });

  it("should fill the arc by the fraction of the circle", () => {
    const svg = buildCalorieRingSvg({ ring: ringOf(), size: "regular", palette });

    expect(svg).toContain('stroke-dasharray="191.8 289.0"');
    expect(svg).toContain('transform="rotate(-90 56 56)"');
  });

  it("should draw the compact ring of the small widget: radius 38, stroke 9", () => {
    const svg = buildCalorieRingSvg({ ring: ringOf(), size: "compact", palette });

    expect(svg).toContain('viewBox="0 0 92 92"');
    expect(svg).toContain('r="38"');
    expect(svg).toContain('stroke-dasharray="158.5 238.8"');
  });

  it("should draw no arc for an empty ring", () => {
    const svg = buildCalorieRingSvg({
      ring: { ...ringOf(), fraction: 0 },
      size: "regular",
      palette,
    });

    expect(svg).not.toContain("stroke-dasharray");
  });

  it("should use the dimmed role the view model names", () => {
    const svg = buildCalorieRingSvg({
      ring: { ...ringOf(), fillRole: "textSubtle" },
      size: "regular",
      palette,
    });

    expect(svg).toContain('stroke="role-textSubtle"');
  });
});

describe("escaping in the ring", () => {
  it("should escape a quote in the accessible name", () => {
    const svg = buildCalorieRingSvg({
      ring: { ...ringOf(), accessibleName: 'say "hi" & <go>' },
      size: "regular",
      palette,
    });

    expect(svg).toContain('aria-label="say &quot;hi&quot; &amp; &lt;go&gt;"');
  });
});

describe("buildBodyFigureSvg", () => {
  it("should draw the head and outline in the silhouette colour", () => {
    const svg = buildBodyFigureSvg({ figure: bodyMapOf(), side: "front", palette, height: 140 });

    expect(svg).toContain('width="47" height="140" viewBox="28 4 144 432"');
    expect(svg.match(/fill="role-silhouette"/g)).toHaveLength(2);
  });

  it("should fill each muscle of the side with its tone's colour", () => {
    const svg = buildBodyFigureSvg({ figure: bodyMapOf(), side: "front", palette, height: 140 });

    expect(svg.match(/<path /g)).toHaveLength(2 + 12);
    expect(svg).toContain('fill="role-heat-3"');
    expect(svg).toContain('fill="role-heat-0"');
  });

  it("should draw the back with its own ten muscles", () => {
    const svg = buildBodyFigureSvg({ figure: bodyMapOf(), side: "back", palette, height: 140 });

    expect(svg.match(/<path /g)).toHaveLength(2 + 10);
  });

  it("should draw the female artwork when that is the figure", () => {
    const male = buildBodyFigureSvg({ figure: bodyMapOf(), side: "front", palette, height: 140 });
    const female = buildBodyFigureSvg({
      figure: { ...bodyMapOf(), figure: "female" },
      side: "front",
      palette,
      height: 140,
    });

    expect(female).not.toBe(male);
  });
});
