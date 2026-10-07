import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { sha256Hex } from "../../../scripts/cofid/checksum";
import { importCofid } from "../../../scripts/cofid/importFoods";
import { createSqlSeedStore } from "../../../scripts/cofid/sqlSeedStore";
import { parseSubsetFile } from "../../../scripts/cofid/subset";

const readPackageFile = (path: string): Buffer =>
  readFileSync(new URL(`../../../${path}`, import.meta.url));

const subsetCodes = parseSubsetFile(readPackageFile("data/cofid/subset.txt").toString("utf8"));

describe("the committed CoFID subset", () => {
  it("should be sorted by code and leave out the duplicated code 13-669", () => {
    const sorted = [...subsetCodes].sort((first, second) => {
      const [firstGroup = 0, firstItem = 0] = first.split("-").map(Number);
      const [secondGroup = 0, secondItem = 0] = second.split("-").map(Number);
      return firstGroup - secondGroup || firstItem - secondItem;
    });

    expect(subsetCodes).toEqual(sorted);
    expect(subsetCodes).not.toContain("13-669");
  });

  it("should be the codes the seeded search test expects to find", () => {
    const seededSearchTest = readPackageFile(
      "supabase/tests/search_foods_seeded.test.sql",
    ).toString("utf8");
    const expectedCodes = [...seededSearchTest.matchAll(/\('(\d{2}-\d+)'\)/g)].map(
      ([, code]) => code,
    );

    expect(expectedCodes).toEqual(subsetCodes);
  });

  it("should be what 10_cofid_subset.sql holds, so the seed cannot drift from the CSV and the mapping", async () => {
    const csv = readPackageFile("data/cofid/cofid-2021.normalised.csv");
    const store = createSqlSeedStore();

    await importCofid(store, {
      csv: csv.toString("utf8"),
      fileSha256: sha256Hex(csv),
      label: "seed-subset",
      subsetCodes,
      dryRun: false,
      batchSize: 100,
      log: () => undefined,
    });

    // Compared as a boolean so a mismatch does not print two multi-megabyte strings.
    const isUpToDate =
      store.render() === readPackageFile("supabase/seeds/10_cofid_subset.sql").toString("utf8");
    expect(isUpToDate, "run the regeneration command in docs/runbooks/local-dev.md").toBe(true);
  });
});
