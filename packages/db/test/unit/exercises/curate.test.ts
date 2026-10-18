import { describe, expect, it } from "vitest";

import { curateExercises } from "../../../scripts/exercises/curate";
import { parseOverrides } from "../../../scripts/exercises/overrides";
import { parseSourceExercises } from "../../../scripts/exercises/sourceExercise";
import { sourceExercise, sourceJson } from "../../support/sourceExercise";

const NO_OVERRIDES = "source_ref,action,muscles,note\n";
const overridesOf = (...rows: string[]): string =>
  `${NO_OVERRIDES}${rows.map((row) => `${row}\n`).join("")}`;

const lateralRaise = sourceExercise({ name: "Side Lateral Raise", primaryMuscles: ["shoulders"] });
const benchPress = sourceExercise({
  name: "Barbell Bench Press",
  primaryMuscles: ["chest"],
  secondaryMuscles: ["shoulders", "triceps"],
});
const hamstringStretch = sourceExercise({
  name: "Hamstring Stretch",
  category: "stretching",
  primaryMuscles: ["hamstrings"],
});
const sideLegRaises = sourceExercise({
  name: "Side Leg Raises",
  category: "stretching",
  primaryMuscles: ["adductors"],
});

describe("curateExercises", () => {
  it("should write the curated and excluded files sorted by source_ref", () => {
    const result = curateExercises(
      sourceJson([lateralRaise, hamstringStretch, benchPress]),
      NO_OVERRIDES,
    );

    expect(result.curatedCsv).toBe(
      [
        "source_ref,name,equipment,mechanic,muscles,override_note",
        "Barbell_Bench_Press,Barbell Bench Press,barbell,compound,chest_lower:primary:1.0;chest_upper:secondary:0.6;delt_front:secondary:0.5;triceps:secondary:0.5,",
        "Side_Lateral_Raise,Side Lateral Raise,barbell,compound,delt_side:primary:1.0,",
        "",
      ].join("\n"),
    );
    expect(result.excludedCsv).toBe(
      [
        "source_ref,name,category,reason",
        "Hamstring_Stretch,Hamstring Stretch,stretching,stretch",
        "",
      ].join("\n"),
    );
    expect(result.primaryCounts.chest_lower).toBe(1);
    expect(result.primaryCounts.delt_side).toBe(1);
    expect(result.primaryCounts.neck).toBe(0);
  });

  it("should give the same bytes whatever order the source lists the exercises in", () => {
    const first = curateExercises(
      sourceJson([lateralRaise, hamstringStretch, benchPress]),
      NO_OVERRIDES,
    );
    const second = curateExercises(
      sourceJson([benchPress, lateralRaise, hamstringStretch]),
      NO_OVERRIDES,
    );

    expect(second.curatedCsv).toBe(first.curatedCsv);
    expect(second.excludedCsv).toBe(first.excludedCsv);
  });

  it("should exclude an exercise with the same instructions as one kept before it", () => {
    const copy = { ...benchPress, id: "Copy_Of_Bench_Press", name: "Copy of bench press" };
    const result = curateExercises(sourceJson([copy, benchPress]), NO_OVERRIDES);

    expect(result.curated.map(({ sourceRef }) => sourceRef)).toEqual(["Barbell_Bench_Press"]);
    expect(result.excluded).toEqual([
      {
        sourceRef: "Copy_Of_Bench_Press",
        name: "Copy of bench press",
        category: "strength",
        reason: "duplicate of Barbell_Bench_Press",
      },
    ]);
  });

  it("should not treat two exercises with empty instructions as duplicates", () => {
    const first = sourceExercise({
      name: "Iron Cross",
      primaryMuscles: ["shoulders"],
      instructions: [],
    });
    const second = sourceExercise({
      name: "Push Press",
      primaryMuscles: ["shoulders"],
      instructions: [""],
    });

    expect(curateExercises(sourceJson([first, second]), NO_OVERRIDES).curated).toHaveLength(2);
  });

  it("should apply a map override and carry its note", () => {
    const result = curateExercises(
      sourceJson([lateralRaise]),
      overridesOf(
        'Side_Lateral_Raise,map,delt_side:primary:1.0;traps_upper:secondary:0.3,"Checked by hand, see MAPPING.md"',
      ),
    );

    expect(result.curatedCsv.split("\n")[1]).toBe(
      'Side_Lateral_Raise,Side Lateral Raise,barbell,compound,delt_side:primary:1.0;traps_upper:secondary:0.3,"Checked by hand, see MAPPING.md"',
    );
  });

  it("should keep an included exercise, mapped by the rules when the override gives no muscles", () => {
    const result = curateExercises(
      sourceJson([sideLegRaises, hamstringStretch]),
      overridesOf(
        "Side_Leg_Raises,include,,A standing hip abduction",
        "Hamstring_Stretch,include,hamstrings:primary:1.0,Kept",
      ),
    );

    expect(result.curated.map(({ sourceRef, muscles }) => [sourceRef, muscles])).toEqual([
      ["Hamstring_Stretch", [{ muscle: "hamstrings", role: "primary", weight: 1 }]],
      ["Side_Leg_Raises", [{ muscle: "adductors", role: "primary", weight: 1 }]],
    ]);
  });

  it("should exclude an exercise an exclude override names, with its note as the reason", () => {
    const result = curateExercises(
      sourceJson([lateralRaise]),
      overridesOf("Side_Lateral_Raise,exclude,,not wanted"),
    );

    expect(result.curated).toEqual([]);
    expect(result.excluded[0]?.reason).toBe("not wanted");
  });

  it.each([
    [
      "names an exercise the source lacks",
      "Missing_Exercise,exclude,,gone",
      "Missing_Exercise, which is not in the source file",
    ],
    [
      "maps an exercise the rules exclude",
      "Hamstring_Stretch,map,hamstrings:primary:1.0,x",
      "use include",
    ],
    ["includes an exercise the rules keep", "Side_Lateral_Raise,include,,x", "use map"],
  ])("should refuse an override that %s", (_case, row, message) => {
    expect(() =>
      curateExercises(sourceJson([lateralRaise, hamstringStretch]), overridesOf(row)),
    ).toThrow(message);
  });

  it("should refuse an override on an exercise that turns out to be a duplicate", () => {
    const copy = { ...lateralRaise, id: "Zz_Copy", name: "Copy" };

    expect(() =>
      curateExercises(
        sourceJson([lateralRaise, copy]),
        overridesOf("Zz_Copy,map,delt_side:primary:1.0,x"),
      ),
    ).toThrow("a duplicate of Side_Lateral_Raise");
  });

  it("should refuse a source file with two exercises under one id", () => {
    expect(() => curateExercises(sourceJson([lateralRaise, lateralRaise]), NO_OVERRIDES)).toThrow(
      "same id",
    );
  });
});

