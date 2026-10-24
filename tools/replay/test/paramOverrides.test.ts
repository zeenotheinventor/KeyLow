import { DEFAULT_ENGINE_PARAMS } from "@keylow/core/engine";
import { describe, expect, it } from "vitest";

import { applyParamOverrides } from "../src/paramOverrides.ts";
import { ReplayInputError } from "../src/replayInputError.ts";

describe("applyParamOverrides", () => {
  it("should return the defaults and no overrides when none are given", () => {
    const { params, overridden } = applyParamOverrides(DEFAULT_ENGINE_PARAMS, []);

    expect(params).toStrictEqual(DEFAULT_ENGINE_PARAMS);
    expect(overridden).toStrictEqual([]);
  });

  it("should replace one value of a group", () => {
    const { params } = applyParamOverrides(DEFAULT_ENGINE_PARAMS, [
      "expenditure.processSdKcalPerWeek=60",
    ]);

    expect(params.expenditure.processSdKcalPerWeek).toBe(60);
    expect(params.expenditure.maxWeeklyChangeKcal).toBe(250);
    expect(params.trend.alpha).toBe(0.1);
  });

  it("should replace a value nested two groups down", () => {
    const { params } = applyParamOverrides(DEFAULT_ENGINE_PARAMS, [
      "expenditure.zClampKcal.max=5000",
    ]);

    expect(params.expenditure.zClampKcal).toStrictEqual({ min: 800, max: 5000 });
  });

  it("should read a decimal value", () => {
    const { params } = applyParamOverrides(DEFAULT_ENGINE_PARAMS, ["trend.alpha=0.2"]);

    expect(params.trend.alpha).toBe(0.2);
  });

  it("should apply every override when several are given, and list each as path=value", () => {
    const { params, overridden } = applyParamOverrides(DEFAULT_ENGINE_PARAMS, [
      "trend.alpha=0.2",
      "targets.roundToKcal=5",
    ]);

    expect(params.trend.alpha).toBe(0.2);
    expect(params.targets.roundToKcal).toBe(5);
    expect(overridden).toStrictEqual(["trend.alpha=0.2", "targets.roundToKcal=5"]);
  });

  it("should not change the params it was given", () => {
    applyParamOverrides(DEFAULT_ENGINE_PARAMS, ["trend.alpha=0.2"]);

    expect(DEFAULT_ENGINE_PARAMS.trend.alpha).toBe(0.1);
  });

  it("should name the path of a parameter that does not exist", () => {
    expect(() => applyParamOverrides(DEFAULT_ENGINE_PARAMS, ["expenditure.noSuchThing=1"])).toThrow(
      "--param expenditure.noSuchThing: no such parameter",
    );
  });

  it("should refuse a group, because only numbers can be overridden", () => {
    expect(() => applyParamOverrides(DEFAULT_ENGINE_PARAMS, ["trend=1"])).toThrow(
      "--param trend: not a number parameter",
    );
  });

  it("should refuse the version, which is text", () => {
    expect(() => applyParamOverrides(DEFAULT_ENGINE_PARAMS, ["version=2"])).toThrow(
      "--param version: not a number parameter",
    );
  });

  it("should name the path and not the text when the value is not a number", () => {
    expect(() => applyParamOverrides(DEFAULT_ENGINE_PARAMS, ["trend.alpha=abc"])).toThrow(
      new ReplayInputError("--param trend.alpha: the value must be a number."),
    );
  });

  it("should refuse an empty value, which Number would read as zero", () => {
    expect(() => applyParamOverrides(DEFAULT_ENGINE_PARAMS, ["trend.alpha="])).toThrow(
      "--param trend.alpha: the value must be a number",
    );
  });

  it("should refuse an override with no equals sign", () => {
    expect(() => applyParamOverrides(DEFAULT_ENGINE_PARAMS, ["trend.alpha"])).toThrow(
      "--param needs the form path=value",
    );
  });
});
