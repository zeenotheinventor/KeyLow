import { describe, expect, it } from "vitest";

import { colors, elevation, lightColors, themePlugin, themes, themeVariables } from "../src";
import { isSolidColor } from "../src/theme";
import { renderCss } from "./support/renderCss";
import { customPropertiesUnder } from "./support/sources";

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

describe("themeVariables", () => {
  const tokenValueFor = (scheme: "dark" | "light") =>
    customPropertiesUnder(scheme === "dark" ? ":root" : '[data-theme="light"]');

  it.each(["dark", "light"] as const)(
    "should round-trip every %s theme colour and shadow to the design's value",
    (scheme) => {
      const variables = themeVariables(scheme);
      const expected = tokenValueFor(scheme);

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
