import { describe, expect, it } from "vitest";

import base from "../eslint/base.js";
import reactNative from "../eslint/react-native.js";
import react from "../eslint/react.js";

const configs = { base, react, "react-native": reactNative };

describe.each(Object.entries(configs))("eslint/%s", (_name, config) => {
  it("exports a non-empty array of flat config entries", () => {
    expect(Array.isArray(config)).toBe(true);
    expect(config.length).toBeGreaterThan(0);
  });

  it("gives every entry rules, language options or plugins", () => {
    for (const entry of config) {
      expect("rules" in entry || "languageOptions" in entry || "plugins" in entry).toBe(true);
    }
  });
});

describe("eslint config layering", () => {
  it.each([
    ["react", react],
    ["react-native", reactNative],
  ])("extends base in %s", (_name, config) => {
    expect(base.every((entry, index) => config[index] === entry)).toBe(true);
  });
});
