import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

import ts from "typescript";
import { describe, expect, it } from "vitest";

const resolveFragment = (name: string) => {
  const fragmentPath = fileURLToPath(new URL(`../tsconfig/${name}.json`, import.meta.url));
  const sourceFile = ts.readJsonConfigFile(fragmentPath, (path) => ts.sys.readFile(path));
  return ts.parseJsonSourceFileConfigFileContent(sourceFile, ts.sys, dirname(fragmentPath)).options;
};

describe.each(["node", "react", "next", "react-native"])("tsconfig/%s.json", (name) => {
  it("inherits the strictness of the root tsconfig.base.json", () => {
    const options = resolveFragment(name);
    expect(options.strict).toBe(true);
    expect(options.noUncheckedIndexedAccess).toBe(true);
    expect(options.verbatimModuleSyntax).toBe(true);
  });
});

describe("tsconfig fragment additions", () => {
  it("limits node to the ES2022 library and Node types", () => {
    const options = resolveFragment("node");
    expect(options.lib).toEqual(["lib.es2022.d.ts"]);
    expect(options.types).toEqual(["node"]);
  });

  it("enables the automatic JSX runtime and DOM libraries in react", () => {
    const options = resolveFragment("react");
    expect(options.jsx).toBe(ts.JsxEmit.ReactJSX);
    expect(options.lib).toContain("lib.dom.d.ts");
  });

  it("preserves JSX and enables the Next.js plugin in next", () => {
    const options = resolveFragment("next");
    expect(options.jsx).toBe(ts.JsxEmit.Preserve);
    expect(options.plugins).toEqual([{ name: "next" }]);
  });

  it("uses the React Native JSX mode and no DOM libraries in react-native", () => {
    const options = resolveFragment("react-native");
    expect(options.jsx).toBe(ts.JsxEmit.ReactNative);
    expect(options.lib).not.toContain("lib.dom.d.ts");
  });
});

describe.each([
  ["node", (options: ts.CompilerOptions) => options.types],
  ["react", (options: ts.CompilerOptions) => options.jsx],
  ["next", (options: ts.CompilerOptions) => options.jsx],
  ["react-native", (options: ts.CompilerOptions) => options.jsx],
])("a project extending @keylow/config/tsconfig/%s.json by package specifier", (name, pick) => {
  it("resolves the fragment and the root base through the package exports", () => {
    const consumerDirectory = fileURLToPath(new URL("./fixtures/base/", import.meta.url));
    const parsed = ts.parseJsonConfigFileContent(
      { extends: `@keylow/config/tsconfig/${name}.json` },
      ts.sys,
      consumerDirectory,
      undefined,
      `${consumerDirectory}tsconfig.json`,
    );
    expect(parsed.errors).toEqual([]);
    expect(parsed.options.strict).toBe(true);
    expect(pick(parsed.options)).toEqual(pick(resolveFragment(name)));
  });
});
