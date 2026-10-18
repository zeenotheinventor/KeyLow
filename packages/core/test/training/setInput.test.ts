import { describe, expect, it } from "vitest";

import {
  MAX_LOAD_KG,
  MAX_REPS,
  MAX_RIR,
  MAX_RPE,
  MIN_REPS,
  MIN_RIR,
  MIN_RPE,
  parseEffortInput,
  parseLoadInput,
  parseRepsInput,
  validateSetDraft,
} from "../../src/training";

import type { SetDraft } from "../../src/training";

describe("parseLoadInput", () => {
  it("should read a kilogram load with a point or a comma, and spaces around", () => {
    expect(parseLoadInput("100", "kg")).toEqual({ ok: true, kg: 100 });
    expect(parseLoadInput(" 97.5 ", "kg")).toEqual({ ok: true, kg: 97.5 });
    expect(parseLoadInput("97,5", "kg")).toEqual({ ok: true, kg: 97.5 });
    expect(parseLoadInput(".5", "kg")).toEqual({ ok: true, kg: 0.5 });
  });

  it("should turn a pound load into kilograms in whole grams", () => {
    expect(parseLoadInput("225", "lb")).toEqual({ ok: true, kg: 102.058 });
    expect(parseLoadInput("45,5", "lb")).toEqual({ ok: true, kg: 20.638 });
  });

  it("should read a blank entry as no load, an unloaded bodyweight set", () => {
    expect(parseLoadInput("", "kg")).toEqual({ ok: true, kg: null });
    expect(parseLoadInput("   ", "lb")).toEqual({ ok: true, kg: null });
  });

  it("should accept 0 and 1000 kg, the ends of the range", () => {
    expect(parseLoadInput("0", "kg")).toEqual({ ok: true, kg: 0 });
    expect(parseLoadInput("1000", "kg")).toEqual({ ok: true, kg: 1000 });
  });

  it("should never give a negative zero", () => {
    const result = parseLoadInput("-0", "kg");

    expect(result.ok && Object.is(result.kg, 0)).toBe(true);
  });

  it("should refuse text that is not a number with load_not_a_number", () => {
    for (const text of ["abc", "1e3", "1 000", "12kg", "--5", ".", ",", "NaN", "Infinity"]) {
      expect(parseLoadInput(text, "kg")).toEqual({ ok: false, rule: "load_not_a_number" });
    }
  });

  it("should refuse a separator followed by exactly three digits, which may mean thousands", () => {
    for (const text of ["1,000", "1.000", "12,500", "999.999", " 1,000 "]) {
      expect(parseLoadInput(text, "kg")).toEqual({ ok: false, rule: "load_ambiguous_separator" });
      expect(parseLoadInput(text, "lb")).toEqual({ ok: false, rule: "load_ambiguous_separator" });
    }
  });

  it("should still read a separator with other digit counts, and a 0 before three digits", () => {
    expect(parseLoadInput("97,5", "kg")).toEqual({ ok: true, kg: 97.5 });
    expect(parseLoadInput("1,5", "kg")).toEqual({ ok: true, kg: 1.5 });
    expect(parseLoadInput("100", "kg")).toEqual({ ok: true, kg: 100 });
    expect(parseLoadInput("0.125", "kg")).toEqual({ ok: true, kg: 0.125 });
    expect(parseLoadInput(".125", "kg")).toEqual({ ok: true, kg: 0.125 });
    expect(parseLoadInput("1,25", "kg")).toEqual({ ok: true, kg: 1.25 });
    expect(parseLoadInput("1234.567", "kg")).toEqual({ ok: false, rule: "load_0_to_1000_kg" });
  });

  it("should refuse a leading plus sign, as reps and RIR do", () => {
    expect(parseLoadInput("+5", "kg")).toEqual({ ok: false, rule: "load_not_a_number" });
    expect(parseLoadInput("+5", "lb")).toEqual({ ok: false, rule: "load_not_a_number" });
  });

  it("should refuse a load outside 0 to 1000 kg with load_0_to_1000_kg", () => {
    for (const text of ["-5", "1000.1", "1800", "9".repeat(400)]) {
      expect(parseLoadInput(text, "kg")).toEqual({ ok: false, rule: "load_0_to_1000_kg" });
    }
  });

  it("should check the 0 to 1000 kg bound on the converted kilograms", () => {
    expect(parseLoadInput("2204.6", "lb")).toEqual({ ok: true, kg: 999.99 });
    expect(parseLoadInput("2204.7", "lb")).toEqual({ ok: false, rule: "load_0_to_1000_kg" });
    expect(parseLoadInput("1800", "lb")).toEqual({ ok: true, kg: 816.466 });
  });

  it("should quote no value in what it returns", () => {
    expect(JSON.stringify(parseLoadInput("1800", "kg"))).not.toContain("1800");
    expect(JSON.stringify(parseLoadInput("12kg", "kg"))).not.toContain("12");
  });
});

