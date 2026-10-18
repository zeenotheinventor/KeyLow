import { describe, expect, it } from "vitest";

import { colors, elevation, lightColors, themePlugin, themes, themeVariables } from "../src";
import { isSolidColor } from "../src/theme";
import { blendOver, contrastRatio } from "./support/contrastRatio";
import { renderCss, warmUpTailwindBeforeAll } from "./support/renderCss";
import { customPropertiesUnder, trainingTokens } from "./support/sources";

warmUpTailwindBeforeAll();

const channelsToHex = (channels: string): string => {
  const hex = channels
    .split(" ")
    .map((channel) => Number(channel).toString(16).padStart(2, "0"))
    .join("");
  return `#${hex.toUpperCase()}`;
};

const isChannels = (value: string): boolean => /^\d{1,3} \d{1,3} \d{1,3}$/.test(value);

describe("themes", () => {
  it("should hold the dark colours as the default and the light colours as the alternative", () => {
    expect(themes.dark).toBe(colors);
    expect(themes.light).toBe(lightColors);
  });

  it("should hold the training additions beside the design's colours in both themes", () => {
    expect(colors["heat-3"]).toBe("#C98B2E");
    expect(lightColors["heat-3"]).toBe("#CC7A22");
    expect(colors["gap-on-plan"]).toBe("#596274");
    expect(lightColors["gap-on-plan"]).toBe("#B4BAC6");
  });

  it("should give both themes the same colour names, in the same order", () => {
    expect(Object.keys(lightColors)).toEqual(Object.keys(colors));
  });

  it("should keep each colour solid in both themes or translucent in both, so one variable format fits", () => {
    for (const name of Object.keys(colors) as (keyof typeof colors)[]) {
      expect(isSolidColor(lightColors[name]), name).toBe(isSolidColor(colors[name]));
    }
  });

  it("should keep the design's names, such as text-primary and surface-raised", () => {
    expect(colors["text-primary"]).toBe("#F2F4F8");
    expect(colors["surface-raised"]).toBe("#1C212C");
    expect(lightColors["focus-ring"]).toBe("#2F6BEA");
  });
});

describe("the ink and camera colours", () => {
  it("should turn the accent ink and warning ink to the primary text colour in light, where coloured small text is not used", () => {
    expect(colors["accent-ink"]).toBe("#CCF249");
    expect(lightColors["accent-ink"]).toBe("#0F131A");
    expect(colors["warning-ink"]).toBe("#FF9F43");
    expect(lightColors["warning-ink"]).toBe("#0F131A");
    expect(lightColors["accent-ink"]).toBe(lightColors["text-primary"]);
    expect(lightColors["warning-ink"]).toBe(lightColors["text-primary"]);
  });

  it("should make the success ink the success colour in dark and a darker green in light", () => {
    expect(colors["success-ink"]).toBe("#5CD67A");
    expect(colors["success-ink"]).toBe(colors.success);
    expect(lightColors["success-ink"]).toBe("#126D31");
    expect(lightColors["success-ink"]).not.toBe(lightColors.success);
  });

  it.each([
    ["dark", colors],
    ["light", lightColors],
  ] as const)(
    "should read as text on the surface and the background in %s, at 4.5:1 or more",
    (_scheme, palette) => {
      expect(contrastRatio(palette["success-ink"], palette.surface)).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(palette["success-ink"], palette.background)).toBeGreaterThanOrEqual(4.5);
    },
  );

  // The badge and the chip draw their words on `success-muted`, not on the bare surface.
  it.each([
    ["background", lightColors.background],
    ["surface", lightColors.surface],
    ["raised white", lightColors["surface-raised"]],
  ])("should read on the light success tint over the %s at 4.5:1 or more", (_name, surface) => {
    const tint = blendOver(lightColors["success-muted"], surface);

    expect(contrastRatio(lightColors["success-ink"], tint)).toBeGreaterThanOrEqual(4.5);
  });

  it("should keep the camera surface and the viewfinder dim the same in both themes", () => {
    for (const palette of [colors, lightColors]) {
      expect(palette.camera).toBe("#07090D");
      expect(palette["viewfinder-dim"]).toBe("rgba(0,0,0,0.35)");
    }
  });

  it("should emit them as theme variables, solid ones as channels and the dim whole", () => {
    expect(themeVariables("dark")["--kl-accent-ink"]).toBe("204 242 73");
    expect(themeVariables("light")["--kl-accent-ink"]).toBe("15 19 26");
    expect(themeVariables("dark")["--kl-warning-ink"]).toBe("255 159 67");
    expect(themeVariables("light")["--kl-warning-ink"]).toBe("15 19 26");
    expect(themeVariables("dark")["--kl-success-ink"]).toBe("92 214 122");
    expect(themeVariables("light")["--kl-success-ink"]).toBe("18 109 49");
    expect(themeVariables("light")["--kl-camera"]).toBe("7 9 13");
    expect(themeVariables("light")["--kl-viewfinder-dim"]).toBe("rgba(0,0,0,0.35)");
  });
});

