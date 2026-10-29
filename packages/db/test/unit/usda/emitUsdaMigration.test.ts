import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { emitUsdaMigration } from "../../../scripts/usda/emitUsdaMigration";
import { renderUsdaMigration } from "../../../scripts/usda/renderUsdaMigration";
import { normalisedCsvOf, rawThigh, roastedThigh } from "../../support/normalisedUsdaCsv";

const csv = normalisedCsvOf(rawThigh, roastedThigh);

function setUp(): { csvPath: string; outputPath: string } {
  const directory = mkdtempSync(join(tmpdir(), "emit-usda-"));
  const csvPath = join(directory, "usda-sr-legacy.normalised.csv");
  writeFileSync(csvPath, csv);
  return { csvPath, outputPath: join(directory, "20261030000000_usda_foods.sql") };
}

describe("emitUsdaMigration", () => {
  it("should write the migration the CSV renders", () => {
    const { csvPath, outputPath } = setUp();

    emitUsdaMigration({ csvPath, outputPath });

    expect(readFileSync(outputPath, "utf8")).toBe(renderUsdaMigration(csv));
  });

  it("should refuse a path that holds a file already, and leave that file as it was", () => {
    const { csvPath, outputPath } = setUp();
    writeFileSync(outputPath, "applied");

    expect(() => {
      emitUsdaMigration({ csvPath, outputPath });
    }).toThrow("An applied migration is never regenerated");
    expect(readFileSync(outputPath, "utf8")).toBe("applied");
  });
});
