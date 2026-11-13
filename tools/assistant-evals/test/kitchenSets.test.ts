import { describe, expect, it } from "vitest";

import { isKitchenTurn } from "./kitchenMatcher.ts";
import { createRunDependencies } from "../src/runDependencies.ts";
import { EVAL_SET_NAMES, OPT_IN_SET_NAMES, THRESHOLD_PERCENT } from "../src/thresholds.ts";

// The four sets of KEY-1037 are opt in, and no existing set moves.

const DEFAULT_SETS_BEFORE_KEY_1037 = [
  "ask",
  "describe",
  "redTeam",
  "compaction",
  "writes",
  "recipes",
  "trainingAdvice",
];

describe("the default run list", () => {
  it("should be the seven sets it was, with none of the kitchen sets of KEY-1037", () => {
    const defaults = EVAL_SET_NAMES.filter((name) => !OPT_IN_SET_NAMES.includes(name));

    expect(defaults).toEqual(DEFAULT_SETS_BEFORE_KEY_1037);
  });

  it("should leave the thresholds of the existing sets as they were", () => {
    const existing = {
      ask: 90,
      describe: 80,
      redTeam: 100,
      compaction: 100,
      writes: 100,
      recipes: 90,
      trainingAdvice: 90,
      trainingEdits: 90,
      trainingKnowledge: 90,
      mealEstimate: 80,
      featureRequest: 90,
      kitchenProbe: 100,
    };

    for (const [set, percent] of Object.entries(existing)) {
      expect(THRESHOLD_PERCENT).toHaveProperty(set, percent);
    }
  });
});

describe("the thresholds of the kitchen sets, from M9 plan section 8", () => {
  it.each([
    ["palate", 90],
    ["recipeSuggest", 90],
    ["recipeAdjust", 90],
    ["palateJudge", 80],
  ] as const)("should hold %s at %i %%", (set, percent) => {
    expect(THRESHOLD_PERCENT[set]).toBe(percent);
    expect(OPT_IN_SET_NAMES).toContain(set);
  });
});

describe("the registration", () => {
  const dependencies = createRunDependencies({}, () => Promise.reject(new Error("unused")));

  it.each(["palate", "recipeSuggest", "recipeAdjust", "palateJudge"])(
    "should register cases for %s",
    (set) => {
      expect(dependencies.cases.some((evalCase) => evalCase.set === set)).toBe(true);
    },
  );

  it("should register each case id once", () => {
    const ids = dependencies.cases.map(({ id }) => id);

    expect(new Set(ids).size).toBe(ids.length);
  });

  it("should give the run a judge whose tokens start at 0", () => {
    expect(dependencies.judgeTokens?.()).toBe(0);
  });

  it("should keep the red-team sets last", () => {
    expect(dependencies.cases.at(-1)?.set).toBe("redTeam");
  });
});

describe("the kitchen matcher the case messages are checked against", () => {
  it("should be the function's own list: a kitchen ask is a kitchen turn and a plain read is not", async () => {
    expect(await isKitchenTurn("Suggest a dinner around 650 kcal with 45 g protein")).toBe(true);
    expect(await isKitchenTurn("How many calories are in an apple?")).toBe(false);
  });
});
