import { describe, expect, it } from "vitest";

import {
  buildStaticPage,
  findPageProblems,
  isAllowedRequestUrl,
  rewriteAssetUrls,
} from "../src/staticPage.ts";

describe("rewriteAssetUrls", () => {
  it("should replace every occurrence of a blob URL", () => {
    const html = '<img src="/_blob/abc"><img src="/_blob/abc"><img src="/_blob/def">';
    expect(rewriteAssetUrls(html, { "/_blob/abc": "../source/brand/mark.svg" })).toBe(
      '<img src="../source/brand/mark.svg"><img src="../source/brand/mark.svg"><img src="/_blob/def">',
    );
  });
});

describe("buildStaticPage", () => {
  const page = buildStaticPage({
    lang: "en-GB",
    title: "Find food, idle",
    tokensHref: "../../../packages/tokens/css/kilo-tokens.css",
    proposalsHref: "../tokens/kilo-proposals.css",
    fontsHref: "https://fonts.googleapis.com/css2?family=Geist&display=swap",
    styles: ["body{margin:0}"],
    boardHtml: '<div data-theme="dark">board</div>',
  });

  it("should start with a doctype and the document language", () => {
    expect(page.startsWith('<!doctype html>\n<html lang="en-GB">')).toBe(true);
  });

  it("should link the packages/tokens stylesheet, then the proposals, by relative path", () => {
    const tokensLink =
      '<link rel="stylesheet" href="../../../packages/tokens/css/kilo-tokens.css">';
    const proposalsLink = '<link rel="stylesheet" href="../tokens/kilo-proposals.css">';
    expect(page).toContain(`${tokensLink}\n${proposalsLink}\n`);
  });

  it("should link Google Fonts and carry the board styles", () => {
    expect(page).toContain(
      'href="https://fonts.googleapis.com/css2?family=Geist&amp;display=swap"',
    );
    expect(page).toContain("<style>\nbody{margin:0}\n</style>");
  });

  it("should escape the title", () => {
    const escaped = buildStaticPage({
      lang: "en-GB",
      title: "a < b & c",
      tokensHref: "t.css",
      proposalsHref: "p.css",
      fontsHref: "f",
      styles: [],
      boardHtml: "",
    });
    expect(escaped).toContain("<title>a &lt; b &amp; c</title>");
  });

  it("should put the board in the body", () => {
    expect(page).toContain('<body>\n<div data-theme="dark">board</div>\n</body>');
  });
});

describe("findPageProblems", () => {
  const clean =
    '<html><link rel="stylesheet" href="../../../packages/tokens/css/kilo-tokens.css"><link rel="stylesheet" href="../tokens/kilo-proposals.css"><div style="color: var(--text-primary)">x</div></html>';

  it("should accept a page with no runtime, no blob URL and no network but Google Fonts", () => {
    expect(
      findPageProblems(`${clean}<link href="https://fonts.googleapis.com/css2?family=Geist">`),
    ).toEqual([]);
  });

  it("should flag a script", () => {
    expect(findPageProblems(`${clean}<script src="./support.js"></script>`)).toContainEqual(
      expect.stringContaining("script"),
    );
  });

  it("should flag a leftover blob URL", () => {
    expect(findPageProblems(`${clean}<img src="/_blob/abc">`)).toContainEqual(
      expect.stringContaining("/_blob/"),
    );
  });

  it("should flag a claude.ai URL", () => {
    expect(findPageProblems(`${clean}<a href="https://claude.ai/artifact/x">x</a>`)).toContainEqual(
      expect.stringContaining("claude.ai"),
    );
  });

  it("should flag a request to another host", () => {
    expect(findPageProblems(`${clean}<img src="https://example.com/a.png">`)).toContainEqual(
      expect.stringContaining("example.com"),
    );
  });

  it("should allow a plain link to another host", () => {
    expect(
      findPageProblems(`${clean}<a href="https://world.openfoodfacts.org">Open Food Facts</a>`),
    ).toEqual([]);
  });

  it("should flag a runtime class left in the markup", () => {
    expect(findPageProblems(`${clean}<span class="sc-interp">x</span>`)).toContainEqual(
      expect.stringContaining("sc-interp"),
    );
  });

  it("should flag a page with no token reference and no token stylesheet", () => {
    expect(findPageProblems("<html><div>x</div></html>")).toEqual(
      expect.arrayContaining([
        expect.stringContaining("var(--"),
        expect.stringContaining("packages/tokens/css/kilo-tokens.css"),
        expect.stringContaining("kilo-proposals.css"),
      ]),
    );
  });

  it("should flag a page that still links the retired docs/design copy of the tokens", () => {
    const retired = clean.replace(
      "../../../packages/tokens/css/kilo-tokens.css",
      "../tokens/kilo-tokens.css",
    );
    expect(findPageProblems(retired)).toContainEqual(
      expect.stringContaining("docs/design/tokens/kilo-tokens.css"),
    );
  });
});

describe("isAllowedRequestUrl", () => {
  it.each([
    "file:///repo/packages/tokens/css/kilo-tokens.css",
    "https://fonts.googleapis.com/css2?family=Geist",
    "https://fonts.gstatic.com/s/geist/v5/font.woff2",
  ])("should allow %s", (url) => {
    expect(isAllowedRequestUrl(url)).toBe(true);
  });

  it.each(["https://example.com/a.png", "http://127.0.0.1:3000/support.js"])(
    "should refuse %s",
    (url) => {
      expect(isAllowedRequestUrl(url)).toBe(false);
    },
  );
});
