import { readdirSync, readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { renderUsdaMigration } from "../../../scripts/usda/renderUsdaMigration";

const packageUrl = new URL("../../../", import.meta.url);
const migrationsUrl = new URL("supabase/migrations/", packageUrl);

describe("the committed USDA foods migration", () => {
  it("should be what the normalised CSV renders, so the migration cannot drift from the CSV", () => {
    // Migrations are named by timestamp, so the last in name order is the newest. There is none until KEY-760.
    const newestName = readdirSync(migrationsUrl)
      .filter((fileName) => fileName.endsWith("_usda_foods.sql"))
      .sort()
      .at(-1);
    if (newestName === undefined) {
      return;
    }
    const csv = readFileSync(
      new URL("data/usda/usda-sr-legacy.normalised.csv", packageUrl),
      "utf8",
    );

    // Compared as a boolean so a mismatch does not print two long strings.
    const isUpToDate =
      renderUsdaMigration(csv) === readFileSync(new URL(newestName, migrationsUrl), "utf8");
    expect(
      isUpToDate,
      "the normalised USDA CSV changed: generate a new migration as docs/runbooks/local-dev.md describes, and never edit an applied one",
    ).toBe(true);
  });
});
