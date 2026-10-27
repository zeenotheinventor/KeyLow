import resolveConfig from "tailwindcss/resolveConfig";
import { describe, expect, it } from "vitest";

import { controlHeight, preset, pressScale, pressScaleRow, touchTarget } from "../src";
import { renderCss, warmUpTailwindBeforeAll } from "./support/renderCss";

warmUpTailwindBeforeAll();

describe("preset", () => {
  it("should extend the theme only, so Tailwind's own theme is kept", () => {
    expect(Object.keys(preset)).toEqual(["theme"]);
    expect(Object.keys(preset.theme ?? {})).toEqual(["extend"]);
  });

  it("should extend exactly the design's scales", () => {
    expect(Object.keys(preset.theme?.extend ?? {}).sort()).toEqual([
      "borderRadius",
      "boxShadow",
      "colors",
      "fontFamily",
      "fontSize",
      "height",
      "minHeight",
      "minWidth",
      "scale",
      "spacing",
      "transitionDuration",
      "transitionTimingFunction",
      "width",
    ]);
  });
});

describe("preset as consumed by Tailwind", () => {
  const resolvedTheme = resolveConfig({ content: [], presets: [preset] }).theme;
  const valueOf = (scale: object, name: string): unknown =>
    Object.entries(scale).find(([key]) => key === name)?.[1];

  it("should keep Tailwind's own theme values alongside the extension", () => {
    expect(resolvedTheme.screens.md).toBe("768px");
  });

  it("should resolve a solid colour through a theme variable that accepts an opacity", () => {
    expect(resolvedTheme.colors).toMatchObject({
      accent: { DEFAULT: "rgb(var(--kl-accent) / <alpha-value>)" },
    });
  });

  it("should resolve a translucent colour through its whole variable", () => {
    expect(resolvedTheme.colors).toMatchObject({
      accent: { muted: "var(--kl-accent-muted)" },
    });
  });

  it("should let an app's own accent colours win key by key, as an app's own colour block does", () => {
    const appTheme = resolveConfig({
      content: [],
      presets: [preset],
      theme: { extend: { colors: { accent: { DEFAULT: "red", foreground: "blue" } } } },
    }).theme;

    expect(appTheme.colors).toMatchObject({
      accent: { DEFAULT: "red", foreground: "blue", muted: "var(--kl-accent-muted)" },
    });
  });

  it("should resolve the ink colours as nested shades, so the classes read text-accent-ink, text-warning-ink and text-success-ink", () => {
    expect(resolvedTheme.colors).toMatchObject({
      accent: { ink: "rgb(var(--kl-accent-ink) / <alpha-value>)" },
      warning: { ink: "rgb(var(--kl-warning-ink) / <alpha-value>)" },
      success: { ink: "rgb(var(--kl-success-ink) / <alpha-value>)" },
      camera: "rgb(var(--kl-camera) / <alpha-value>)",
      "viewfinder-dim": "var(--kl-viewfinder-dim)",
    });
  });

  it("should resolve the body map colours through theme variables, the glow whole", () => {
    expect(resolvedTheme.colors).toMatchObject({
      "heat-3": "rgb(var(--kl-heat-3) / <alpha-value>)",
      "heat-glow": "var(--kl-heat-glow)",
      "volume-not-trained": "rgb(var(--kl-volume-not-trained) / <alpha-value>)",
      "gap-on-plan": "rgb(var(--kl-gap-on-plan) / <alpha-value>)",
      "body-silhouette": "rgb(var(--kl-body-silhouette) / <alpha-value>)",
    });
  });

  it("should resolve label-small as 14 over 20 semibold with no tracking", () => {
    expect(valueOf(resolvedTheme.fontSize, "label-small")).toEqual([
      "14px",
      { lineHeight: "20px", letterSpacing: "0", fontWeight: "600" },
    ]);
  });

  it("should resolve numeral-large as 44 over 48 semibold with the display numeral's tracking", () => {
    expect(valueOf(resolvedTheme.fontSize, "numeral-large")).toEqual([
      "44px",
      { lineHeight: "48px", letterSpacing: "-0.03em", fontWeight: "600" },
    ]);
  });

  it("should resolve the design's spacing, radius, type and shadows", () => {
    expect(resolvedTheme.spacing["4"]).toBe("16px");
    expect(valueOf(resolvedTheme.borderRadius, "medium")).toBe("12px");
    expect(valueOf(resolvedTheme.fontSize, "h1")).toEqual([
      "28px",
      { lineHeight: "34px", letterSpacing: "-0.02em", fontWeight: "600" },
    ]);
    expect(valueOf(resolvedTheme.boxShadow, "card")).toBe("var(--kl-elevation-card)");
    expect(valueOf(resolvedTheme.transitionDuration, "quick")).toBe("160ms");
    expect(valueOf(resolvedTheme.transitionTimingFunction, "whip")).toBe(
      "cubic-bezier(0.05,0.9,0.15,1)",
    );
  });
});

