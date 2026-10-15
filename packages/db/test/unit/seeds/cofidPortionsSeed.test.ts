import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { parsePortionRows } from "../../../scripts/portions/portionRows";
import { renderPortionSeed } from "../../../scripts/portions/renderPortionSeed";

const readPackageFile = (path: string): string =>
  readFileSync(new URL(`../../../${path}`, import.meta.url), "utf8");

describe("the committed portions seed", () => {
  it("should be what 30_cofid_portions.sql holds, so the seed cannot drift from the CSV", () => {
    const rows = parsePortionRows(readPackageFile("data/portions/cofid-portions.csv"));

    // Compared as a boolean so a mismatch does not print two long strings.
    const isUpToDate =
      renderPortionSeed(rows) === readPackageFile("supabase/seeds/30_cofid_portions.sql");
    expect(isUpToDate, "run the regeneration command in docs/runbooks/local-dev.md").toBe(true);
  });
});
