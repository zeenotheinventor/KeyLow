import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { buildTokenCss } from "../scripts/buildTokenCss";
import { parseCssScopes } from "../scripts/parseCss";
import {
  customPropertiesUnder,
  readSourceTexts,
  readTokenJson,
  trainingTokens,
} from "./support/sources";

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

  it("should hold every dark token on :root with the design's name and value, beside the training additions, and nothing else", () => {
    expect(customProperties(committedScopes[":root"])).toEqual({
      ...readTokenJson().dark,
      ...trainingTokens("dark"),
    });
  });

  it("should hold every light token under the light data attribute, beside the training additions, and nothing else", () => {
    expect(customProperties(committedScopes['[data-theme="light"]'])).toEqual({
      ...readTokenJson().light,
      ...trainingTokens("light"),
    });
  });

  // The canvas's values (the v3 "tokens · body-map-scales" board of the Ki-Lo training screens canvas, KEY-515), written out here.
  it("should hold the body map tokens with the canvas's literal dark values on :root", () => {
    expect(committedScopes[":root"]).toMatchObject({
      "--body-silhouette": "#262D3A",
      "--body-separator": "#141821",
      "--body-skin": "#8FA6C8",
      "--body-core": "#1E2430",
      "--body-clay": "#B3A79B",
      "--body-other-muscle": "#262D3A",
      "--heat-0": "#3A4355",
      "--heat-1": "#3FA463",
      "--heat-2": "#C8C13A",
      "--heat-3": "#E5A13A",
      "--heat-4": "#EE6E36",
      "--heat-5": "#F04848",
      "--heat-glow": "rgba(240,72,72,0.55)",
      "--volume-not-trained": "#303746",
      "--volume-maintaining": "#2F81F7",
      "--volume-growing": "#3FB950",
      "--volume-productive": "#E8C547",
      "--volume-high": "#F04848",
      "--gap-behind": "#5B95FF",
      "--gap-on-plan": "#596274",
      "--gap-ahead": "#FF9F43",
      "--role-primary": "#CCF249",
      "--role-secondary": "#8FA83A",
      "--role-assist": "#66783A",
    });
  });

  it("should hold the body map tokens with the canvas's literal light values under the light data attribute", () => {
    expect(committedScopes['[data-theme="light"]']).toMatchObject({
      "--body-silhouette": "#E2E6EC",
      "--body-separator": "#F7F8FA",
      "--body-skin": "#6F829F",
      "--body-core": "#848FA4",
      "--body-clay": "#CDBFB0",
      "--body-other-muscle": "#E2E6EC",
      "--heat-0": "#C9CED8",
      "--heat-1": "#2F8F4E",
      "--heat-2": "#9E8E19",
      "--heat-3": "#BE7E19",
      "--heat-4": "#CF5A26",
      "--heat-5": "#C9313A",
      "--heat-glow": "rgba(201,49,58,0.35)",
      "--volume-not-trained": "#D7DBE2",
      "--volume-maintaining": "#1F5BD6",
      "--volume-growing": "#2F8F4E",
      "--volume-productive": "#A67C00",
      "--volume-high": "#C9313A",
      "--gap-behind": "#1F5BD6",
      "--gap-on-plan": "#B4BAC6",
      "--gap-ahead": "#B35C00",
      "--role-primary": "#4D7300",
      "--role-secondary": "#76A01A",
      "--role-assist": "#B9D67A",
    });
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
