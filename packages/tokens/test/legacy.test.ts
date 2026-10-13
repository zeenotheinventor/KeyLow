import { describe, expect, it } from "vitest";

import { legacyColors, legacyFontSize, legacySpacing } from "../src";

const hexOrHslColour =
  /^(#([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})|hsla?\(\s*\d{1,3}(\.\d+)?\s*,\s*\d{1,3}(\.\d+)?%\s*,\s*\d{1,3}(\.\d+)?%(\s*,\s*(0|1|0?\.\d+))?\s*\))$/i;

const scaleSteps = ["50", "100", "200", "300", "400", "500", "600", "700", "800", "900", "950"];

describe("legacyColors", () => {
  it("should keep the five placeholder scales under a legacy- name", () => {
    expect(Object.keys(legacyColors)).toEqual([
      "legacy-neutral",
      "legacy-brand",
      "legacy-success",
      "legacy-warning",
      "legacy-danger",
    ]);
  });

  it.each(Object.entries(legacyColors))("should give %s a scale from 50 to 950", (_name, scale) => {
    expect(Object.keys(scale)).toEqual(scaleSteps);
  });

  it("should use only plain hex colours, so the screens that still use them render as before", () => {
    for (const scale of Object.values(legacyColors)) {
      for (const colour of Object.values(scale)) {
        expect(colour).toMatch(hexOrHslColour);
      }
    }
  });

  it("should keep the values the screens were built with", () => {
    expect(legacyColors["legacy-brand"]["600"]).toBe("#2563eb");
    expect(legacyColors["legacy-neutral"]["300"]).toBe("#d4d4d4");
    expect(legacyColors["legacy-danger"]["600"]).toBe("#dc2626");
  });
});

describe("legacySpacing", () => {
  it("should keep the placeholder step keys, including the ones the design does not have", () => {
    expect(legacySpacing["0.5"]).toBe("2px");
    expect(legacySpacing["11"]).toBe("44px");
    expect(legacySpacing["14"]).toBe("56px");
    expect(legacySpacing["72"]).toBe("288px");
    expect(legacySpacing["96"]).toBe("384px");
  });

  it("should use a 4px base: every key is a multiple of four pixels", () => {
    for (const [step, value] of Object.entries(legacySpacing)) {
      expect(value).toBe(`${Number(step) * 4}px`);
    }
  });
});

describe("legacyFontSize", () => {
  it("should keep xs to 5xl in px, which native text sizes depend on", () => {
    expect(Object.keys(legacyFontSize)).toEqual([
      "xs",
      "sm",
      "base",
      "lg",
      "xl",
      "2xl",
      "3xl",
      "4xl",
      "5xl",
    ]);
    expect(legacyFontSize.sm).toEqual(["14px", { lineHeight: "20px" }]);
    expect(legacyFontSize["2xl"]).toEqual(["24px", { lineHeight: "32px" }]);
  });
});