describe("parseOverrides", () => {
  it.each([
    ["the wrong header", "ref,action,muscles,note\n", "the header is not"],
    ["an empty note", `${NO_OVERRIDES}A,exclude,,\n`, "must not be empty"],
    ["an unknown action", `${NO_OVERRIDES}A,drop,,x\n`, 'action "drop"'],
    [
      "two rows for one exercise",
      `${NO_OVERRIDES}A,exclude,,x\nA,exclude,,y\n`,
      "already has an override",
    ],
    [
      "muscles on an exclude row",
      `${NO_OVERRIDES}A,exclude,abs:primary:1.0,x\n`,
      "takes no muscles",
    ],
    ["a map row without muscles", `${NO_OVERRIDES}A,map,,x\n`, "no muscle has the primary role"],
    [
      "an unknown muscle",
      `${NO_OVERRIDES}A,map,serratus:primary:1.0,x\n`,
      '"serratus" is not one of the 22',
    ],
    ["an unknown role", `${NO_OVERRIDES}A,map,abs:main:1.0,x\n`, 'role "main"'],
    ["a weight above 1", `${NO_OVERRIDES}A,map,abs:primary:2,x\n`, 'weight "2"'],
    [
      "a muscle twice",
      `${NO_OVERRIDES}A,map,abs:primary:1.0;abs:secondary:0.5,x\n`,
      "more than once",
    ],
    ["no primary", `${NO_OVERRIDES}A,map,abs:secondary:0.5,x\n`, "no muscle has the primary role"],
    ["a missing field", `${NO_OVERRIDES}A,map,abs:primary:1.0\n`, "expected 4 fields"],
  ])("should refuse %s", (_case, csv, message) => {
    expect(() => parseOverrides(csv)).toThrow(message);
  });
});

describe("parseSourceExercises", () => {
  it("should read the fields the curation uses", () => {
    expect(parseSourceExercises(sourceJson([lateralRaise]))).toEqual([lateralRaise]);
  });

  it.each([
    ["a file that is not a list", "{}", "not a JSON list"],
    [
      "an entry without an id",
      JSON.stringify([{ ...lateralRaise, id: "" }]),
      "id is not a non-empty string",
    ],
    [
      "an unknown muscle group",
      JSON.stringify([{ ...lateralRaise, primaryMuscles: ["delts"] }]),
      '"delts"',
    ],
    [
      "instructions that are not text",
      JSON.stringify([{ ...lateralRaise, instructions: [1] }]),
      "instructions",
    ],
    [
      "equipment that is a number",
      JSON.stringify([{ ...lateralRaise, equipment: 3 }]),
      "equipment",
    ],
  ])("should refuse %s", (_case, json, message) => {
    expect(() => parseSourceExercises(json)).toThrow(message);
  });
});
