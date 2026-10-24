import { readFileSync } from "node:fs";

import { describe, expect, expectTypeOf, it } from "vitest";

import { CLAMPS } from "../../src/engine";
import { capToProfileRange, PROFILE_MAX_KCAL } from "../../src/setup";

import type { Clamp } from "../../src/engine";
import type { SetupClamp } from "../../src/setup";

describe("PROFILE_MAX_KCAL", () => {
  it("should be 6000, the top of profiles_target_kcal_range", () => {
    expect(PROFILE_MAX_KCAL).toBe(6000);
  });
});

describe("SetupClamp", () => {
  it("should admit profile_max, which the engine's Clamp does not", () => {
    expectTypeOf<"profile_max">().toExtend<SetupClamp>();
    expectTypeOf<"profile_max">().not.toExtend<Clamp>();
    expect(CLAMPS).not.toContain("profile_max");
  });

  it("should admit every engine clamp", () => {
    expectTypeOf<Clamp>().toExtend<SetupClamp>();
  });
});

describe("capToProfileRange", () => {
  it("should leave calories inside the range as they are, with the clamps as they were", () => {
    expect(capToProfileRange(2410, ["floor"])).toStrictEqual({
      caloriesKcal: 2410,
      clamps: ["floor"],
    });
  });

  it("should leave exactly 6000 as it is and record nothing", () => {
    expect(capToProfileRange(6000, [])).toStrictEqual({ caloriesKcal: 6000, clamps: [] });
  });

  it("should cap 6010 at 6000 and record profile_max", () => {
    expect(capToProfileRange(6010, [])).toStrictEqual({
      caloriesKcal: 6000,
      clamps: ["profile_max"],
    });
  });

  it("should record profile_max after the clamps already recorded", () => {
    expect(capToProfileRange(7200, ["max_rate", "max_surplus"])).toStrictEqual({
      caloriesKcal: 6000,
      clamps: ["max_rate", "max_surplus", "profile_max"],
    });
  });

  it("should not change the clamps it was given", () => {
    const clamps: readonly Clamp[] = ["max_surplus"];
    capToProfileRange(7200, clamps);
    expect(clamps).toStrictEqual(["max_surplus"]);
  });
});

describe("the profileRange module", () => {
  it("should import from the engine as types only, so the engine can import it without a cycle", () => {
    const source = readFileSync(
      new URL("../../src/setup/profileRange.ts", import.meta.url),
      "utf8",
    );
    const importLines = source.split("\n").filter((line) => line.startsWith("import "));

    expect(importLines.length).toBeGreaterThan(0);
    for (const line of importLines) {
      expect(line).toMatch(/^import type /);
    }
  });
});
