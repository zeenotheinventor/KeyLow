import { describe, expect, it } from "vitest";

import { fakeDatabase, turnResult } from "./helpers.ts";
import { foodRows, suggestionDraft } from "./kitchenDrafts.ts";
import { isKitchenTurn } from "./kitchenMatcher.ts";
import { fakeKitchenWorld } from "./kitchenWorldFake.ts";
import { rowDatabase } from "./rowDatabase.ts";
import { noAvoidedFood } from "../cases/kitchenGraders.ts";
import { createRecipeSuggestCases } from "../cases/recipeSuggest.ts";
import {
  allLinesMatched,
  fitTargetIs,
  honestMiss,
  matchedLinesAreRealFoods,
  noMeatOrFish,
  shownNumbersEqualCore,
  suggestCalledWith,
  suggestWordsMatch,
  usesUsualFoods,
} from "../cases/recipeSuggestGraders.ts";
import { palatePreferences } from "../fixtures/palateProfile.ts";
import { OPT_IN_SET_NAMES, THRESHOLD_PERCENT } from "../src/thresholds.ts";

import type { GradeContext } from "../src/case.ts";
import type { EvalDatabase, ToolCall, TurnResult } from "../src/types.ts";
import type { AssistantRecipeDraft } from "@keylow/core";

// Nothing here asks a model: drafts are made by core's builders over the fixture foods, and wrong plays are the same drafts
// with one thing changed.

const draft = suggestionDraft();
const database: EvalDatabase = rowDatabase({ foods: foodRows });
const call = (input: Record<string, unknown>, extra: Partial<ToolCall> = {}): ToolCall => ({
  name: "suggest_recipe",
  input,
  readOnlyHint: true,
  ...extra,
});
const turnWith = (
  recipeDraft: AssistantRecipeDraft | null = draft,
  overrides: Partial<TurnResult> = {},
) =>
  turnResult({
    ...(recipeDraft === null ? {} : { recipeDrafts: [recipeDraft] }),
    toolCalls: [
      call(
        { kcal: 650, protein_g: 45, words: "a dinner with chicken" },
        recipeDraft === null ? {} : { result: { recipe: { per_serving: recipeDraft.perServing } } },
      ),
    ],
    ...overrides,
  });
const grade = (
  grader: (context: GradeContext) => Promise<{ passed: boolean; reason: string }>,
  turn: TurnResult,
  db = database,
) => grader({ turns: [turn], database: db });

describe("the recipeSuggest set", () => {
  const { world } = fakeKitchenWorld();
  const cases = createRecipeSuggestCases(() => world);

  it("should be opt in, at 90 %", () => {
    expect(THRESHOLD_PERCENT.recipeSuggest).toBe(90);
    expect(OPT_IN_SET_NAMES).toContain("recipeSuggest");
    expect(cases.every(({ set }) => set === "recipeSuggest")).toBe(true);
  });

  it("should have ten cases with distinct ids, one message each", () => {
    expect(cases).toHaveLength(10);
    expect(new Set(cases.map(({ id }) => id)).size).toBe(10);
    expect(cases.every(({ messages }) => messages.length === 1)).toBe(true);
  });

  it("should send only words that make a kitchen turn, so the kitchen tools are shown", async () => {
    const verdicts = await Promise.all(cases.map(({ messages }) => isKitchenTurn(messages[0])));

    expect(cases.filter((_case, index) => !verdicts[index]).map(({ id }) => id)).toEqual([]);
  });

  it("should make the ticket's case, 650 kcal and 45 g protein, a must-pass case", () => {
    const ticketCase = cases.find(({ id }) => id === "recipe-suggest-650-45");

    expect(ticketCase?.messages).toEqual(["Suggest a dinner around 650 kcal with 45 g protein"]);
    expect(ticketCase?.mustPass).toBe(true);
  });
});

