import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const rootPackageJson: unknown = JSON.parse(
  readFileSync(new URL("../../../package.json", import.meta.url), "utf8"),
);

function allowedBuildScripts(): unknown {
  if (typeof rootPackageJson !== "object" || rootPackageJson === null) return undefined;
  const pnpm: unknown = "pnpm" in rootPackageJson ? rootPackageJson.pnpm : undefined;
  if (typeof pnpm !== "object" || pnpm === null) return undefined;
  return "onlyBuiltDependencies" in pnpm ? pnpm.onlyBuiltDependencies : undefined;
}

describe("root package.json pnpm.onlyBuiltDependencies", () => {
  // pnpm 10 skips dependency install scripts that are not listed. Skia copies its native libraries
  // in a postinstall, so without this entry the mobile build breaks, and only after a slow EAS run.
  it("lets @shopify/react-native-skia run its postinstall, which copies the native libraries", () => {
    expect(allowedBuildScripts()).toContain("@shopify/react-native-skia");
  });
});
