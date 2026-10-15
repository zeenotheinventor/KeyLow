import { describe, expect, it } from "vitest";

import { buildIconColorTones, buildIconMap, toIdentifier } from "../src/iconLists.ts";

describe("buildIconMap", () => {
  it("should re-export every icon file with one line each, sorted by name", () => {
    expect(buildIconMap(["Check", "Apple"])).toContain(
      'export * from "./icons/Apple";\nexport * from "./icons/Check";\n',
    );
  });

  it("should say it is generated and not to edit it", () => {
    expect(buildIconMap(["Apple"]).split("\n")[0]).toMatch(/^\/\/ Generated .* Do not edit/);
  });
});

describe("toIdentifier", () => {
  it("should turn a hyphenated tone name into camel case", () => {
    expect(toIdentifier("accent-ink")).toBe("accentInk");
  });

  it("should leave a plain name as it is", () => {
    expect(toIdentifier("warning")).toBe("warning");
  });
});

describe("buildIconColorTones", () => {
  const text = buildIconColorTones(["warning", "accent-ink"]);

  it("should import the colour name of every tone file, sorted by tone", () => {
    expect(text).toContain(
      'import { colorName as accentInk } from "./tones/accent-ink";\nimport { colorName as warning } from "./tones/warning";\n',
    );
  });

  it("should build a record from each tone to its colour name, one per line", () => {
    expect(text).toContain('  "accent-ink": accentInk,\n  warning: warning,\n');
  });

  it("should check every colour name against the tokens", () => {
    expect(text).toContain("as const satisfies Record<string, ColorName>");
  });
});