describe("suggestCalledWith", () => {
  it("should pass when the tool was called with the figures asked for", async () => {
    expect((await grade(suggestCalledWith({ kcal: 650, protein_g: 45 }), turnWith())).passed).toBe(
      true,
    );
  });

  it("should fail for other figures, an extra figure that was not named, or no call", async () => {
    expect((await grade(suggestCalledWith({ kcal: 700, protein_g: 45 }), turnWith())).passed).toBe(
      false,
    );
    expect(
      (await grade(suggestCalledWith({ kcal: 650, protein_g: 45, carbs_g: 60 }), turnWith()))
        .passed,
    ).toBe(false);
    expect(
      (await grade(suggestCalledWith({ kcal: 650 }), turnWith(draft, { toolCalls: [] }))).passed,
    ).toBe(false);
  });
});

describe("matchedLinesAreRealFoods", () => {
  it("should pass when every matched line is a food the user can read, under its own name", async () => {
    const outcome = await grade(matchedLinesAreRealFoods(), turnWith());

    expect(outcome.passed).toBe(true);
    expect(outcome.reason).toContain("4 matched lines are real foods");
  });

  it("should pass for a line shown unmatched with no food name, and count it", async () => {
    const outcome = await grade(
      matchedLinesAreRealFoods(),
      turnWith(suggestionDraft({ extraLines: [{ name: "dragon fruit" }] })),
    );

    expect(outcome.passed).toBe(true);
    expect(outcome.reason).toContain("1 lines are shown unmatched");
  });

  it("should fail when a matched line points at a food the user cannot read", async () => {
    const outcome = await grade(
      matchedLinesAreRealFoods(),
      turnWith(),
      rowDatabase({ foods: foodRows.filter((row) => !row.id.endsWith("07")) }),
    );

    expect(outcome.passed).toBe(false);
    expect(outcome.reason).toContain("1 matched lines are not real foods");
  });

  it("should fail when a line names a food other than the one its row holds", async () => {
    const renamed = {
      ...draft,
      ingredients: draft.ingredients.map((line, index) =>
        index === 0 ? { ...line, foodName: "Something else" } : line,
      ),
    };

    expect((await grade(matchedLinesAreRealFoods(), turnWith(renamed))).passed).toBe(false);
  });

  it("should fail when a line with no food still names one", async () => {
    const invented = {
      ...draft,
      ingredients: draft.ingredients.map((line, index) =>
        index === 0 ? { ...line, foodId: null } : line,
      ),
    };

    const outcome = await grade(matchedLinesAreRealFoods(), turnWith(invented));

    expect(outcome.passed).toBe(false);
    expect(outcome.reason).toContain("1 unmatched lines name a food");
  });
});

describe("allLinesMatched", () => {
  it("should pass when every ingredient resolved to a food", async () => {
    expect((await grade(allLinesMatched(), turnWith())).passed).toBe(true);
  });

  it("should fail when an ingredient matched no food", async () => {
    const outcome = await grade(
      allLinesMatched(),
      turnWith(suggestionDraft({ extraLines: [{ name: "dragon fruit" }] })),
    );

    expect(outcome.passed).toBe(false);
    expect(outcome.reason).toContain("1 of 5");
  });
});

describe("shownNumbersEqualCore", () => {
  it("should pass for a draft whose figures are core's over the real foods and the grams shown", async () => {
    expect((await grade(shownNumbersEqualCore(), turnWith())).passed).toBe(true);
  });

  it("should leave an unmatched line out of the figures, as the draft does", async () => {
    const outcome = await grade(
      shownNumbersEqualCore(),
      turnWith(suggestionDraft({ extraLines: [{ name: "dragon fruit" }] })),
    );

    expect(outcome.passed).toBe(true);
  });

  it("should fail when a figure was changed", async () => {
    const edited = { ...draft, perServing: { ...draft.perServing, protein_g: 50 } };

    const outcome = await grade(shownNumbersEqualCore(), turnWith(edited));

    expect(outcome.passed).toBe(false);
    expect(outcome.reason).toContain("protein_g");
  });

  it.each(["kcal", "protein_g", "carbs_g", "fat_g"] as const)(
    "should fail when only the shown %s was changed",
    async (nutrient) => {
      const edited = {
        ...draft,
        perServing: { ...draft.perServing, [nutrient]: (draft.perServing[nutrient] ?? 0) + 7 },
      };

      const outcome = await grade(shownNumbersEqualCore(), turnWith(edited));

      expect(outcome.passed).toBe(false);
      expect(outcome.reason).toContain(nutrient);
    },
  );

  it("should fail when the grams of a line no longer add up to the figures", async () => {
    const edited = {
      ...draft,
      ingredients: draft.ingredients.map((line, index) =>
        index === 1 ? { ...line, grams: line.grams + 50 } : line,
      ),
    };

    expect((await grade(shownNumbersEqualCore(), turnWith(edited))).passed).toBe(false);
  });

  it("should fail when a line cannot be rebuilt because its food is not readable", async () => {
    const outcome = await grade(shownNumbersEqualCore(), turnWith(), rowDatabase({ foods: [] }));

    expect(outcome.passed).toBe(false);
    expect(outcome.reason).toContain("could not be rebuilt");
  });
});

