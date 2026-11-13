import { describe, expect, it } from "vitest";

import { fakeDatabase, turnResult } from "./helpers.ts";
import { foodRows, suggestionDraft } from "./kitchenDrafts.ts";
import { rowDatabase } from "./rowDatabase.ts";
import {
  answerMatches,
  fitFlagIsTrue,
  generationRows,
  generationRowsAtMost,
  lastTurnComplete,
  modelToldTheDrawnFigures,
  noAvoidedFood,
  noDraft,
  oneDraft,
  recipeBookGuard,
  soft,
  toolNotCalled,
  withinTolerance,
} from "../cases/kitchenGraders.ts";
import { palatePreferences } from "../fixtures/palateProfile.ts";

import type { GradeContext } from "../src/case.ts";
import type { ToolCall, TurnResult } from "../src/types.ts";
import type { AssistantRecipeDraft } from "@keylow/core";

// Nothing here asks a model: the graders get drafts made by core's builders, and the same drafts with one thing changed.

const draft = suggestionDraft();
const turnWith = (overrides: Partial<TurnResult> = {}) =>
  turnResult({ recipeDrafts: [draft], ...overrides });
const contextOf = (turns: TurnResult[], database = fakeDatabase()): GradeContext => ({
  turns,
  database,
});

const withPerServing = (
  base: AssistantRecipeDraft,
  perServing: Partial<AssistantRecipeDraft["perServing"]>,
): AssistantRecipeDraft => ({ ...base, perServing: { ...base.perServing, ...perServing } });

describe("lastTurnComplete", () => {
  it("should pass when the last turn ended complete", async () => {
    expect((await lastTurnComplete()(contextOf([turnWith()]))).passed).toBe(true);
  });

  it("should fail when it failed", async () => {
    const outcome = await lastTurnComplete()(contextOf([turnWith({ status: "failed" })]));

    expect(outcome.passed).toBe(false);
    expect(outcome.reason).toContain("failed");
  });
});

describe("toolNotCalled", () => {
  const call: ToolCall = { name: "suggest_recipe", input: {} };

  it("should pass when the tool was not called", async () => {
    expect((await toolNotCalled("suggest_recipe")(contextOf([turnWith()]))).passed).toBe(true);
  });

  it("should fail when it was", async () => {
    const outcome = await toolNotCalled("suggest_recipe")(
      contextOf([turnWith({ toolCalls: [call] })]),
    );

    expect(outcome.passed).toBe(false);
  });
});

describe("oneDraft and noDraft", () => {
  it("should pass for exactly one draft of the variant, and fail for none or two", async () => {
    expect((await oneDraft("suggestion")(contextOf([turnWith()]))).passed).toBe(true);
    expect((await oneDraft("suggestion")(contextOf([turnWith({ recipeDrafts: [] })]))).passed).toBe(
      false,
    );
    expect(
      (await oneDraft("suggestion")(contextOf([turnWith({ recipeDrafts: [draft, draft] })])))
        .passed,
    ).toBe(false);
    expect((await oneDraft("adjustment")(contextOf([turnWith()]))).passed).toBe(false);
  });

  it("should call a case with no draft at all a no draft, and a case with one not", async () => {
    expect((await noDraft()(contextOf([turnWith({ recipeDrafts: [] })]))).passed).toBe(true);
    expect((await noDraft()(contextOf([turnWith()]))).passed).toBe(false);
  });
});

describe("withinTolerance", () => {
  it("should pass for a draft within FIT_TOLERANCE of the target", async () => {
    // 641 kcal against 650 is within 5 %, and 48.7 g against 45 g is within 5 g.
    const outcome = await withinTolerance("suggestion", { kcal: 650, protein_g: 45 })(
      contextOf([turnWith()]),
    );

    expect(outcome.passed).toBe(true);
  });

  it("should fail for the same draft against a target it does not reach", async () => {
    const outcome = await withinTolerance("suggestion", { kcal: 650, protein_g: 60 })(
      contextOf([turnWith()]),
    );

    expect(outcome.passed).toBe(false);
  });

  it("should fail when there is no draft", async () => {
    const outcome = await withinTolerance("suggestion", { kcal: 650 })(
      contextOf([turnWith({ recipeDrafts: [] })]),
    );

    expect(outcome.passed).toBe(false);
  });
});

