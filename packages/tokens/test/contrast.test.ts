import { describe, expect, it } from "vitest";

import { contrastRatio } from "./support/contrast";
import { readTokenJson } from "./support/sources";

describe("contrastRatio", () => {
  it("should be 21 for black on white and 1 for a colour on itself", () => {
    expect(contrastRatio("#000000", "#FFFFFF")).toBeCloseTo(21, 5);
    expect(contrastRatio("#7FAE00", "#7FAE00")).toBeCloseTo(1, 5);
  });

  it("should not depend on which colour is the foreground", () => {
    expect(contrastRatio("#0B0E13", "#CCF249")).toBe(contrastRatio("#CCF249", "#0B0E13"));
  });

  it("should match the published WCAG value for #777777 on white", () => {
    expect(contrastRatio("#777777", "#FFFFFF")).toBeCloseTo(4.48, 2);
  });
});

const foregrounds = [
  "text-primary",
  "text-secondary",
  "text-muted",
  "accent",
  "success",
  "warning",
  "danger",
  "protein",
  "carbs",
  "fat",
  "calories",
] as const;

const backgrounds = ["background", "surface", "surface-raised"] as const;

const roundedRatio = (foreground: string, background: string): number =>
  Number(contrastRatio(foreground, background).toFixed(2));

/**
 * Records the ratios. It asserts no threshold: Zee accepted the light colours as they are (Q14), so a
 * design edit that moves a number shows up as a snapshot diff to regenerate and note in the PR.
 */
describe("recorded contrast ratios", () => {
  const tokenJson = readTokenJson();

  it.each(["dark", "light"] as const)(
    "should record every text, accent, status and macro colour on each surface in the %s theme",
    (scheme) => {
      const theme = tokenJson[scheme];
      const ratios = Object.fromEntries(
        foregrounds.map((foreground) => [
          foreground,
          Object.fromEntries(
            backgrounds.map((background) => [
              background,
              roundedRatio(theme[foreground] ?? "", theme[background] ?? ""),
            ]),
          ),
        ]),
      );

      expect(ratios).toMatchSnapshot();
    },
  );
});
