import { describe, expect, it } from "vitest";

import { compileUtilities } from "./compileUtilities";

import { warningInk } from "@/lib/theme/warningInk";

describe("warningInk", () => {
  it("should be the warning colour", async () => {
    const css = await compileUtilities(warningInk);

    expect(css).toMatch(/\.text-warning\s*\{[^}]*--kl-warning/);
  });

  it("should be the primary text colour in the light theme, where warning is too faint for text", async () => {
    const css = await compileUtilities(warningInk);

    expect(css).toMatch(/light-theme\\:text-text-primary\s*\{[^}]*--kl-text-primary/);
  });
});