describe("the training additions as theme variables", () => {
  it("should emit a solid one as channels and the glow whole, in each theme", () => {
    expect(themeVariables("dark")["--kl-heat-3"]).toBe("201 139 46");
    expect(themeVariables("light")["--kl-heat-3"]).toBe("204 122 34");
    expect(themeVariables("dark")["--kl-heat-glow"]).toBe("rgba(255,122,107,0.55)");
    expect(themeVariables("light")["--kl-heat-glow"]).toBe("rgba(168,35,29,0.35)");
    expect(themeVariables("dark")["--kl-volume-not-targeted"]).toBe("48 55 70");
    expect(themeVariables("light")["--kl-gap-ahead"]).toBe("179 92 0");
  });
});

describe("themeVariables", () => {
  const tokenValueFor = (scheme: "dark" | "light") =>
    customPropertiesUnder(scheme === "dark" ? ":root" : '[data-theme="light"]');

  it.each(["dark", "light"] as const)(
    "should round-trip every %s theme colour and shadow to the design's value",
    (scheme) => {
      const variables = themeVariables(scheme);
      const expected = { ...tokenValueFor(scheme), ...trainingTokens(scheme) };

      for (const [name, value] of Object.entries(variables)) {
        const token = name.replace(/^--kl-/, "");
        const roundTripped = isChannels(value) ? channelsToHex(value) : value;
        expect(roundTripped, name).toBe(expected[token]);
      }
    },
  );

  it.each(["dark", "light"] as const)(
    "should emit a variable for each colour and shadow of the %s theme and for nothing else",
    (scheme) => {
      const themeColors = themes[scheme];
      const expectedNames = [
        ...Object.keys(themeColors),
        ...Object.keys(elevation[scheme]).map((name) => `elevation-${name}`),
      ].map((name) => `--kl-${name}`);

      expect(Object.keys(themeVariables(scheme)).sort()).toEqual(expectedNames.sort());
    },
  );

  it("should write a solid colour as space separated channels so an opacity modifier can use it", () => {
    expect(themeVariables("dark")["--kl-accent"]).toBe("204 242 73");
    expect(themeVariables("light")["--kl-accent"]).toBe("127 174 0");
  });

  it("should keep a translucent colour as the whole rgba value, which carries its own alpha", () => {
    expect(themeVariables("dark")["--kl-accent-muted"]).toBe("rgba(204,242,73,0.14)");
    expect(themeVariables("light")["--kl-overlay"]).toBe("rgba(15,19,26,0.45)");
  });

  it("should switch the shadows with the theme", () => {
    expect(themeVariables("dark")["--kl-elevation-card"]).toBe(elevation.dark.card);
    expect(themeVariables("light")["--kl-elevation-card"]).toBe(elevation.light.card);
    expect(elevation.light.card).not.toBe(elevation.dark.card);
  });
});

describe("themePlugin", () => {
  const renderBase = () =>
    renderCss({ plugins: [themePlugin], corePlugins: { preflight: false } }, [], "@tailwind base;");

  it("should emit the dark variables on :root", async () => {
    const css = await renderBase();

    expect(css).toMatch(/:root\s*\{[^}]*--kl-accent: 204 242 73;[^}]*color-scheme: dark/);
  });

  it("should emit the light variables under the light data attribute", async () => {
    const css = await renderBase();

    expect(css).toMatch(
      /\[data-theme="light"\]\s*\{[^}]*--kl-accent: 127 174 0;[^}]*color-scheme: light/,
    );
  });

  it("should emit the translucent colours whole, so they work as a plain var()", async () => {
    const css = await renderBase();

    expect(css).toContain("--kl-accent-muted: rgba(204,242,73,0.14);");
  });
});