describe("fitTargetIs", () => {
  it("should pass when the draft was fitted to the figures asked for and fail for others", async () => {
    expect((await grade(fitTargetIs({ kcal: 650, protein_g: 45 }), turnWith())).passed).toBe(true);
    expect((await grade(fitTargetIs({ kcal: 650, protein_g: 50 }), turnWith())).passed).toBe(false);
    expect(
      (await grade(fitTargetIs({ kcal: 650, protein_g: 45, carbs_g: 60 }), turnWith())).passed,
    ).toBe(false);
  });
});

describe("honestMiss", () => {
  const reachable = suggestionDraft({ target: { kcal: 300, protein_g: 80 } });

  it("should pass for a draft whose fit says it missed and core agrees", async () => {
    expect(reachable.fit?.status).toBe("unreachable");

    const outcome = await grade(honestMiss({ kcal: 300, protein_g: 80 }), turnWith(reachable));

    expect(outcome.passed).toBe(true);
  });

  it("should fail for a draft that says it is within", async () => {
    expect((await grade(honestMiss({ kcal: 650, protein_g: 45 }), turnWith())).passed).toBe(false);
  });

  it("should fail when the fit says it missed and core finds the figures within", async () => {
    const claimsMiss = {
      ...draft,
      fit:
        draft.fit === null
          ? null
          : {
              ...draft.fit,
              status: "unreachable" as const,
              misses: [
                {
                  nutrient: "protein_g" as const,
                  target: 45,
                  achieved: 48.7,
                  reason: "targets_conflict" as const,
                  limitedBy: [],
                },
              ],
            },
    };

    expect(
      (await grade(honestMiss({ kcal: 650, protein_g: 45 }), turnWith(claimsMiss))).passed,
    ).toBe(false);
  });
});

describe("noMeatOrFish", () => {
  it("should fail for a draft with chicken in it, and pass for one without meat or fish", async () => {
    expect((await grade(noMeatOrFish(), turnWith())).passed).toBe(false);

    const vegetarian: AssistantRecipeDraft = {
      ...draft,
      ingredients: draft.ingredients.filter(
        ({ foodName }) => !(foodName ?? "").startsWith("Chicken"),
      ),
    };
    const outcome = await grade(noMeatOrFish(), turnWith(vegetarian));

    expect(outcome.passed).toBe(true);
  });
});

describe("usesUsualFoods", () => {
  const usual = new Set([
    "Chicken, breast, grilled without skin, meat only",
    "Rice, white, long grain, boiled in unsalted water",
  ]);

  it("should count the distinct usual foods of the draft against the minimum", async () => {
    expect(
      (
        await grade(
          usesUsualFoods(() => usual, 2),
          turnWith(),
        )
      ).passed,
    ).toBe(true);
    expect(
      (
        await grade(
          usesUsualFoods(() => usual, 3),
          turnWith(),
        )
      ).passed,
    ).toBe(false);
    expect(
      (
        await grade(
          usesUsualFoods(() => new Set(), 1),
          turnWith(),
        )
      ).passed,
    ).toBe(false);
  });
});

describe("suggestWordsMatch", () => {
  it("should pass when the person's wishes reached the tool in the words and fail when they did not", async () => {
    expect((await grade(suggestWordsMatch(/chicken/i), turnWith())).passed).toBe(true);
    expect((await grade(suggestWordsMatch(/fish/i), turnWith())).passed).toBe(false);
    expect(
      (
        await grade(
          suggestWordsMatch(/chicken/i),
          turnWith(draft, { toolCalls: [call({ kcal: 1 })] }),
        )
      ).passed,
    ).toBe(false);
  });
});

