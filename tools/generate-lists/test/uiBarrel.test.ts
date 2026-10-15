import { describe, expect, it } from "vitest";

import { buildUiBarrel, isInternalToKit } from "../src/uiBarrel.ts";

describe("buildUiBarrel", () => {
  it("should export every folder with one line each, sorted by name", () => {
    expect(buildUiBarrel(["Text", "Badge", "Button"])).toContain(
      'export * from "./Badge";\nexport * from "./Button";\nexport * from "./Text";\n',
    );
  });

  it("should say it is generated and not to edit it", () => {
    expect(buildUiBarrel(["Badge"]).split("\n")[0]).toMatch(/^\/\/ Generated .* Do not edit/);
  });

  it("should give the same text whatever order the folders arrive in", () => {
    expect(buildUiBarrel(["B", "A"])).toBe(buildUiBarrel(["A", "B"]));
  });
});

describe("isInternalToKit", () => {
  it("should be true when the folder index starts with the not-in-barrel marker", () => {
    expect(isInternalToKit("// @not-in-barrel used by the kit only\nexport {};\n")).toBe(true);
  });

  it("should be false for an ordinary folder index", () => {
    expect(isInternalToKit('export { Badge } from "./Badge";\n')).toBe(false);
  });

  it("should be false when the marker is only mentioned further down", () => {
    expect(isInternalToKit("export {};\n// @not-in-barrel\n")).toBe(false);
  });
});
