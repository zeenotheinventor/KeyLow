import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { parsePortionRows } from "../../../scripts/portions/portionRows";
import { renderPortionMigration } from "../../../scripts/portions/renderPortionMigration";
import { readNewestPortionMigration } from "../../support/newestPortionMigration";

const readPackageFile = (path: string): string =>
  readFileSync(new URL(`../../../${path}`, import.meta.url), "utf8");

describe("the committed CoFID portions migration", () => {
  it("should be what the portions file renders, so the migration cannot drift from the CSV", () => {
    const rows = parsePortionRows(readPackageFile("data/portions/cofid-portions.csv"));

    // Compared as a boolean so a mismatch does not print two long strings.
    const isUpToDate = renderPortionMigration(rows) === readNewestPortionMigration().sql;
    expect(
      isUpToDate,
      "the portions file changed: generate a new migration as docs/runbooks/local-dev.md describes, and never edit an applied one",
    ).toBe(true);
  });
});
