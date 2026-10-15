import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { buildTokenCss } from "../scripts/buildTokenCss";
import { parseCssScopes } from "../scripts/parseCss";
import { customPropertiesUnder, readSourceTexts, readTokenJson } from "./support/sources";

const committedCss = readFileSync(
  fileURLToPath(new URL("../css/kilo-tokens.css", import.meta.url)),
  "utf8",
);
const committedScopes = parseCssScopes(committedCss);

const reducedMotionScope = "@media (prefers-reduced-motion: reduce) :root";

const customProperties = (
  declarations: Record<string, string> | undefined,
): Record<string, string> =>
  Object.fromEntries(
    Object.entries(declarations ?? {})
      .filter(([property]) => property.startsWith("--"))
      .map(([property, value]) => [property.slice(2), value]),
  );

describe("kilo-tokens.css", () => {
  it("should be exactly what the sources build, so a source edit shows up until it is regenerated", () => {
    expect(committedCss).toBe(buildTokenCss(readSourceTexts()));
  });

  it("should hold every dark token on :root with the design's name and value, and nothing else", () => {
    expect(customProperties(committedScopes[":root"])).toEqual(readTokenJson().dark);
  });

  it("should hold every light token under the light data attribute, and nothing else", () => {
    expect(customProperties(committedScopes['[data-theme="light"]'])).toEqual(
      readTokenJson().light,
    );
  });

  it("should set color-scheme for each theme", () => {
    expect(committedScopes[":root"]?.["color-scheme"]).toBe("dark");
    expect(committedScopes['[data-theme="light"]']?.["color-scheme"]).toBe("light");
  });

  it("should hold what reduced motion collapses under the media query", () => {
    expect(customProperties(committedScopes[reducedMotionScope])).toEqual(
      customPropertiesUnder("@media (prefers-reduced-motion:reduce) :root"),
    );
  });

  it("should hold the ink, camera, label-small, numeral-large and row press tokens with the design's literal values", () => {
    expect(committedScopes[":root"]).toMatchObject({
      "--accent-ink": "#CCF249",
      "--warning-ink": "#FF9F43",
      "--success-ink": "#5CD67A",
      "--camera": "#07090D",
      "--viewfinder-dim": "rgba(0,0,0,0.35)",
      "--type-label-small-size": "14px",
      "--type-label-small-line": "20px",
      "--type-label-small-weight": "600",
      "--type-label-small-tracking": "0",
      "--press-scale-row": "0.985",
      "--type-numeral-large-size": "44px",
      "--type-numeral-large-line": "48px",
      "--type-numeral-large-weight": "600",
      "--type-numeral-large-tracking": "-0.03em",
    });
    expect(committedScopes['[data-theme="light"]']).toMatchObject({
      "--accent-ink": "#0F131A",
      "--warning-ink": "#0F131A",
      "--success-ink": "#126D31",
      "--camera": "#07090D",
      "--viewfinder-dim": "rgba(0,0,0,0.35)",
    });
    expect(committedScopes[reducedMotionScope]).toMatchObject({ "--press-scale-row": "1" });
  });

  it("should keep the names the design system uses, such as --surface, --space-4 and --type-h2-size", () => {
    expect(committedScopes[":root"]).toMatchObject({
      "--surface": "#141821",
      "--space-4": "16px",
      "--type-h2-size": "20px",
    });
  });
});