describe("fitFlagIsTrue", () => {
  it("should pass when the draft says within and core agrees", async () => {
    expect((await fitFlagIsTrue("suggestion")(contextOf([turnWith()]))).passed).toBe(true);
  });

  it("should fail when the draft says within and its figures are outside the tolerance", async () => {
    const lying = withPerServing(draft, { protein_g: 20 });

    const outcome = await fitFlagIsTrue("suggestion")(
      contextOf([turnWith({ recipeDrafts: [lying] })]),
    );

    expect(outcome.passed).toBe(false);
    expect(outcome.reason).toContain("says within");
  });

  it("should fail when the draft says unreachable and core finds it within", async () => {
    const modest = suggestionDraft();
    const claimsMiss: AssistantRecipeDraft = {
      ...modest,
      fit: modest.fit === null ? null : { ...modest.fit, status: "unreachable" },
    };

    const outcome = await fitFlagIsTrue("suggestion")(
      contextOf([turnWith({ recipeDrafts: [claimsMiss] })]),
    );

    expect(outcome.passed).toBe(false);
  });

  it("should fail for a draft with no fit", async () => {
    const unfitted: AssistantRecipeDraft = { ...draft, fit: null };

    expect(
      (await fitFlagIsTrue("suggestion")(contextOf([turnWith({ recipeDrafts: [unfitted] })])))
        .passed,
    ).toBe(false);
  });
});

describe("noAvoidedFood", () => {
  const preferences = palatePreferences();

  it("should pass for a draft with none of the avoided foods", async () => {
    expect((await noAvoidedFood(preferences)(contextOf([turnWith()]))).passed).toBe(true);
  });

  it.each([
    ["the name", { name: "Peanut chicken" }],
    ["a step", { steps: ["Stir in the mushrooms."] }],
    [
      "a line",
      {
        ingredients: [
          {
            name: "coriander",
            foodId: null,
            foodName: null,
            grams: 5,
            beforeGrams: null,
            kcal: null,
            change: "same" as const,
          },
        ],
      },
    ],
  ])("should fail when %s names an avoided food", async (_where, change) => {
    const outcome = await noAvoidedFood(preferences)(
      contextOf([turnWith({ recipeDrafts: [{ ...draft, ...change }] })]),
    );

    expect(outcome.passed).toBe(false);
  });
});

describe("generationRows", () => {
  const usage = (turnId: string, model = "claude-opus-5-5", route = "recipe_generate") => ({
    turn_id: turnId,
    route,
    model,
  });

  it("should pass when the case wrote the expected number of Opus rows", async () => {
    const turn = turnWith();

    const outcome = await generationRows(1)(
      contextOf([turn], rowDatabase({ assistant_usage: [usage(turn.turnId)] })),
    );

    expect(outcome.passed).toBe(true);
  });

  it("should not count the rows of other routes or of other turns", async () => {
    const turn = turnWith();

    const outcome = await generationRows(0)(
      contextOf(
        [turn],
        rowDatabase({
          assistant_usage: [
            usage(turn.turnId, "claude-haiku-5-5", "describe_or_ask"),
            usage("other"),
          ],
        }),
      ),
    );

    expect(outcome.passed).toBe(true);
  });

  it.each([
    ["none when one is expected", 1, []],
    ["two when one is expected", 1, [0, 1]],
    ["one when none is expected", 0, [0]],
  ])("should fail with %s", async (_label, expected, rows) => {
    const turn = turnWith();

    const outcome = await generationRows(expected)(
      contextOf([turn], rowDatabase({ assistant_usage: rows.map(() => usage(turn.turnId)) })),
    );

    expect(outcome.passed).toBe(false);
  });

  it("should fail when a row is not Opus 5.5", async () => {
    const turn = turnWith();

    const outcome = await generationRows(1)(
      contextOf([turn], rowDatabase({ assistant_usage: [usage(turn.turnId, "claude-haiku-5-5")] })),
    );

    expect(outcome.passed).toBe(false);
    expect(outcome.reason).toContain("not Opus 5.5");
  });

  it("should let generationRowsAtMost accept none and one and refuse two", async () => {
    const turn = turnWith();
    const rows = (count: number) =>
      rowDatabase({ assistant_usage: Array.from({ length: count }, () => usage(turn.turnId)) });

    expect((await generationRowsAtMost(1)(contextOf([turn], rows(0)))).passed).toBe(true);
    expect((await generationRowsAtMost(1)(contextOf([turn], rows(1)))).passed).toBe(true);
    expect((await generationRowsAtMost(1)(contextOf([turn], rows(2)))).passed).toBe(false);
  });
});

