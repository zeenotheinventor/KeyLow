import { describe, expect, it } from "vitest";

import { buildTokens } from "../scripts/buildTokens";
import * as generated from "../src/source.generated";
import { flattenTokens } from "./support/flattenTokens";
import { customPropertiesUnder, readSourceTexts, readTokenJson } from "./support/sources";

describe("the design system sources", () => {
  const tokenJson = readTokenJson();

  it("should agree between the JSON and the CSS for the dark theme", () => {
    expect(customPropertiesUnder(":root")).toEqual(tokenJson.dark);
  });

  it("should agree between the JSON and the CSS for the light theme", () => {
    expect(customPropertiesUnder('[data-theme="light"]')).toEqual(tokenJson.light);
  });
});

describe("the generated module", () => {
  it("should be exactly what the sources build, so a source edit shows up until it is regenerated", () => {
    expect({ ...generated }).toEqual(buildTokens(readSourceTexts()));
  });
});

describe("every design token", () => {
  const tokenJson = readTokenJson();

  it.each(["dark", "light"] as const)(
    "should come back out of the exports with its value for the %s theme",
    (scheme) => {
      expect(flattenTokens(scheme)).toEqual(tokenJson[scheme]);
    },
  );
});

describe("buildTokens", () => {
  it("should refuse a token it has no export for", () => {
    const sources = readSourceTexts();
    const json = readTokenJson();
    json.dark["mystery-size"] = "9px";

    expect(() =>
      buildTokens({
        ...sources,
        json: JSON.stringify(json),
        spacingCss: sources.spacingCss.replace(":root{", ":root{\n--mystery-size:9px;"),
      }),
    ).toThrow(/mystery-size/);
  });

  it("should refuse a JSON value that differs from the CSS", () => {
    const json = readTokenJson();
    json.dark["accent"] = "#000000";

    expect(() => buildTokens({ ...readSourceTexts(), json: JSON.stringify(json) })).toThrow(
      /accent/,
    );
  });

  it("should refuse a light theme that lacks a colour the dark theme has", () => {
    const sources = readSourceTexts();
    const json = readTokenJson();
    delete json.light["warning"];

    expect(() =>
      buildTokens({
        ...sources,
        json: JSON.stringify(json),
        colorsCss: sources.colorsCss.replace("--warning:#C76A00;", ""),
      }),
    ).toThrow(/warning/);
  });

  it("should refuse a light theme whose shadows are not the dark theme's set", () => {
    const sources = readSourceTexts();
    const json = readTokenJson();
    delete json.light["elevation-toast"];

    expect(() =>
      buildTokens({
        ...sources,
        json: JSON.stringify(json),
        spacingCss: sources.spacingCss.replace(
          "--elevation-toast:0 12px 32px -8px rgba(15,19,26,0.25);",
          "",
        ),
      }),
    ).toThrow(/elevation/);
  });
});
