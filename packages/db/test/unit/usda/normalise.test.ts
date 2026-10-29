import { existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { parseChecksumFile, sha256Hex } from "../../../scripts/cofid/checksum";
import { formatCsv, parseCsv } from "../../../scripts/cofid/csv";
import { normaliseUsda, runNormalise } from "../../../scripts/usda/normalise";

const fixtures = join(import.meta.dirname, "fixtures");

const listHeader = [
  "fdc_id",
  "name",
  "portion_label",
  "portion_seq_num",
  "wave",
  "sr_description",
  "gap_note",
];
const rawThigh = [
  "172385",
  "Chicken, thigh, raw, meat and skin",
  "1 thigh",
  "2",
  "1",
  "Chicken, broilers or fryers, thigh, meat and skin, raw",
  "CoFID has only casseroled thighs",
];
const roastedThigh = [
  "173625",
  "Chicken, thigh, roasted, meat and skin",
  "1 thigh",
  "2",
  "1",
  "Chicken, broilers or fryers, thigh, meat and skin, cooked, roasted",
  "CoFID has only casseroled thighs",
];
const listOf = (...rows: string[][]): string => formatCsv([listHeader, ...rows]);

const recordsOf = (csv: string): Record<string, string>[] => {
  const [header = [], ...rows] = parseCsv(csv);
  return rows.map((row) => Object.fromEntries(header.map((name, i) => [name, row[i] ?? ""])));
};

describe("normaliseUsda", () => {
  it("should write one row per listed food, in list order, and nothing else", async () => {
    const { csv, summary } = await normaliseUsda({
      srDirectory: fixtures,
      curatedCsv: listOf(roastedThigh, rawThigh),
    });

    expect(recordsOf(csv).map((record) => record["fdc_id"])).toEqual(["173625", "172385"]);
    expect(summary.foodCount).toBe(2);
  });

  it("should write FDC 172385 with the figures from the SR file", async () => {
    const { csv } = await normaliseUsda({
      srDirectory: fixtures,
      curatedCsv: listOf(rawThigh),
    });

    expect(recordsOf(csv)).toEqual([
      {
        fdc_id: "172385",
        name: "Chicken, thigh, raw, meat and skin",
        sr_description: "Chicken, broilers or fryers, thigh, meat and skin, raw",
        food_group: "Poultry Products",
        basis: "per_100g",
        kcal: "221",
        protein_g: "16.52",
        fat_g: "16.61",
        sat_fat_g: "4.524",
        carbs_g: "0.25",
        sugars_g: "0",
        fibre_g: "0",
        salt_g: "0.2025",
        micros: '{"usda_1087":7,"usda_1089":0.68,"usda_1162":0,"usda_1175":0.347}',
        quality: '{"fibre_method":"aoac","carbs_convention":"eu"}',
        portion_label: "1 thigh",
        portion_amount: "1",
        portion_grams: "193",
        portion_modifier: "thigh with skin",
      },
    ]);
  });

  it("should leave the portion columns blank for a food with no portion", async () => {
    const { csv } = await normaliseUsda({
      srDirectory: fixtures,
      curatedCsv: listOf([...rawThigh.slice(0, 2), "", "", ...rawThigh.slice(4)]),
    });

    expect(recordsOf(csv)[0]).toMatchObject({
      portion_label: "",
      portion_amount: "",
      portion_grams: "",
      portion_modifier: "",
    });
  });

  it("should give the same bytes and checksum when run twice", async () => {
    const run = () =>
      normaliseUsda({ srDirectory: fixtures, curatedCsv: listOf(rawThigh, roastedThigh) });

    const first = await run();
    const second = await run();

    expect(second.csv).toBe(first.csv);
    expect(second.sha256).toBe(first.sha256);
    expect(first.sha256).toBe(sha256Hex(first.csv));
  });

  it("should fail naming an fdc_id that is not in the SR folder", async () => {
    await expect(
      normaliseUsda({
        srDirectory: fixtures,
        curatedCsv: listOf(rawThigh, ["999999", "Chicken, wing, raw", "", "", "1", "d", "n"]),
      }),
    ).rejects.toThrow(/999999.*not in/);
  });

  it("should fail naming the row when its name still holds a US word", async () => {
    await expect(
      normaliseUsda({
        srDirectory: fixtures,
        curatedCsv: listOf([
          "172385",
          "Chicken, broilers or fryers, thigh, raw",
          ...rawThigh.slice(2),
        ]),
      }),
    ).rejects.toThrow(/172385.*broilers/);
  });

  it("should fail when the list gives a different description from the SR file", async () => {
    await expect(
      normaliseUsda({
        srDirectory: fixtures,
        curatedCsv: listOf([...rawThigh.slice(0, 5), "Chicken, wing, raw", rawThigh[6] ?? ""]),
      }),
    ).rejects.toThrow(/172385.*Chicken, wing, raw.*Chicken, broilers or fryers, thigh/);
  });

  it("should fail when the chosen portion sequence number is not one of the food's portions", async () => {
    await expect(
      normaliseUsda({
        srDirectory: fixtures,
        curatedCsv: listOf([...rawThigh.slice(0, 3), "9", ...rawThigh.slice(4)]),
      }),
    ).rejects.toThrow(/172385.*portion.*9/);
  });

  it("should refuse a chosen portion whose SR amount is not 1, naming the fdc_id and seq_num", async () => {
    await expect(
      normaliseUsda({
        srDirectory: fixtures,
        curatedCsv: listOf([...rawThigh.slice(0, 2), "4 oz", "1", ...rawThigh.slice(4)]),
      }),
    ).rejects.toThrow(/172385.*seq_num 1.*amount is 4/);
  });
});

describe("runNormalise", () => {
  const folder = () => mkdtempSync(join(tmpdir(), "usda-normalise-"));

  it("should write the CSV and a checksum file that matches it", async () => {
    const directory = folder();
    const listPath = join(directory, "usda-foods.csv");
    const outputPath = join(directory, "usda-sr-legacy.normalised.csv");
    writeFileSync(listPath, listOf(rawThigh, roastedThigh));

    await runNormalise({ srDirectory: fixtures, listPath, outputPath });

    const bytes = readFileSync(outputPath);
    expect(parseChecksumFile(readFileSync(`${outputPath}.sha256`, "utf8"))).toBe(sha256Hex(bytes));
    expect(readFileSync(`${outputPath}.sha256`, "utf8")).toMatch(
      /^[0-9a-f]{64} {2}usda-sr-legacy\.normalised\.csv\n$/,
    );
  });

  it("should write identical files when run twice", async () => {
    const directory = folder();
    const listPath = join(directory, "usda-foods.csv");
    const outputPath = join(directory, "out.csv");
    writeFileSync(listPath, listOf(rawThigh, roastedThigh));

    await runNormalise({ srDirectory: fixtures, listPath, outputPath });
    const first = [readFileSync(outputPath), readFileSync(`${outputPath}.sha256`)];
    await runNormalise({ srDirectory: fixtures, listPath, outputPath });
    const second = [readFileSync(outputPath), readFileSync(`${outputPath}.sha256`)];

    expect(second).toEqual(first);
  });

  it("should refuse a zip with the wrong checksum and write nothing", async () => {
    const directory = folder();
    const listPath = join(directory, "usda-foods.csv");
    const outputPath = join(directory, "out.csv");
    const zipPath = join(directory, "sr.zip");
    writeFileSync(listPath, listOf(rawThigh));
    writeFileSync(zipPath, "some other zip");

    await expect(
      runNormalise({ srDirectory: fixtures, listPath, outputPath, zipPath }),
    ).rejects.toThrow(/sha256/);
    expect(existsSync(outputPath)).toBe(false);
    expect(existsSync(`${outputPath}.sha256`)).toBe(false);
  });
});
