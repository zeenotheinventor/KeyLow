import { describe, expect, it } from "vitest";

import { extractProposals } from "../src/proposals.ts";

describe("extractProposals", () => {
  const tokens = [
    ":root{--surface:#141821;}",
    "@keyframes kl-fade-in{from{opacity:0}to{opacity:1}}",
    "/* ---- Proposed additions (not yet in the Ki-Lo design system; DC-09) ----",
    "   --camera: the viewfinder backdrop. */",
    ":root{--camera:#0B0E13;}",
    "",
  ].join("\n");

  it("should return the marked block to the end of the file", () => {
    expect(extractProposals(tokens)).toBe(
      [
        "/* ---- Proposed additions (not yet in the Ki-Lo design system; DC-09) ----",
        "   --camera: the viewfinder backdrop. */",
        ":root{--camera:#0B0E13;}",
        "",
      ].join("\n"),
    );
  });

  it("should leave out the design system tokens before the marker", () => {
    expect(extractProposals(tokens)).not.toContain("--surface");
  });

  it("should fail when the file has no marked block", () => {
    expect(() => extractProposals(":root{--surface:#141821;}")).toThrow(/Proposed additions/);
  });
});
