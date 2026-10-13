import { describe, expect, it } from "vitest";

import { canvasAssets, relativeAssetUrls } from "../src/assets.ts";

describe("relativeAssetUrls", () => {
  const rewrites = relativeAssetUrls();

  it("should point each brand mark at its committed copy, one folder up from a board page", () => {
    const marks = canvasAssets.filter((asset) => asset.file.startsWith("source/brand/"));
    expect(marks).not.toHaveLength(0);
    for (const mark of marks) {
      expect(rewrites[mark.blob]).toBe(`../${mark.file}`);
    }
  });

  it("should leave the canvas token stylesheet out, because a page links the packages/tokens one", () => {
    const stylesheet = canvasAssets.find((asset) => asset.contentType === "text/css");
    expect(stylesheet?.file).toBe("source/tokens/kilo-tokens.css");
    expect(Object.keys(rewrites)).not.toContain(stylesheet?.blob);
  });
});