describe("the classes the design's screens are written with", () => {
  const classNames = [
    "bg-surface",
    "text-text-muted",
    "border-border",
    "bg-accent",
    "bg-accent/20",
    "bg-accent-muted",
    "rounded-medium",
    "text-h1",
    "shadow-card",
    "text-label-small",
    "text-numeral-large",
    "text-accent-ink",
    "text-warning-ink",
    "text-success-ink",
    "bg-camera",
    "bg-viewfinder-dim",
    "bg-body-silhouette",
    "bg-body-separator",
    "bg-body-skin",
    "bg-body-core",
    "bg-body-clay",
    "bg-body-other-muscle",
    "bg-heat-0",
    "bg-heat-3",
    "bg-heat-5",
    "bg-heat-glow",
    "bg-volume-not-trained",
    "bg-volume-maintaining",
    "bg-volume-growing",
    "bg-volume-productive",
    "bg-volume-high",
    "bg-gap-behind",
    "bg-gap-on-plan",
    "bg-gap-ahead",
  ];

  it.each(classNames)("should generate %s", async (className) => {
    const css = await renderCss({ presets: [preset] }, [className]);

    expect(css).toContain(`.${className.replace("/", "\\/")}`);
  });

  it("should follow the theme and the opacity modifier through the variable", async () => {
    const css = await renderCss({ presets: [preset] }, ["bg-accent/20", "bg-accent-muted"]);

    expect(css).toContain("background-color: rgb(var(--kl-accent) / 0.2)");
    expect(css).toContain("background-color: var(--kl-accent-muted)");
  });

  it("should follow the theme through the heat variables, the glow whole", async () => {
    const css = await renderCss({ presets: [preset] }, ["bg-heat-3/20", "bg-heat-glow"]);

    expect(css).toContain("background-color: rgb(var(--kl-heat-3) / 0.2)");
    expect(css).toContain("background-color: var(--kl-heat-glow)");
  });

  it("should not support an opacity modifier on a translucent colour", async () => {
    const css = await renderCss({ presets: [preset] }, ["bg-accent-muted/50"]);

    expect(css).not.toContain("accent-muted");
  });

  it("should not serve the placeholder scales the first design was drawn with", async () => {
    // Assembled from parts, so the repository holds no copy of the retired prefix.
    const retiredClasses = [
      ["bg", "legacy", "brand", "600"].join("-"),
      ["text", "legacy", "neutral", "900"].join("-"),
    ];

    expect(await renderCss({ presets: [preset] }, retiredClasses)).toBe("");
  });
});

describe("the control sizes and the press scale", () => {
  const resolvedTheme = resolveConfig({ content: [], presets: [preset] }).theme;
  const valueOf = (scale: object, name: string): unknown =>
    Object.entries(scale).find(([key]) => key === name)?.[1];

  const controlSizeClasses = [
    { name: "control-sm", pixels: controlHeight.sm },
    { name: "control-md", pixels: controlHeight.md },
    { name: "control-lg", pixels: controlHeight.lg },
    { name: "touch-target", pixels: touchTarget },
  ];

  it("should resolve each size from the tokens on height, width, min-height and min-width", () => {
    for (const { name, pixels } of controlSizeClasses) {
      expect(valueOf(resolvedTheme.height, name)).toBe(`${pixels}px`);
      expect(valueOf(resolvedTheme.width, name)).toBe(`${pixels}px`);
      expect(valueOf(resolvedTheme.minHeight, name)).toBe(`${pixels}px`);
      expect(valueOf(resolvedTheme.minWidth, name)).toBe(`${pixels}px`);
    }
  });

  it("should resolve the press scale from the token", () => {
    expect(valueOf(resolvedTheme.scale, "press")).toBe(String(pressScale));
  });

  it("should resolve the list row press scale from the token", () => {
    expect(valueOf(resolvedTheme.scale, "press-row")).toBe(String(pressScaleRow));
    expect(pressScaleRow).toBe(0.985);
  });

  it("should keep Tailwind's own height, width and scale values", () => {
    expect(valueOf(resolvedTheme.height, "full")).toBe("100%");
    expect(valueOf(resolvedTheme.minWidth, "0")).toBe("0px");
    expect(valueOf(resolvedTheme.scale, "95")).toBe(".95");
  });

  describe.each(controlSizeClasses)("$name", ({ name, pixels }) => {
    it.each([
      ["h", "height"],
      ["w", "width"],
      ["min-h", "min-height"],
      ["min-w", "min-width"],
    ])("should generate %s-%s as the token's size", async (prefix, property) => {
      const css = await renderCss({ presets: [preset] }, [`${prefix}-${name}`]);

      expect(css).toContain(`.${prefix}-${name}`);
      expect(css).toContain(`${property}: ${pixels}px`);
    });
  });

  it("should generate the press scale as a utility that works under a state variant", async () => {
    const css = await renderCss({ presets: [preset] }, ["scale-press", "active:scale-press"]);

    expect(css).toContain(".scale-press");
    expect(css).toContain(".active\\:scale-press:active");
    expect(css).toContain(`--tw-scale-x: ${pressScale}`);
    expect(css).toContain(`--tw-scale-y: ${pressScale}`);
  });

  it("should generate the list row press scale under a state variant", async () => {
    const css = await renderCss({ presets: [preset] }, ["active:scale-press-row"]);

    expect(css).toContain(".active\\:scale-press-row:active");
    expect(css).toContain("--tw-scale-x: 0.985");
    expect(css).toContain("--tw-scale-y: 0.985");
  });
});
