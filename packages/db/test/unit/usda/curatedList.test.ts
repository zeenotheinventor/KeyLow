import { describe, expect, it } from "vitest";

import { formatCsv } from "../../../scripts/cofid/csv";
import { parseCuratedList } from "../../../scripts/usda/curatedList";

const header = [
  "fdc_id",
  "name",
  "portion_label",
  "portion_seq_num",
  "wave",
  "sr_description",
  "gap_note",
];

const listOf = (...rows: string[][]): string => formatCsv([header, ...rows]);

const thighRow = [
  "172385",
  "Chicken, thigh, raw, meat and skin",
  "1 thigh",
  "2",
  "1",
  "Chicken, broilers or fryers, thigh, meat and skin, raw",
  "CoFID has only casseroled thighs",
];

describe("parseCuratedList", () => {
  it("should read a row into its fields", () => {
    expect(parseCuratedList(listOf(thighRow))).toEqual([
      {
        fdcId: "172385",
        name: "Chicken, thigh, raw, meat and skin",
        portion: { label: "1 thigh", sequenceNumber: "2" },
        wave: "1",
        srDescription: "Chicken, broilers or fryers, thigh, meat and skin, raw",
        gapNote: "CoFID has only casseroled thighs",
      },
    ]);
  });

  it("should read a blank portion as none", () => {
    const [food] = parseCuratedList(listOf(["172385", "Chicken, thigh", "", "", "1", "d", "n"]));

    expect(food?.portion).toBeNull();
  });

  it("should fail when only one of the portion label and sequence number is given", () => {
    expect(() =>
      parseCuratedList(listOf(["172385", "Chicken, thigh", "1 thigh", "", "1", "d", "n"])),
    ).toThrow(/172385.*portion_label and portion_seq_num/);
  });

  it("should fail when the same fdc_id is listed twice", () => {
    expect(() => parseCuratedList(listOf(thighRow, thighRow))).toThrow(/172385.*twice/);
  });

  it("should fail when a row has no fdc_id", () => {
    expect(() =>
      parseCuratedList(listOf(["", "Chicken, thigh, raw, meat and skin", "", "", "1", "d", "n"])),
    ).toThrow(/Row 1.*no fdc_id/);
  });

  it("should fail naming the fdc_id when a row has no name", () => {
    expect(() => parseCuratedList(listOf(["172385", "  ", "", "", "1", "d", "n"]))).toThrow(
      /FDC 172385 has no name/,
    );
  });

  it("should fail naming both fdc_ids when two rows have the same name", () => {
    expect(() =>
      parseCuratedList(
        listOf(thighRow, ["173625", "chicken,  thigh, raw, meat and skin", "", "", "1", "d", "n"]),
      ),
    ).toThrow(/FDC 173625 has the same name as FDC 172385/);
  });

  it("should fail when a column is missing from the header", () => {
    expect(() =>
      parseCuratedList(
        formatCsv([
          ["fdc_id", "name"],
          ["1", "x"],
        ]),
      ),
    ).toThrow(/no column.*portion_label/);
  });

  describe("US words in the name", () => {
    // Each name holds only the one term, so the message proves which term fired.
    it.each([
      ["Chicken, broilers, thigh, raw", "broilers"],
      ["Chicken, fryers, thigh, raw", "fryers"],
      ["Chicken, all classes, thigh, raw", "all classes"],
      ["Chicken, retail parts, thigh, raw", "retail parts"],
      ["Chicken, thigh, from whole bird, raw", "from whole bird"],
      ["Duck, domesticated, breast, raw", "domesticated"],
      ["Chicken, ground, raw", "ground"],
      ["Chicken, thigh, broiled", "broiled"],
      ["Chicken, pan-fried crumbles", "crumbles"],
      ["Chicken, thigh, cooked, roasted", "cooked,"],
      ["Chicken, thigh, cooked,roasted", "cooked,"],
      ["Chicken, thigh, with added solution, raw", "with added solution"],
    ])("should fail naming the fdc_id and the term when the name is %j", (name, term) => {
      expect(() => parseCuratedList(listOf(["172385", name, "", "", "1", "d", "n"]))).toThrow(
        `FDC 172385: the name ${JSON.stringify(name)} still holds the US term ${JSON.stringify(term)}`,
      );
    });

    it("should catch a term split by extra spaces, tabs or new lines", () => {
      expect(() =>
        parseCuratedList(listOf(["172385", "Chicken, all  classes, raw", "", "", "1", "d", "n"])),
      ).toThrow(/US term "all classes"/);
      expect(() =>
        parseCuratedList(listOf(["172385", "Chicken, retail\tparts, raw", "", "", "1", "d", "n"])),
      ).toThrow(/US term "retail parts"/);
      expect(() =>
        parseCuratedList(listOf(["172385", "Chicken, retail\nparts, raw", "", "", "1", "d", "n"])),
      ).toThrow(/US term "retail parts"/);
    });

    it("should accept the UK words", () => {
      expect(() =>
        parseCuratedList(
          listOf(
            ["1", "Chicken, mince, 7% fat, raw", "", "", "1", "d", "n"],
            ["2", "Chicken, thigh, grilled, meat and skin", "", "", "1", "d", "n"],
            ["3", "Background chicken, thigh, fried", "", "", "1", "d", "n"],
            ["4", "Groundnut oil, fried chicken, thigh", "", "", "1", "d", "n"],
          ),
        ),
      ).not.toThrow();
    });
  });
});
