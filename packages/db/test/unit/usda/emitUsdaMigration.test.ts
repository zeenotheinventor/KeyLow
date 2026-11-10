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
  it("should write the migration the CSV renders, ending on a call that gives every food a default", () => {
    const { csvPath, outputPath } = setUp();

    emitUsdaMigration({ csvPath, outputPath });

    const written = readFileSync(outputPath, "utf8");
    expect(written.startsWith(renderUsdaMigration(csv))).toBe(true);
    expect(written.slice(renderUsdaMigration(csv).length)).toBe(
      "\n-- Every food ends on one default portion, whichever source or import wrote it (KEY-946). Foods that already have a default keep it.\nselect public.give_foods_default_portions();\n",
    );
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
