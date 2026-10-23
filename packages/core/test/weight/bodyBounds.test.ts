import { describe, expect, it } from "vitest";

import {
  BODY_FAT_MAX_PCT,
  BODY_FAT_MIN_PCT,
  LEAN_MASS_MAX_KG,
  LEAN_MASS_MIN_KG,
} from "../../src/weight";

describe("the body composition bounds", () => {
  it("should hold body fat to 1 to 75 per cent", () => {
    expect([BODY_FAT_MIN_PCT, BODY_FAT_MAX_PCT]).toStrictEqual([1, 75]);
  });

  it("should hold lean mass to 10 to 300 kg", () => {
    expect([LEAN_MASS_MIN_KG, LEAN_MASS_MAX_KG]).toStrictEqual([10, 300]);
  });
});
