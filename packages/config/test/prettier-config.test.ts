import { format } from "prettier";
import { describe, expect, it } from "vitest";

import prettierConfig from "../prettier.config.js";

const unformattedSource = "const greeting = {message:'hello',recipients:['ada','grace',],}\n";

const formattedSource = `const greeting = { message: "hello", recipients: ["ada", "grace"] };\n`;

const formatTypeScript = (source: string) =>
  format(source, { ...prettierConfig, parser: "typescript" });

describe("prettier config", () => {
  it("exposes the shared formatting options", () => {
    expect(prettierConfig).toEqual({
      printWidth: 100,
      semi: true,
      singleQuote: false,
      trailingComma: "all",
    });
  });

  it("formats a sample file to the expected content", async () => {
    expect(await formatTypeScript(unformattedSource)).toBe(formattedSource);
  });

  it("formats deterministically", async () => {
    const once = await formatTypeScript(unformattedSource);
    const twice = await formatTypeScript(once);
    expect(twice).toBe(once);
  });
});
