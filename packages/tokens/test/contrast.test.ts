import { describe, expect, it } from "vitest";

import { contrastRatio } from "./support/contrast";
import { blendOver } from "./support/contrastRatio";
import { readTokenJson, trainingTokens } from "./support/sources";

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

// A filled success toast draws its words and icon on the success colour itself. The status ink
// (`text-on-status`) is white in light, which is 3.51:1 on the light success green, so the fill has its own.
describe("the ink on a success fill", () => {
  it.each(["dark", "light"] as const)(
    "should read at 4.5:1 or more on the success colour in the %s theme",
    (scheme) => {
      const theme = readTokenJson()[scheme];

      expect(
        contrastRatio(theme["text-on-success"] ?? "", theme.success ?? ""),
      ).toBeGreaterThanOrEqual(4.5);
    },
  );
});

// The body map figure sits on a card, so its colours are read against `surface`. Zee approved the
// canvas (KEY-339) with the claim that the figure colours that carry a status read at 3:1 or more. The
// heat scale is now grey, then green to red (KEY-515): heat-1 to heat-5 all carry a status and hold the
// threshold in both themes. The other body map colours are meant to recede (the silhouette, rested heat,
// not targeted, on plan), so they have no threshold. KEY-515 darkened light heat-2 and heat-3 to keep it.
const bodyMapColoursAtThreeToOne = [
  "heat-1",
  "heat-2",
  "heat-3",
  "heat-4",
  "heat-5",
  "volume-under",
  "volume-productive",
  "volume-over",
  "gap-behind",
  "gap-ahead",
] as const;

const bodyMapRatioOnSurface = (scheme: "dark" | "light", name: string): number => {
  const surface = readTokenJson()[scheme].surface ?? "";
  const colour = trainingTokens(scheme)[name] ?? "";
  // The glow is translucent, so it is read as it looks once drawn over the card.
  const drawn = colour.startsWith("rgba(") ? blendOver(colour, surface) : colour;
  return roundedRatio(drawn, surface);
};

describe("body map colour contrast on the surface", () => {
  it.each(["dark", "light"] as const)(
    "should read at 3:1 or more for the figure colours that carry a status in the %s theme",
    (scheme) => {
      for (const name of bodyMapColoursAtThreeToOne) {
        expect(bodyMapRatioOnSurface(scheme, name), name).toBeGreaterThanOrEqual(3);
      }
    },
  );

  it.each(["dark", "light"] as const)(
    "should record the ratio of every body map colour in the %s theme, with no threshold for the rest",
    (scheme) => {
      const ratios = Object.fromEntries(
        Object.keys(trainingTokens(scheme)).map((name) => [
          name,
          bodyMapRatioOnSurface(scheme, name),
        ]),
      );

      expect(ratios).toMatchSnapshot();
    },
  );
});
