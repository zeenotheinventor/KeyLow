import { themeVariables } from "@keylow/tokens";
import postcss from "postcss";
import tailwindcss from "tailwindcss";
import { describe, expect, it } from "vitest";

import tailwindConfig from "../../tailwind.config";
import { compileUtilities } from "../ui/compileUtilities";

async function baseCss() {
  const result = await postcss([
    tailwindcss({ ...tailwindConfig, content: [{ raw: "", extension: "html" }] }),
  ]).process("@tailwind base;", { from: undefined });
  return result.css;
}

/** The body of the `@media (prefers-color-scheme: light)` block, which holds the device rule. */
function lightMediaBlock(css: string) {
  const start = css.indexOf("@media (prefers-color-scheme: light)");
  return start === -1 ? "" : css.slice(start);
}

describe("the theme the device chooses", () => {
  it("should apply the light colours to data-theme=device when the system prefers light", async () => {
    const block = lightMediaBlock(await baseCss());

    expect(block).toContain('[data-theme="device"]');
    expect(block).toContain(`--kl-background: ${themeVariables("light")["--kl-background"]}`);
  });

  it("should leave data-theme=device on the dark colours when the system does not prefer light", async () => {
    const css = await baseCss();
    const beforeMedia = css.slice(0, css.indexOf("@media (prefers-color-scheme: light)"));

    expect(beforeMedia).not.toContain('[data-theme="device"]');
  });
});

describe("the light-theme variant", () => {
  const markup = '<p class="light-theme:text-text-primary"></p>';

  it("should apply under an explicit light theme", async () => {
    const css = await compileUtilities(markup);

    expect(css).toContain('[data-theme="light"] .light-theme\\:text-text-primary');
  });

  it("should apply under the device theme only when the system prefers light", async () => {
    const css = await compileUtilities(markup);
    const media = css.slice(css.indexOf("@media (prefers-color-scheme: light)"));

    expect(css).toContain("@media (prefers-color-scheme: light)");
    expect(media).toContain('[data-theme="device"] .light-theme\\:text-text-primary');
  });
});
