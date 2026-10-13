import resolveConfig from "tailwindcss/resolveConfig";
import { describe, expect, it } from "vitest";

import { preset } from "../src";
import { renderCss } from "./support/renderCss";

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
      "spacing",
      "transitionDuration",
      "transitionTimingFunction",
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
    "bg-legacy-brand-600",
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

  it("should not support an opacity modifier on a translucent colour", async () => {
    const css = await renderCss({ presets: [preset] }, ["bg-accent-muted/50"]);

    expect(css).not.toContain("accent-muted");
  });

  it("should read the legacy scales as plain colours so the old screens look the same", async () => {
    const css = await renderCss({ presets: [preset] }, [
      "bg-legacy-brand-600",
      "text-legacy-neutral-900",
    ]);

    expect(css).toContain("background-color: rgb(37 99 235");
    expect(css).toContain("color: rgb(23 23 23");
  });
});
