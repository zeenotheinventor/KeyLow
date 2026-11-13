import { describe, expect, it } from "vitest";

import { fakeDatabase, turnResult } from "./helpers.ts";
import { adjustmentDraft, recipeIdOf } from "./kitchenDrafts.ts";
import { isKitchenTurn } from "./kitchenMatcher.ts";
import { fakeKitchenWorld } from "./kitchenWorldFake.ts";
import { rowDatabase } from "./rowDatabase.ts";
import { createRecipeAdjustCases } from "../cases/recipeAdjust.ts";
import {
  adjustCalledOn,
  adjustedNumbersEqualCore,
  asksFor,
  draftIsOfTheRecipe,
  everyAdjustCallRefused,
  honestRefusal,
  linesAreFrozenFromTheRecipe,
  reachesTheTarget,
} from "../cases/recipeAdjustGraders.ts";
import { perServingOf } from "../fixtures/kitchenFacts.ts";
import { OPT_IN_SET_NAMES, THRESHOLD_PERCENT } from "../src/thresholds.ts";

import type { GradeContext } from "../src/case.ts";
import type { ToolCall, TurnResult } from "../src/types.ts";
import type { AssistantRecipeDraft } from "@keylow/core";

// Nothing here asks a model: the drafts are made by core's adjustment builder over the fixture recipes, and a wrong play is
// the same draft with one thing changed.

const CHICKEN = "Eval chicken and rice";
const PORRIDGE = "Eval porridge bowl";
const draft = adjustmentDraft(CHICKEN, { nutrient: "protein_g", mode: "add", value: 30 });
const chickenId = () => Promise.resolve(recipeIdOf(CHICKEN));

const adjustCall = (
  input: Record<string, unknown> = {
    recipe_id: recipeIdOf(CHICKEN),
    nutrient: "protein_g",
    mode: "add",
    value: 30,
  },
  extra: Partial<ToolCall> = {},
): ToolCall => ({ name: "adjust_recipe", input, readOnlyHint: true, ...extra });

const turnWith = (
  recipeDraft: AssistantRecipeDraft | null = draft,
  overrides: Partial<TurnResult> = {},
) =>
  turnResult({
    ...(recipeDraft === null ? {} : { recipeDrafts: [recipeDraft] }),
    toolCalls: [
      adjustCall(
        undefined,
        recipeDraft === null ? {} : { result: { recipe: { per_serving: recipeDraft.perServing } } },
      ),
    ],
    ...overrides,
  });
const contextOf = (turn: TurnResult, database = fakeDatabase()): GradeContext => ({
  turns: [turn],
  database,
});

describe("the recipeAdjust set", () => {
  const { world } = fakeKitchenWorld();
  const cases = createRecipeAdjustCases(() => world);

  it("should be opt in, at 90 %", () => {
    expect(THRESHOLD_PERCENT.recipeAdjust).toBe(90);
    expect(OPT_IN_SET_NAMES).toContain("recipeAdjust");
    expect(cases.every(({ set }) => set === "recipeAdjust")).toBe(true);
  });

  it("should have six cases with distinct ids, one message each", () => {
    expect(cases).toHaveLength(6);
    expect(new Set(cases.map(({ id }) => id)).size).toBe(6);
    expect(cases.every(({ messages }) => messages.length === 1)).toBe(true);
  });

  it("should send only words that make a kitchen turn, so the kitchen tools are shown", async () => {
    const verdicts = await Promise.all(cases.map(({ messages }) => isKitchenTurn(messages[0])));

    expect(cases.filter((_case, index) => !verdicts[index]).map(({ id }) => id)).toEqual([]);
  });

  it("should ask for 30 g more protein on Eval chicken and rice in its first case", () => {
    expect(cases[0]?.id).toBe("recipe-adjust-protein-by-scaling");
    expect(cases[0]?.messages).toEqual([
      "Make my Eval chicken and rice recipe 30 g higher in protein",
    ]);
    expect(cases[0]?.mustPass).toBe(true);
  });
});