describe("parseRepsInput", () => {
  it("should read a whole number of reps, with spaces around", () => {
    expect(parseRepsInput("8")).toEqual({ ok: true, reps: 8 });
    expect(parseRepsInput(" 12 ")).toEqual({ ok: true, reps: 12 });
    expect(parseRepsInput("1")).toEqual({ ok: true, reps: 1 });
    expect(parseRepsInput("100")).toEqual({ ok: true, reps: 100 });
  });

  it("should refuse anything else with reps_whole_1_to_100", () => {
    for (const text of ["", "  ", "0", "101", "8.5", "8,5", "abc", "-3", "+3", "1e1"]) {
      expect(parseRepsInput(text)).toEqual({ ok: false, rule: "reps_whole_1_to_100" });
    }
  });

  it("should quote no value in what it returns", () => {
    expect(JSON.stringify(parseRepsInput("4711"))).not.toContain("4711");
  });
});

describe("parseEffortInput", () => {
  describe("in RIR mode", () => {
    it("should read a whole number from 0 to 10", () => {
      expect(parseEffortInput("2", "rir")).toEqual({ ok: true, value: 2 });
      expect(parseEffortInput(" 0 ", "rir")).toEqual({ ok: true, value: 0 });
      expect(parseEffortInput("10", "rir")).toEqual({ ok: true, value: 10 });
    });

    it("should read a blank entry as no effort measure", () => {
      expect(parseEffortInput("", "rir")).toEqual({ ok: true, value: null });
      expect(parseEffortInput("  ", "rir")).toEqual({ ok: true, value: null });
    });

    it("should refuse anything else with rir_whole_0_to_10", () => {
      for (const text of ["11", "-1", "2.5", "1,5", "x", "2.0"]) {
        expect(parseEffortInput(text, "rir")).toEqual({ ok: false, rule: "rir_whole_0_to_10" });
      }
    });
  });

  describe("in RPE mode", () => {
    it("should read 1 to 10 in steps of 0.5, with a point or a comma", () => {
      expect(parseEffortInput("8", "rpe")).toEqual({ ok: true, value: 8 });
      expect(parseEffortInput("6.5", "rpe")).toEqual({ ok: true, value: 6.5 });
      expect(parseEffortInput("6,5", "rpe")).toEqual({ ok: true, value: 6.5 });
      expect(parseEffortInput("7.0", "rpe")).toEqual({ ok: true, value: 7 });
      expect(parseEffortInput("1", "rpe")).toEqual({ ok: true, value: 1 });
      expect(parseEffortInput("10", "rpe")).toEqual({ ok: true, value: 10 });
    });

    it("should refuse a leading plus sign", () => {
      expect(parseEffortInput("+7", "rpe")).toEqual({ ok: false, rule: "rpe_1_to_10_in_halves" });
    });

    it("should read a blank entry as no effort measure", () => {
      expect(parseEffortInput("", "rpe")).toEqual({ ok: true, value: null });
    });

    it("should refuse anything else with rpe_1_to_10_in_halves", () => {
      for (const text of ["6.3", "0.5", "10.5", "0", "11", "-7", "x", "6.55"]) {
        expect(parseEffortInput(text, "rpe")).toEqual({
          ok: false,
          rule: "rpe_1_to_10_in_halves",
        });
      }
    });
  });

  it("should quote no value in what it returns", () => {
    expect(JSON.stringify(parseEffortInput("6.3", "rpe"))).not.toContain("6.3");
    expect(JSON.stringify(parseEffortInput("1234", "rir"))).not.toContain("1234");
  });
});

describe("the rule codes carry the bounds of bounds.ts", () => {
  it("should name the reps, load, RIR and RPE bounds", () => {
    expect(parseRepsInput("0")).toEqual({
      ok: false,
      rule: `reps_whole_${MIN_REPS}_to_${MAX_REPS}`,
    });
    expect(parseLoadInput("-1", "kg")).toEqual({
      ok: false,
      rule: `load_0_to_${MAX_LOAD_KG}_kg`,
    });
    expect(parseEffortInput("11", "rir")).toEqual({
      ok: false,
      rule: `rir_whole_${MIN_RIR}_to_${MAX_RIR}`,
    });
    expect(parseEffortInput("0", "rpe")).toEqual({
      ok: false,
      rule: `rpe_${MIN_RPE}_to_${MAX_RPE}_in_halves`,
    });
  });
});

