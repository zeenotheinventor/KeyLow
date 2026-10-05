import { fileURLToPath } from "node:url";

import { ESLint } from "eslint";
import { describe, expect, it } from "vitest";

const lintFixture = async (fixtureName: string, fileName: string) => {
  const fixtureDirectory = fileURLToPath(new URL(`./fixtures/${fixtureName}/`, import.meta.url));
  const eslint = new ESLint({
    cwd: fixtureDirectory,
    overrideConfigFile: `${fixtureDirectory}fixture.config.js`,
  });
  const [result] = await eslint.lintFiles([fileName]);
  if (result === undefined) {
    throw new Error(`ESLint returned no result for ${fixtureName}/${fileName}`);
  }
  return result;
};

const ruleIdsOf = (messages: { ruleId: string | null }[]) =>
  messages.map((message) => message.ruleId);

describe.each(["base", "react", "react-native"])(
  "a project consuming @keylow/config/eslint/%s",
  (name) => {
    it("reports nothing on a valid file", async () => {
      const result = await lintFixture(name, "valid.ts");
      expect(result.messages).toEqual([]);
    });
  },
);

describe("eslint/base", () => {
  it("lints JavaScript files without type information and with Node globals", async () => {
    const result = await lintFixture("base", "valid.js");
    expect(result.messages).toEqual([]);
  });

  it("catches an unused variable, an explicit any and misordered imports", async () => {
    const result = await lintFixture("base", "invalid.ts");
    expect(ruleIdsOf(result.messages)).toEqual(
      expect.arrayContaining([
        "@typescript-eslint/no-unused-vars",
        "@typescript-eslint/no-explicit-any",
        "import-x/order",
      ]),
    );
  });
});

describe("eslint/base strictness", () => {
  it("catches a non-null assertion, which only the strict rule set reports", async () => {
    const result = await lintFixture("base", "invalid.ts");
    expect(ruleIdsOf(result.messages)).toContain("@typescript-eslint/no-non-null-assertion");
  });

  it("catches an object embedded in a template literal", async () => {
    const result = await lintFixture("base", "invalid.ts");
    expect(ruleIdsOf(result.messages)).toContain(
      "@typescript-eslint/restrict-template-expressions",
    );
  });

  it("allows a number embedded in a template literal", async () => {
    const result = await lintFixture("base", "valid.ts");
    expect(ruleIdsOf(result.messages)).not.toContain(
      "@typescript-eslint/restrict-template-expressions",
    );
  });
});

describe("eslint/react", () => {
  it("catches an img element without alt text", async () => {
    const result = await lintFixture("react", "missing-alt.tsx");
    expect(ruleIdsOf(result.messages)).toContain("jsx-a11y/alt-text");
  });
});

describe("eslint/react-native", () => {
  it("catches destructuring of process.env", async () => {
    const result = await lintFixture("react-native", "invalid.ts");
    expect(ruleIdsOf(result.messages)).toContain("expo/no-env-var-destructuring");
  });

  it("reports a require of a non-asset file but not of an image", async () => {
    const result = await lintFixture("react-native", "invalid.ts");
    const requireMessages = result.messages.filter(
      (message) => message.ruleId === "@typescript-eslint/no-require-imports",
    );
    expect(requireMessages).toHaveLength(1);
  });
});

describe.each(["react", "react-native"])("eslint/%s", (name) => {
  it("catches a conditional hook call", async () => {
    const result = await lintFixture(name, "invalid.ts");
    expect(ruleIdsOf(result.messages)).toContain("react-hooks/rules-of-hooks");
  });
});
