import { describe, expect, it } from "vitest";

import { parseCssScopes } from "../scripts/parseCss";

describe("parseCssScopes", () => {
  it("should collect the declarations of a rule under its selector", () => {
    const scopes = parseCssScopes(":root{--accent:#CCF249;--space-1:4px;}");

    expect(scopes).toEqual({ ":root": { "--accent": "#CCF249", "--space-1": "4px" } });
  });

  it("should keep one scope per selector and merge repeated selectors", () => {
    const scopes = parseCssScopes(':root{--a:1;}\n[data-theme="light"]{--a:2;}\n:root{--b:3;}');

    expect(scopes).toEqual({
      ":root": { "--a": "1", "--b": "3" },
      '[data-theme="light"]': { "--a": "2" },
    });
  });

  it("should drop block comments, including the ones trailing a declaration", () => {
    const scopes = parseCssScopes(
      "/* heading */\n:root{\n/* group */\n--duration-quick:160ms;/* @kind other */\n--stagger:36ms;\n}",
    );

    expect(scopes).toEqual({ ":root": { "--duration-quick": "160ms", "--stagger": "36ms" } });
  });

  it("should keep commas and parentheses inside a value", () => {
    const scopes = parseCssScopes(
      ":root{--c:rgba(204,242,73,0.14);--s:env(safe-area-inset-top,0px);--e:inset 0 1px 0 0 rgba(255,255,255,0.03),0 6px 20px -4px rgba(0,0,0,0.45);}",
    );

    expect(scopes[":root"]).toEqual({
      "--c": "rgba(204,242,73,0.14)",
      "--s": "env(safe-area-inset-top,0px)",
      "--e": "inset 0 1px 0 0 rgba(255,255,255,0.03),0 6px 20px -4px rgba(0,0,0,0.45)",
    });
  });

  it("should keep a quoted value whole, quotes included", () => {
    const scopes = parseCssScopes(':root{--font-sans:"Geist",system-ui;--font-numeric:"tnum" 1;}');

    expect(scopes[":root"]).toEqual({
      "--font-sans": '"Geist",system-ui',
      "--font-numeric": '"tnum" 1',
    });
  });

  it("should record plain properties such as color-scheme next to custom properties", () => {
    const scopes = parseCssScopes(":root{color-scheme:dark;--a:1;}");

    expect(scopes[":root"]).toEqual({ "color-scheme": "dark", "--a": "1" });
  });

  it("should name a nested rule after its at-rule and selector", () => {
    const scopes = parseCssScopes(
      "@media (prefers-reduced-motion:reduce){:root{--motion-distance:0;--press-scale:1;}}",
    );

    expect(scopes).toEqual({
      "@media (prefers-reduced-motion:reduce) :root": {
        "--motion-distance": "0",
        "--press-scale": "1",
      },
    });
  });

  it("should skip keyframes, which hold no tokens", () => {
    const scopes = parseCssScopes(
      ":root{--a:1;}@keyframes kl-fade-in{from{opacity:0}to{opacity:1}}@keyframes kl-spin{to{transform:rotate(360deg)}}",
    );

    expect(scopes).toEqual({ ":root": { "--a": "1" } });
  });

  it("should return no scopes for an empty stylesheet", () => {
    expect(parseCssScopes("/* nothing here */")).toEqual({});
  });
});
