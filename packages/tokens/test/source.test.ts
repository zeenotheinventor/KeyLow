import { describe, expect, it } from "vitest";

import { buildTokens } from "../scripts/buildTokens";
import * as generated from "../src/source.generated";
import { flattenTokens } from "./support/flattenTokens";
import {
  customPropertiesUnder,
  readSourceTexts,
  readTokenJson,
  trainingTokens,
} from "./support/sources";

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
    "should come back out of the exports with its value for the %s theme, beside the training additions",
    (scheme) => {
      expect(flattenTokens(scheme)).toEqual({ ...tokenJson[scheme], ...trainingTokens(scheme) });
    },
  );
});

describe("the training additions", () => {
  const expectedNames = [
    "body-silhouette",
    "body-separator",
    "body-skin",
    "body-core",
    "body-clay",
    "body-other-muscle",
    "heat-0",
    "heat-1",
    "heat-2",
    "heat-3",
    "heat-4",
    "heat-5",
    "heat-glow",
    "volume-not-trained",
    "volume-maintaining",
    "volume-growing",
    "volume-productive",
    "volume-high",
    "gap-behind",
    "gap-on-plan",
    "gap-ahead",
  ];

  it.each(["dark", "light"] as const)(
    "should name exactly the canvas tokens in the %s theme",
    (scheme) => {
      expect(Object.keys(trainingTokens(scheme)).sort()).toEqual([...expectedNames].sort());
    },
  );

  it.each([
    ["dark", generated.colors],
    ["light", generated.lightColors],
  ])(
    "should not hold the retired far-behind and far-ahead gap steps in the %s theme",
    (_scheme, palette) => {
      expect(Object.keys(palette)).not.toContain("gap-behind-far");
      expect(Object.keys(palette)).not.toContain("gap-ahead-far");
    },
  );

  it("should refuse a training token that the light theme lacks", () => {
    const sources = readSourceTexts();

    expect(() =>
      buildTokens({
        ...sources,
        trainingCss: sources.trainingCss.replace("--heat-3:#BE7E19;", ""),
      }),
    ).toThrow(/heat-3/);
  });

  it("should refuse a training token that reuses a design system name", () => {
    const sources = readSourceTexts();

    expect(() =>
      buildTokens({
        ...sources,
        trainingCss: sources.trainingCss.replace(":root{", ":root{\n--accent:#000000;"),
      }),
    ).toThrow(/accent/);
  });
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