describe("adjustCalledOn", () => {
  it("should pass for the right recipe and nutrient", async () => {
    expect((await adjustCalledOn(chickenId, "protein_g")(contextOf(turnWith()))).passed).toBe(true);
  });

  it("should fail for another recipe, another nutrient or no call", async () => {
    const other = () => Promise.resolve(recipeIdOf(PORRIDGE));

    expect((await adjustCalledOn(other, "protein_g")(contextOf(turnWith()))).passed).toBe(false);
    expect((await adjustCalledOn(chickenId, "carbs_g")(contextOf(turnWith()))).passed).toBe(false);
    expect(
      (await adjustCalledOn(chickenId, "protein_g")(contextOf(turnWith(draft, { toolCalls: [] }))))
        .passed,
    ).toBe(false);
  });

  it("should fail for a call whose mode is not one the tool takes", async () => {
    const turn = turnWith(draft, {
      toolCalls: [
        adjustCall({
          recipe_id: recipeIdOf(CHICKEN),
          nutrient: "protein_g",
          mode: "boost",
          value: 30,
        }),
      ],
    });

    expect((await adjustCalledOn(chickenId, "protein_g")(contextOf(turn))).passed).toBe(false);
  });
});

describe("asksFor", () => {
  it("should pass when the call comes to what the person's words come to", async () => {
    const plus30 = asksFor(CHICKEN, "protein_g", (before) => before + 30, 0.5);

    expect((await plus30(contextOf(turnWith()))).passed).toBe(true);
  });

  it("should pass for another way of saying the same thing, setting the figure", async () => {
    const before = perServingOf(CHICKEN).protein_g ?? 0;
    const turn = turnWith(draft, {
      toolCalls: [
        adjustCall({
          recipe_id: recipeIdOf(CHICKEN),
          nutrient: "protein_g",
          mode: "set",
          value: before + 30,
        }),
      ],
    });

    expect(
      (await asksFor(CHICKEN, "protein_g", (figure) => figure + 30, 0.5)(contextOf(turn))).passed,
    ).toBe(true);
  });

  it("should fail when the call asks for less than the person did", async () => {
    const turn = turnWith(draft, {
      toolCalls: [
        adjustCall({
          recipe_id: recipeIdOf(CHICKEN),
          nutrient: "protein_g",
          mode: "add",
          value: 20,
        }),
      ],
    });

    expect(
      (await asksFor(CHICKEN, "protein_g", (before) => before + 30, 0.5)(contextOf(turn))).passed,
    ).toBe(false);
  });

  it("should accept a third as 0.67 and refuse it as a half", async () => {
    const third = asksFor(CHICKEN, "carbs_g", (before) => (before * 2) / 3, 1.5);
    const call = (value: number) =>
      turnWith(draft, {
        toolCalls: [
          adjustCall({
            recipe_id: recipeIdOf(CHICKEN),
            nutrient: "carbs_g",
            mode: "multiply",
            value,
          }),
        ],
      });

    expect((await third(contextOf(call(0.67)))).passed).toBe(true);
    expect((await third(contextOf(call(0.5)))).passed).toBe(false);
  });
});

describe("draftIsOfTheRecipe", () => {
  it("should pass when the draft changes the recipe asked about and its before figures are that recipe's", async () => {
    expect((await draftIsOfTheRecipe(CHICKEN, chickenId)(contextOf(turnWith()))).passed).toBe(true);
  });

  it("should fail for a draft of another recipe", async () => {
    const other = () => Promise.resolve(recipeIdOf(PORRIDGE));

    expect((await draftIsOfTheRecipe(CHICKEN, other)(contextOf(turnWith()))).passed).toBe(false);
  });

  it("should fail when the before figures are not the stored recipe's", async () => {
    const edited = { ...draft, before: { ...draft.before, protein_g: 10 } };

    const outcome = await draftIsOfTheRecipe(CHICKEN, chickenId)(contextOf(turnWith(edited)));

    expect(outcome.passed).toBe(false);
    expect(outcome.reason).toContain("protein_g");
  });

  it("should fail when the only draft is a suggestion", async () => {
    const suggestion = { ...draft, variant: "suggestion" as const };

    expect(
      (await draftIsOfTheRecipe(CHICKEN, chickenId)(contextOf(turnWith(suggestion)))).passed,
    ).toBe(false);
  });
});

