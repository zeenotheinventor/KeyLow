import { colors, lightColors } from "@keylow/tokens";

import { widgetThemeFor } from "./theme";

const COLOUR_FORMAT = /^(#[0-9a-fA-F]{6}|rgba\(\d+, \d+, \d+, [\d.]+\))$/;

describe("the widget theme", () => {
  it("should map the colour roles to the dark tokens", () => {
    const { palette } = widgetThemeFor("dark");

    expect(palette.text).toBe(colors["text-primary"]);
    expect(palette.textMuted).toBe(colors["text-secondary"]);
    expect(palette.textSubtle).toBe(colors["text-muted"]);
    expect(palette.accent).toBe(colors.accent);
    expect(palette.onAccent).toBe(colors["text-on-accent"]);
    expect(palette.track).toBe(colors.border);
    expect(palette.silhouette).toBe(colors["body-silhouette"]);
    expect(palette["heat-5"]).toBe(colors["heat-5"]);
    expect(palette["volume-growing"]).toBe(colors["volume-growing"]);
  });

  it("should map the colour roles to the light tokens", () => {
    const { palette } = widgetThemeFor("light");

    expect(palette.text).toBe(lightColors["text-primary"]);
    expect(palette.accent).toBe(lightColors.accent);
    expect(palette.track).toBe(lightColors.border);
    expect(palette["heat-3"]).toBe(lightColors["heat-3"]);
  });

  it("should draw the card on the surface in dark and on the white raised surface in light", () => {
    expect(widgetThemeFor("dark").surface).toBe(colors.surface);
    expect(widgetThemeFor("light").surface).toBe(lightColors["surface-raised"]);
    expect(widgetThemeFor("dark").border).toBe(colors.border);
    expect(widgetThemeFor("light").border).toBe(lightColors.border);
  });

  it("should write every colour in a form the widget library reads", () => {
    for (const scheme of ["dark", "light"] as const) {
      const theme = widgetThemeFor(scheme);
      const values = [
        ...Object.values(theme.palette),
        theme.surface,
        theme.border,
        theme.buttonBackground,
        theme.successMuted,
        theme.dangerMuted,
      ];
      for (const value of values) {
        expect(value).toMatch(COLOUR_FORMAT);
      }
    }
  });

  it("should rewrite a translucent token with spaces, which is how the library reads rgba", () => {
    expect(widgetThemeFor("dark").successMuted).toBe("rgba(92, 214, 122, 0.14)");
    expect(widgetThemeFor("dark").dangerMuted).toBe("rgba(255, 92, 92, 0.14)");
  });
});