describe("validateSetDraft", () => {
  const draft: SetDraft = { setType: "working", load: "100", reps: "8", rir: "2", rpe: "" };

  it("should clean a valid RIR draft", () => {
    expect(validateSetDraft(draft, { unit: "kg", effortMode: "rir" })).toEqual({
      ok: true,
      values: { setType: "working", loadKg: 100, reps: 8, rir: 2, rpe: null },
    });
  });

  it("should clean a valid RPE draft, writing only the RPE", () => {
    expect(
      validateSetDraft({ ...draft, rir: "", rpe: "6.5" }, { unit: "kg", effortMode: "rpe" }),
    ).toEqual({
      ok: true,
      values: { setType: "working", loadKg: 100, reps: 8, rir: null, rpe: 6.5 },
    });
  });

  it("should convert a pound load to kilograms", () => {
    expect(validateSetDraft({ ...draft, load: "225" }, { unit: "lb", effortMode: "rir" })).toEqual({
      ok: true,
      values: { setType: "working", loadKg: 102.058, reps: 8, rir: 2, rpe: null },
    });
  });

  it("should take a warm-up with no RIR", () => {
    expect(
      validateSetDraft({ ...draft, setType: "warmup", rir: "" }, { unit: "kg", effortMode: "rir" }),
    ).toEqual({
      ok: true,
      values: { setType: "warmup", loadKg: 100, reps: 8, rir: null, rpe: null },
    });
  });

  it("should take a bodyweight set with no load and no effort", () => {
    expect(
      validateSetDraft({ ...draft, load: "", rir: "" }, { unit: "kg", effortMode: "rir" }),
    ).toEqual({
      ok: true,
      values: { setType: "working", loadKg: null, reps: 8, rir: null, rpe: null },
    });
  });

  it("should accept RPE 6.5 and refuse RPE 6.3", () => {
    const rpeOptions = { unit: "kg", effortMode: "rpe" } as const;

    expect(validateSetDraft({ ...draft, rir: "", rpe: "6.5" }, rpeOptions).ok).toBe(true);
    expect(validateSetDraft({ ...draft, rir: "", rpe: "6.3" }, rpeOptions)).toEqual({
      ok: false,
      issues: [{ field: "rpe", rule: "rpe_1_to_10_in_halves" }],
    });
  });

  it("should refuse a set with both RIR and RPE, marking the field the setting does not use", () => {
    expect(
      validateSetDraft({ ...draft, rir: "2", rpe: "8" }, { unit: "kg", effortMode: "rir" }),
    ).toEqual({ ok: false, issues: [{ field: "rpe", rule: "effort_one_measure_only" }] });
    expect(
      validateSetDraft({ ...draft, rir: "2", rpe: "8" }, { unit: "kg", effortMode: "rpe" }),
    ).toEqual({ ok: false, issues: [{ field: "rir", rule: "effort_one_measure_only" }] });
  });

  it("should treat an other-measure field of only spaces as blank", () => {
    expect(
      validateSetDraft({ ...draft, rir: "2", rpe: "   " }, { unit: "kg", effortMode: "rir" }),
    ).toEqual({
      ok: true,
      values: { setType: "working", loadKg: 100, reps: 8, rir: 2, rpe: null },
    });
  });

  it("should list one issue for every bad field, in the order of the form", () => {
    expect(
      validateSetDraft(
        { setType: "working", load: "x", reps: "0", rir: "11", rpe: "7" },
        { unit: "kg", effortMode: "rir" },
      ),
    ).toEqual({
      ok: false,
      issues: [
        { field: "load", rule: "load_not_a_number" },
        { field: "reps", rule: "reps_whole_1_to_100" },
        { field: "rir", rule: "rir_whole_0_to_10" },
        { field: "rpe", rule: "effort_one_measure_only" },
      ],
    });
  });

  it("should leave a good field out of the issues", () => {
    expect(validateSetDraft({ ...draft, load: "1800" }, { unit: "kg", effortMode: "rir" })).toEqual(
      { ok: false, issues: [{ field: "load", rule: "load_0_to_1000_kg" }] },
    );
  });

  it("should quote no value in its issues", () => {
    const result = validateSetDraft(
      { ...draft, load: "1800", reps: "4711" },
      { unit: "kg", effortMode: "rir" },
    );

    expect(JSON.stringify(result)).not.toContain("1800");
    expect(JSON.stringify(result)).not.toContain("4711");
  });
});
