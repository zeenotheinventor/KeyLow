import { describe, expect, it } from "vitest";

import { formatCsv } from "../../../scripts/cofid/csv";
import { checkCurated } from "../../../scripts/exercises/checkCurated";
import { CURATED_COLUMNS } from "../../../scripts/exercises/columns";
import { MUSCLE_IDS } from "../../../scripts/exercises/muscles";

type Row = [string, string, string, string, string, string];

// One exercise per muscle id with that muscle as primary: the smallest file that passes every rule.
const validRows = (): Row[] =>
  MUSCLE_IDS.map((muscle) => [
    `Exercise_${muscle}`,
    `Exercise ${muscle}`,
    "barbell",
    "isolation",
    `${muscle}:primary:1.0`,
    "",
  ]);

const fileOf = (rows: readonly Row[]): string => formatCsv([[...CURATED_COLUMNS], ...rows]);

const withRow = (index: number, change: (row: Row) => Row): Row[] =>
  validRows().map((row, rowIndex) => (rowIndex === index ? change(row) : row));

const rulesOf = (csv: string): string[] => checkCurated(csv).map(({ rule }) => rule);

describe("checkCurated", () => {
  it("should pass a file where every rule holds", () => {
    expect(checkCurated(fileOf(validRows()))).toEqual([]);
  });

  it("should pass secondary and stabiliser shares and the weights 0 and 1", () => {
    const rows = withRow(0, ([ref, name, equipment, mechanic]) => [
      ref,
      name,
      equipment,
      mechanic,
      "chest_upper:primary:1;triceps:secondary:0.5;abs:stabiliser:0",
      "a note, with a comma",
    ]);

    expect(checkCurated(fileOf(rows))).toEqual([]);
  });

  it("should report equipment that is not in the enum", () => {
    const rows = withRow(0, ([ref, name, , mechanic, muscles, note]) => [
      ref,
      name,
      "body only",
      mechanic,
      muscles,
      note,
    ]);

    expect(rulesOf(fileOf(rows))).toEqual(["malformed"]);
  });

  it("should report a muscle id that is not one of the 22", () => {
    const rows = [
      ...validRows(),
      ["Shoulders", "Shoulders", "cable", "isolation", "shoulders:primary:1.0", ""] satisfies Row,
    ];

    expect(checkCurated(fileOf(rows))).toEqual([
      {
        rule: "unknown_muscle",
        line: 24,
        sourceRef: "Shoulders",
        message: '"shoulders" is not one of the 22 muscle ids',
      },
    ]);
  });

  it("should report a row with no primary muscle", () => {
    const rows = [
      ...validRows(),
      [
        "No_Primary",
        "No primary",
        "cable",
        "isolation",
        "lats:secondary:0.5;abs:stabiliser:0.2",
        "",
      ] satisfies Row,
    ];

    expect(checkCurated(fileOf(rows))).toEqual([
      {
        rule: "no_primary",
        line: 24,
        sourceRef: "No_Primary",
        message: "No muscle has the primary role",
      },
    ]);
  });

  it("should report a row with no muscles at all as having no primary", () => {
    const rows = [...validRows(), ["Empty", "Empty", "cable", "isolation", "", ""] satisfies Row];

    expect(rulesOf(fileOf(rows))).toEqual(["no_primary"]);
  });

  it.each(["1.5", "-0.5", "heavy", "", "1e-1"])(
    "should report the weight %j as not a number from 0 to 1",
    (weight) => {
      const rows = withRow(2, ([ref, name, equipment, mechanic]) => [
        ref,
        name,
        equipment,
        mechanic,
        `delt_front:primary:1.0;triceps:secondary:${weight}`,
        "",
      ]);

      expect(rulesOf(fileOf(rows))).toEqual(["weight_out_of_range"]);
    },
  );

  it("should report a primary weight above 1 as well", () => {
    const rows = withRow(0, (row) => [
      row[0],
      row[1],
      row[2],
      row[3],
      "chest_upper:primary:1.1",
      "",
    ]);

    expect(rulesOf(fileOf(rows))).toEqual(["weight_out_of_range"]);
  });

  it("should report a source_ref that appears twice, naming the first line", () => {
    const rows = [
      ...validRows(),
      ["Exercise_lats", "Lats again", "cable", "compound", "lats:primary:1.0", ""] satisfies Row,
    ];

    expect(checkCurated(fileOf(rows))).toEqual([
      {
        rule: "duplicate_source_ref",
        line: 24,
        sourceRef: "Exercise_lats",
        message: "Exercise_lats is already on line 7",
      },
    ]);
  });

  it("should report each of the 22 ids that is primary nowhere", () => {
    const rows = validRows().filter(
      ([ref]) => ref !== "Exercise_tibialis" && ref !== "Exercise_neck",
    );

    expect(checkCurated(fileOf(rows))).toEqual([
      {
        rule: "muscle_never_primary",
        message: "tibialis is not the primary muscle of any exercise",
      },
      { rule: "muscle_never_primary", message: "neck is not the primary muscle of any exercise" },
    ]);
  });

  it("should not count a muscle as covered when it is only secondary", () => {
    const rows = withRow(21, (row) => [
      row[0],
      row[1],
      row[2],
      row[3],
      "calves:primary:1.0;neck:secondary:0.5",
      "",
    ]);

    expect(rulesOf(fileOf(rows))).toEqual(["muscle_never_primary"]);
  });

  it.each([
    ["a role that is not primary, secondary or stabiliser", "abs:primary:1.0;lats:helper:0.5"],
    ["a muscle that appears twice", "abs:primary:1.0;abs:secondary:0.5"],
  ])("should report %s as malformed", (_case, muscles) => {
    const rows = withRow(12, (row) => [row[0], row[1], row[2], row[3], muscles, ""]);

    expect(rulesOf(fileOf(rows))).toEqual(["malformed"]);
  });

  it("should report a muscles field it cannot read, which then counts for no muscle", () => {
    const rows = withRow(12, (row) => [row[0], row[1], row[2], row[3], "abs:primary", ""]);

    expect(rulesOf(fileOf(rows))).toEqual(["malformed", "muscle_never_primary"]);
  });

  it("should report a mechanic that is not compound or isolation", () => {
    const rows = withRow(0, (row) => [row[0], row[1], row[2], "push", row[4], row[5]]);

    expect(rulesOf(fileOf(rows))).toEqual(["malformed"]);
  });

  it("should report a row with the wrong number of fields", () => {
    const csv = `${fileOf(validRows())}Short_Row,Short row,cable\n`;

    expect(rulesOf(csv)).toEqual(["malformed"]);
  });

  it("should refuse a file whose header is not the curated columns", () => {
    const csv = fileOf(validRows()).replace("override_note", "note");

    expect(checkCurated(csv)).toEqual([
      { rule: "malformed", line: 1, message: `The header is not ${CURATED_COLUMNS.join(",")}` },
    ]);
  });

  it("should refuse a file with a quoted field that never closes", () => {
    expect(rulesOf(`${CURATED_COLUMNS.join(",")}\n"Open,quote\n`)).toEqual(["malformed"]);
  });
});
