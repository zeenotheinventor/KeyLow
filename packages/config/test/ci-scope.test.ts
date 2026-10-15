import { describe, expect, it } from "vitest";

import { scopeOf } from "../../../scripts/ci-scope.mjs";

const noPackagesAffected = (): string[] => [];

describe("scopeOf", () => {
  it.each(["package.json", "pnpm-lock.yaml", "turbo.json", ".github/workflows/ci.yml"])(
    "should run everything when %s changed",
    (rootFile) => {
      const scope = scopeOf([rootFile, "apps/mobile/app/index.tsx"], noPackagesAffected);

      expect(scope).toEqual({ full: true, packages: [] });
    },
  );

  it("should not ask for the affected packages when everything runs", () => {
    let asked = false;

    scopeOf(["package.json"], () => {
      asked = true;
      return [];
    });

    expect(asked).toBe(false);
  });

  it("should not count a Markdown file outside the packages as a root change", () => {
    expect(scopeOf(["docs/ci.md"], noPackagesAffected).full).toBe(false);
  });

  it("should run only the packages a change inside a package reaches", () => {
    const scope = scopeOf(["apps/mobile/app/index.tsx"], () => ["@keylow/mobile"]);

    expect(scope).toEqual({ full: false, packages: ["@keylow/mobile"] });
  });
});