describe("reachesTheTarget", () => {
  it("should pass for an adjusted recipe within the tolerance of the target the call asked for", async () => {
    expect((await reachesTheTarget(CHICKEN)(contextOf(turnWith()))).passed).toBe(true);
  });

  it("should fail when the figures are outside the tolerance of that target", async () => {
    const short = { ...draft, perServing: { ...draft.perServing, protein_g: 60 } };

    const outcome = await reachesTheTarget(CHICKEN)(contextOf(turnWith(short)));

    expect(outcome.passed).toBe(false);
    expect(outcome.reason).toContain("outside");
  });

  it("should fail when the draft was fitted to another target than the call asked for", async () => {
    const other = adjustmentDraft(CHICKEN, { nutrient: "protein_g", mode: "add", value: 20 });

    const outcome = await reachesTheTarget(CHICKEN)(contextOf(turnWith(other)));

    expect(outcome.passed).toBe(false);
    expect(outcome.reason).toContain("another target");
  });
});

describe("adjustedNumbersEqualCore", () => {
  it("should pass when the figures shown are core's over the frozen lines", async () => {
    expect((await adjustedNumbersEqualCore()(contextOf(turnWith()))).passed).toBe(true);
  });

  it("should fail when an after figure was changed", async () => {
    const edited = { ...draft, perServing: { ...draft.perServing, kcal: 900 } };

    const outcome = await adjustedNumbersEqualCore()(contextOf(turnWith(edited)));

    expect(outcome.passed).toBe(false);
    expect(outcome.reason).toContain("after kcal");
  });

  it.each(["kcal", "protein_g", "carbs_g", "fat_g"] as const)(
    "should fail when only the shown after %s was changed",
    async (nutrient) => {
      const edited = {
        ...draft,
        perServing: { ...draft.perServing, [nutrient]: (draft.perServing[nutrient] ?? 0) + 7 },
      };

      const outcome = await adjustedNumbersEqualCore()(contextOf(turnWith(edited)));

      expect(outcome.passed).toBe(false);
      expect(outcome.reason).toContain(`after ${nutrient}`);
    },
  );

  it.each(["kcal", "protein_g", "carbs_g", "fat_g"] as const)(
    "should fail when only the shown before %s was changed",
    async (nutrient) => {
      const edited = {
        ...draft,
        before: { ...draft.before, [nutrient]: (draft.before[nutrient] ?? 0) + 7 },
      };

      const outcome = await adjustedNumbersEqualCore()(contextOf(turnWith(edited)));

      expect(outcome.passed).toBe(false);
      expect(outcome.reason).toContain(`before ${nutrient}`);
    },
  );

  it("should fail when a line's grams no longer give the figures", async () => {
    const edited = {
      ...draft,
      ingredients: draft.ingredients.map((line, index) =>
        index === 0 ? { ...line, grams: line.grams + 40 } : line,
      ),
    };

    expect((await adjustedNumbersEqualCore()(contextOf(turnWith(edited)))).passed).toBe(false);
  });

  it("should fail when a line has no frozen ingredient to work from", async () => {
    const edited = {
      ...draft,
      ingredients: draft.ingredients.map((line) => ({ ...line, frozen: null })),
    };

    expect((await adjustedNumbersEqualCore()(contextOf(turnWith(edited)))).passed).toBe(false);
  });
});

describe("linesAreFrozenFromTheRecipe", () => {
  it("should pass when the lines are the recipe's own, frozen at their grams", async () => {
    expect((await linesAreFrozenFromTheRecipe(CHICKEN)(contextOf(turnWith()))).passed).toBe(true);
  });

  it("should fail when an ingredient of the recipe was dropped", async () => {
    const dropped = { ...draft, ingredients: draft.ingredients.slice(1) };

    expect((await linesAreFrozenFromTheRecipe(CHICKEN)(contextOf(turnWith(dropped)))).passed).toBe(
      false,
    );
  });

  it("should fail when a kept line is not frozen at the grams it had", async () => {
    const edited = {
      ...draft,
      ingredients: draft.ingredients.map((line, index) =>
        index === 0 ? { ...line, beforeGrams: 1 } : line,
      ),
    };

    expect((await linesAreFrozenFromTheRecipe(CHICKEN)(contextOf(turnWith(edited)))).passed).toBe(
      false,
    );
  });

  it("should fail when more than 3 foods were added", async () => {
    const [first] = draft.ingredients;
    if (first === undefined) {
      throw new Error("the fixture draft has no line");
    }
    const added = (index: number) => ({
      ...first,
      name: `added ${index}`,
      beforeGrams: null,
      change: "added" as const,
    });
    const edited = {
      ...draft,
      ingredients: [...draft.ingredients, added(1), added(2), added(3), added(4)],
    };

    expect((await linesAreFrozenFromTheRecipe(CHICKEN)(contextOf(turnWith(edited)))).passed).toBe(
      false,
    );
  });
});