describe("a whole case on a right and a wrong play", () => {
  const ticketCase = () => {
    const { world, calls } = fakeKitchenWorld(["same", "same"]);
    const found = createRecipeSuggestCases(() => world).find(
      ({ id }) => id === "recipe-suggest-650-45",
    );
    if (found === undefined) {
      throw new Error("the case is missing");
    }
    return { found, calls };
  };
  const usageOf = (turn: TurnResult) => ({
    turn_id: turn.turnId,
    route: "recipe_generate",
    model: "claude-opus-5-5",
  });
  const outcomesOf = async (turn: TurnResult, found: ReturnType<typeof ticketCase>["found"]) => {
    await found.prepare?.();
    const context = {
      turns: [turn],
      database: rowDatabase({ foods: foodRows, assistant_usage: [usageOf(turn)] }),
    };
    return Promise.all(found.expect.map((grader) => grader(context)));
  };

  it("should pass every grader of the 650 kcal case for a right play, after reading the world and the recipes", async () => {
    const { found, calls } = ticketCase();

    const outcomes = await outcomesOf(turnWith(), found);

    expect(outcomes.filter(({ passed }) => !passed)).toEqual([]);
    expect(calls).toEqual(["ensureWorld", "recipesFingerprint", "recipesFingerprint"]);
  });

  it("should fail the case when the draft's figures were changed", async () => {
    const { found } = ticketCase();
    const edited = { ...draft, perServing: { ...draft.perServing, kcal: 800 } };

    const outcomes = await outcomesOf(turnWith(edited), found);

    expect(outcomes.some(({ passed }) => !passed)).toBe(true);
  });

  it("should fail the case when the answer is a draft that misses the target", async () => {
    const { found } = ticketCase();
    const missed = suggestionDraft({ target: { kcal: 650, protein_g: 45 } });
    const lowProtein = { ...missed, perServing: { ...missed.perServing, protein_g: 20 } };

    const outcomes = await outcomesOf(turnWith(lowProtein), found);

    expect(outcomes.some(({ passed }) => !passed)).toBe(true);
  });

  it("should fail the case when a recipe was saved on the way", async () => {
    const { world } = fakeKitchenWorld(["before", "after"]);
    const found = createRecipeSuggestCases(() => world)[0];
    const turn = turnWith();
    await found?.prepare?.();

    const outcomes = await Promise.all(
      (found?.expect ?? []).map((grader) =>
        grader({
          turns: [turn],
          database: rowDatabase({ foods: foodRows, assistant_usage: [usageOf(turn)] }),
        }),
      ),
    );

    expect(
      outcomes.some(
        ({ passed, reason }) => !passed && reason.includes("changed, added or archived"),
      ),
    ).toBe(true);
  });

  it("should pass the unreachable case for an honest miss and fail it for a draft that claims it fits", async () => {
    const { world } = fakeKitchenWorld();
    const found = createRecipeSuggestCases(() => world).find(
      ({ id }) => id === "recipe-suggest-unreachable",
    );
    const miss = suggestionDraft({ target: { kcal: 300, protein_g: 80 } });
    const play = async (recipeDraft: AssistantRecipeDraft, answer: string) => {
      const turn = turnResult({
        recipeDrafts: [recipeDraft],
        answer,
        toolCalls: [
          call(
            { kcal: 300, protein_g: 80 },
            { result: { recipe: { per_serving: recipeDraft.perServing } } },
          ),
        ],
      });
      await found?.prepare?.();
      return Promise.all(
        (found?.expect ?? []).map((grader) =>
          grader({
            turns: [turn],
            database: rowDatabase({ foods: foodRows, assistant_usage: [usageOf(turn)] }),
          }),
        ),
      );
    };

    const honest = await play(miss, "That came out close but could not reach 80 g.");
    const boasting = await play(draft, "Here it is.");

    expect(honest.filter(({ passed }) => !passed)).toEqual([]);
    expect(boasting.some(({ passed }) => !passed)).toBe(true);
  });

  it("should pass the avoided-food case for no recipe and for a clean recipe, and fail it for one with peanuts in it", async () => {
    const { world } = fakeKitchenWorld();
    const found = createRecipeSuggestCases(() => world).find(
      ({ id }) => id === "recipe-suggest-avoided-never-appears",
    );
    const play = async (recipeDraft: AssistantRecipeDraft | null, withRow: boolean) => {
      const turn = turnResult({ ...(recipeDraft === null ? {} : { recipeDrafts: [recipeDraft] }) });
      await found?.prepare?.();
      return Promise.all(
        (found?.expect ?? []).map((grader) =>
          grader({
            turns: [turn],
            database: rowDatabase({
              foods: foodRows,
              assistant_usage: withRow ? [usageOf(turn)] : [],
            }),
          }),
        ),
      );
    };

    expect((await play(null, false)).filter(({ passed }) => !passed)).toEqual([]);
    expect((await play(draft, true)).filter(({ passed }) => !passed)).toEqual([]);
    expect(
      (await play({ ...draft, name: "Peanut chicken" }, true)).some(({ passed }) => !passed),
    ).toBe(true);
  });

  it("should pass the no-figures case for a question and fail it when the tool was called with invented figures", async () => {
    const { world } = fakeKitchenWorld();
    const found = createRecipeSuggestCases(() => world).find(
      ({ id }) => id === "recipe-suggest-asks-for-figures",
    );
    const play = async (turn: TurnResult) => {
      await found?.prepare?.();
      return Promise.all(
        (found?.expect ?? []).map((grader) => grader({ turns: [turn], database: fakeDatabase() })),
      );
    };

    const asked = await play(turnResult({ status: "clarify" }));
    const invented = await play(
      turnResult({ toolCalls: [call({ kcal: 600, protein_g: 40 })], recipeDrafts: [draft] }),
    );

    expect(asked.filter(({ passed }) => !passed)).toEqual([]);
    expect(invented.some(({ passed }) => !passed)).toBe(true);
  });
});

