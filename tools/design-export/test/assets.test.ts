import { describe, expect, it } from "vitest";

import { canvasStylesheetFiles, parseBlobMap, relativeAssetUrls } from "../src/assets.ts";

const blobMap = {
  "/_blob/aaa": "tokens/kilo-tokens.css",
  "/_blob/bbb": "tokens/kilo-m3-canvas.css",
  "/_blob/ccc": "brand/mark.svg",
};

describe("parseBlobMap", () => {
  const assets = parseBlobMap(blobMap);

  it("should give each blob its file and a content type from the file extension", () => {
    expect(assets).toEqual([
      { blob: "/_blob/aaa", file: "tokens/kilo-tokens.css", contentType: "text/css" },
      { blob: "/_blob/bbb", file: "tokens/kilo-m3-canvas.css", contentType: "text/css" },
      { blob: "/_blob/ccc", file: "brand/mark.svg", contentType: "image/svg+xml" },
    ]);
  });

  it("should refuse JSON that is not an object of strings", () => {
    expect(() => parseBlobMap(["/_blob/aaa"])).toThrow(/blob map/);
    expect(() => parseBlobMap({ "/_blob/aaa": 3 })).toThrow(/\/_blob\/aaa/);
  });

  it("should refuse a key that is not a /_blob/ URL", () => {
    expect(() => parseBlobMap({ "tokens/a.css": "tokens/a.css" })).toThrow(/tokens\/a\.css/);
  });

  it("should refuse a file type the server has no content type for", () => {
    expect(() => parseBlobMap({ "/_blob/aaa": "brand/mark.png" })).toThrow(/mark\.png/);
  });

  it("should refuse a file outside the canvas folder", () => {
    expect(() => parseBlobMap({ "/_blob/aaa": "../secret.css" })).toThrow(/secret\.css/);
  });

  it("should refuse an absolute path", () => {
    expect(() => parseBlobMap({ "/_blob/aaa": "/etc/x.css" })).toThrow(/\/etc\/x\.css/);
  });

  it("should refuse a path that climbs out of the canvas folder in the middle", () => {
    expect(() => parseBlobMap({ "/_blob/aaa": "tokens/../../x.css" })).toThrow(/x\.css/);
  });
});

describe("relativeAssetUrls", () => {
  const assets = parseBlobMap(blobMap);

  it("should point each brand mark at its committed copy, one folder up from a board page", () => {
    expect(relativeAssetUrls(assets, "source-m3")).toEqual({
      "/_blob/ccc": "../source-m3/brand/mark.svg",
    });
  });

  it("should leave every stylesheet out, because a page links its own stylesheets", () => {
    expect(Object.keys(relativeAssetUrls(assets, "source"))).not.toContain("/_blob/aaa");
    expect(Object.keys(relativeAssetUrls(assets, "source"))).not.toContain("/_blob/bbb");
  });
});

describe("canvasStylesheetFiles", () => {
  it("should list the stylesheets other than the token stylesheet, by file name", () => {
    expect(canvasStylesheetFiles(parseBlobMap(blobMap))).toEqual(["kilo-m3-canvas.css"]);
  });

  it("should list nothing for a canvas that loads only the token stylesheet", () => {
    expect(canvasStylesheetFiles(parseBlobMap({ "/_blob/aaa": "tokens/kilo-tokens.css" }))).toEqual(
      [],
    );
  });
});