describe("honestRefusal", () => {
  const porridgeInput = {
    recipe_id: recipeIdOf(PORRIDGE),
    nutrient: "protein_g",
    mode: "add",
    value: 30,
  };
  const target = (perServingOf(PORRIDGE).protein_g ?? 0) + 30;
  const refusal = (misses: unknown, overrides: Partial<ToolCall> = {}): ToolCall =>
    adjustCall(porridgeInput, {
      errorCode: "could_not_reach_target",
      result: { error: "could_not_reach_target", misses },
      ...overrides,
    });
  const honestMisses = [
    { nutrient: "protein_g", target, achieved: 19.59, reason: "targets_conflict" },
  ];
  const refused = (
    call: ToolCall,
    answer = "I could not reach that, and the recipe is unchanged.",
  ) => turnResult({ answer, toolCalls: [call] });

  it("should pass for a refusal with misses for core's target that are outside the tolerance, and an answer that says nothing changed", async () => {
    expect((await honestRefusal(PORRIDGE)(contextOf(refused(refusal(honestMisses))))).passed).toBe(
      true,
    );
  });

  it("should fail when a miss is within the tolerance, so the refusal was not honest", async () => {
    const within = [
      { nutrient: "protein_g", target, achieved: target - 2, reason: "targets_conflict" },
    ];

    expect((await honestRefusal(PORRIDGE)(contextOf(refused(refusal(within))))).passed).toBe(false);
  });

  it("should fail when the miss is for another target than core's", async () => {
    const other = [
      { nutrient: "protein_g", target: target + 10, achieved: 19, reason: "targets_conflict" },
    ];

    expect((await honestRefusal(PORRIDGE)(contextOf(refused(refusal(other))))).passed).toBe(false);
  });

  it("should fail with no misses, another refusal code or a draft", async () => {
    expect((await honestRefusal(PORRIDGE)(contextOf(refused(refusal([]))))).passed).toBe(false);
    expect(
      (
        await honestRefusal(PORRIDGE)(
          contextOf(refused(refusal(honestMisses, { errorCode: "timed_out" }))),
        )
      ).passed,
    ).toBe(false);
    expect(
      (
        await honestRefusal(PORRIDGE)(
          contextOf(
            turnResult({
              answer: "unchanged",
              toolCalls: [refusal(honestMisses)],
              recipeDrafts: [draft],
            }),
          ),
        )
      ).passed,
    ).toBe(false);
  });

  it("should fail when one miss is honest and another is within the tolerance", async () => {
    const mixed = [
      ...honestMisses,
      { nutrient: "protein_g", target, achieved: target - 2, reason: "targets_conflict" },
    ];

    expect((await honestRefusal(PORRIDGE)(contextOf(refused(refusal(mixed))))).passed).toBe(false);
  });

  it("should count a miss with no figure achieved as honest, because no figure is outside any tolerance", async () => {
    const noData = [{ nutrient: "protein_g", target, achieved: null, reason: "no_data" }];

    expect((await honestRefusal(PORRIDGE)(contextOf(refused(refusal(noData))))).passed).toBe(true);
  });

  it("should fail when the answer does not say the recipe was left alone", async () => {
    const outcome = await honestRefusal(PORRIDGE)(
      contextOf(refused(refusal(honestMisses), "Here you go.")),
    );

    expect(outcome.passed).toBe(false);
  });
});

describe("everyAdjustCallRefused", () => {
  it("should pass when no adjust call was accepted, and when none was made", async () => {
    expect(
      (
        await everyAdjustCallRefused()(
          contextOf(
            turnResult({ toolCalls: [adjustCall(undefined, { errorCode: "recipe_not_found" })] }),
          ),
        )
      ).passed,
    ).toBe(true);
    expect((await everyAdjustCallRefused()(contextOf(turnResult()))).passed).toBe(true);
  });

  it("should fail when a call was accepted", async () => {
    expect((await everyAdjustCallRefused()(contextOf(turnWith()))).passed).toBe(false);
  });
});