describe("noAvoidedFood and the matched food", () => {
  it("should fail when the line's name is clean and the food it matched is an avoided one", async () => {
    const [first, ...rest] = draft.ingredients;
    if (first === undefined) {
      throw new Error("the fixture draft has no line");
    }
    const satay = { ...first, name: "satay sauce", foodName: "Peanut butter, smooth" };
    const outcome = await noAvoidedFood(palatePreferences())({
      turns: [turnWith({ ...draft, ingredients: [satay, ...rest] })],
      database,
    });

    expect(outcome.passed).toBe(false);
  });
});

describe("the avoided-food case when the tool refuses after its Opus call", () => {
  const found = () => {
    const { world } = fakeKitchenWorld();
    const evalCase = createRecipeSuggestCases(() => world).find(
      ({ id }) => id === "recipe-suggest-avoided-never-appears",
    );
    if (evalCase === undefined) {
      throw new Error("the case is missing");
    }
    return evalCase;
  };
  const play = async (code: string | undefined, rows: number) => {
    const evalCase = found();
    const turn = turnResult({
      toolCalls: [
        call({ kcal: 600, protein_g: 40 }, code === undefined ? {} : { errorCode: code }),
      ],
    });
    await evalCase.prepare?.();
    const usage = Array.from({ length: rows }, () => ({
      turn_id: turn.turnId,
      route: "recipe_generate",
      model: "claude-opus-5-5",
    }));
    const outcomes = await Promise.all(
      evalCase.expect.map((grader) =>
        grader({ turns: [turn], database: rowDatabase({ assistant_usage: usage }) }),
      ),
    );
    return outcomes.filter(({ passed }) => !passed);
  };

  it.each(["recipe_mentions_avoided", "nothing_matched"])(
    "should pass a %s refusal that left one Opus row",
    async (code) => {
      expect(await play(code, 1)).toEqual([]);
    },
  );

  it("should fail a refusal for another reason, and a tool that did not refuse and drafted nothing", async () => {
    expect((await play("timed_out", 1)).length).toBeGreaterThan(0);
    expect((await play(undefined, 1)).length).toBeGreaterThan(0);
  });

  it("should fail a refusal that left two Opus rows", async () => {
    expect((await play("recipe_mentions_avoided", 2)).length).toBeGreaterThan(0);
  });
});