describe("recipeBookGuard", () => {
  const book = (fingerprints: string[]) => {
    let read = 0;
    return {
      ensureWorld: () => Promise.resolve(),
      recipesFingerprint: () => Promise.resolve(fingerprints[read++] ?? ""),
    };
  };

  it("should pass when the recipes read after the turn are the recipes read before it", async () => {
    const { prepare, unchanged } = recipeBookGuard(book(["a", "a"]));
    await prepare();

    expect((await unchanged(contextOf([turnWith()]))).passed).toBe(true);
  });

  it("should fail when a recipe was changed, added or archived", async () => {
    const { prepare, unchanged } = recipeBookGuard(book(["a", "b"]));
    await prepare();

    const outcome = await unchanged(contextOf([turnWith()]));

    expect(outcome.passed).toBe(false);
    expect(outcome.reason).toContain("changed, added or archived");
  });

  it("should fail when the recipes were never read before the case", async () => {
    const { unchanged } = recipeBookGuard(book(["a"]));

    expect((await unchanged(contextOf([turnWith()]))).passed).toBe(false);
  });
});

describe("modelToldTheDrawnFigures", () => {
  const told = (perServing: Record<string, number | null>): ToolCall => ({
    name: "suggest_recipe",
    input: {},
    result: { recipe: { per_serving: perServing } },
  });

  it("should pass when the summary the model got holds the figures the card draws", async () => {
    const turn = turnWith({ toolCalls: [told(draft.perServing)] });

    expect(
      (await modelToldTheDrawnFigures("suggest_recipe", "suggestion")(contextOf([turn]))).passed,
    ).toBe(true);
  });

  it("should fail when the model was told other figures than the card shows", async () => {
    const turn = turnWith({ toolCalls: [told({ ...draft.perServing, protein_g: 60 })] });

    const outcome = await modelToldTheDrawnFigures(
      "suggest_recipe",
      "suggestion",
    )(contextOf([turn]));

    expect(outcome.passed).toBe(false);
    expect(outcome.reason).toContain("protein_g");
  });

  it("should fail when the tool left no summary to compare", async () => {
    expect(
      (await modelToldTheDrawnFigures("suggest_recipe", "suggestion")(contextOf([turnWith()])))
        .passed,
    ).toBe(false);
  });
});

describe("answerMatches and soft", () => {
  it("should pass for an answer that matches and fail for one that does not", async () => {
    const turn = turnWith({ answer: "It came close." });

    expect((await answerMatches(/close/, "says it came close")(contextOf([turn]))).passed).toBe(
      true,
    );
    expect((await answerMatches(/short/, "says it fell short")(contextOf([turn]))).passed).toBe(
      false,
    );
  });

  it("should mark a miss as soft and leave a pass alone", async () => {
    const turn = turnWith({ answer: "It came close." });

    const missed = await soft(answerMatches(/short/, "says it fell short"))(contextOf([turn]));
    const passed = await soft(answerMatches(/close/, "says it came close"))(contextOf([turn]));

    expect(missed).toMatchObject({ passed: false, soft: true });
    expect(passed).toEqual({ passed: true, reason: "the answer says it came close" });
  });
});

// The fixture rows are used by the suggest tests, and are checked here to carry the group codes the seed gives.
describe("the fixture food rows", () => {
  it("should carry the CoFID group code of each food", () => {
    expect(foodRows.find(({ id }) => id.endsWith("07"))?.food_group).toBe("MCA");
  });
});