describe("a whole case on a right and a wrong play", () => {
  const caseOf = (id: string, fingerprints: string[] = ["same", "same"]) => {
    const fake = fakeKitchenWorld(fingerprints);
    const found = createRecipeAdjustCases(() => fake.world).find(
      (candidate) => candidate.id === id,
    );
    if (found === undefined) {
      throw new Error("the case is missing");
    }
    return found;
  };
  const failures = async (
    found: ReturnType<typeof caseOf>,
    turn: TurnResult,
    rows: Record<string, readonly Record<string, unknown>[]> = {},
  ) => {
    await found.prepare?.();
    const database = rowDatabase(rows);
    return (
      await Promise.all(found.expect.map((grader) => grader({ turns: [turn], database })))
    ).filter(({ passed }) => !passed);
  };
  const opusRow = (turn: TurnResult) => ({
    turn_id: turn.turnId,
    route: "recipe_generate",
    model: "claude-opus-5-5",
  });

  it("should pass the scaling case for a right play with no Opus row", async () => {
    expect(await failures(caseOf("recipe-adjust-protein-by-scaling"), turnWith())).toEqual([]);
  });

  it("should fail the scaling case when an Opus call was made, because scaling reaches it", async () => {
    const turn = turnWith();

    const missed = await failures(caseOf("recipe-adjust-protein-by-scaling"), turn, {
      assistant_usage: [opusRow(turn)],
    });

    expect(missed.map(({ reason }) => reason).join(" ")).toContain("recipe_generate rows");
  });

  it("should fail the scaling case when the original recipe was changed", async () => {
    const missed = await failures(
      caseOf("recipe-adjust-protein-by-scaling", ["before", "after"]),
      turnWith(),
    );

    expect(missed.map(({ reason }) => reason).join(" ")).toContain("changed, added or archived");
  });

  it("should fail the scaling case when update_recipe or create_recipe was called", async () => {
    const turn = turnWith(draft, {
      toolCalls: [adjustCall(), { name: "update_recipe", input: {}, readOnlyHint: false }],
    });

    expect(
      (await failures(caseOf("recipe-adjust-protein-by-scaling"), turn)).length,
    ).toBeGreaterThan(0);
  });

  it("should fail the scaling case when the adjusted protein does not reach the target", async () => {
    const short = { ...draft, perServing: { ...draft.perServing, protein_g: 60 } };

    expect(
      (await failures(caseOf("recipe-adjust-protein-by-scaling"), turnWith(short))).length,
    ).toBeGreaterThan(0);
  });

  it("should pass the porridge case for an honest refusal with no draft and fail it for a refusal that misses core's target", async () => {
    const found = caseOf("recipe-adjust-protein-porridge");
    const input = {
      recipe_id: recipeIdOf(PORRIDGE),
      nutrient: "protein_g",
      mode: "add",
      value: 30,
    };
    const target = (perServingOf(PORRIDGE).protein_g ?? 0) + 30;
    const refusal = (reportedTarget: number) =>
      turnResult({
        answer: "I could not reach that, so the recipe is unchanged.",
        toolCalls: [
          adjustCall(input, {
            errorCode: "could_not_reach_target",
            result: {
              error: "could_not_reach_target",
              misses: [{ nutrient: "protein_g", target: reportedTarget, achieved: 19.59 }],
            },
          }),
        ],
      });

    expect(await failures(found, refusal(target))).toEqual([]);
    expect((await failures(found, refusal(target + 5))).length).toBeGreaterThan(0);
  });

  it("should pass the unknown recipe case when nothing was drafted and fail it when a draft was shown", async () => {
    const found = caseOf("recipe-adjust-no-such-recipe");
    const refused = turnResult({
      toolCalls: [adjustCall(undefined, { errorCode: "recipe_not_found" })],
    });

    expect(await failures(found, refused)).toEqual([]);
    expect((await failures(found, turnWith())).length).toBeGreaterThan(0);
  });
});
