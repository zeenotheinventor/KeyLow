import { describe, expect, it } from "vitest";

import { fakeEnvironment } from "./fakeEnvironment.ts";
import { fakeDatabase, turnResult } from "./helpers.ts";
import { isKitchenTurn } from "./kitchenMatcher.ts";
import { fakeKitchenWorld } from "./kitchenWorldFake.ts";
import { rowDatabase } from "./rowDatabase.ts";
import { createPalateCases } from "../cases/palate.ts";
import {
  answerNamesAll,
  answerNamesAtLeast,
  answerNamesFirst,
  answerNamesNone,
  noInventedNumbers,
  profileMatchesCore,
  profileOfTurn,
  profileReadInTurn,
  saysAllergyIsMatchedByName,
  statesTypicalAmounts,
  toolShapeOf,
} from "../cases/palateGraders.ts";
import { seededFoods } from "../fixtures/diaryTotals.ts";
import { expectedPalateProfile, palatePreferences } from "../fixtures/palateProfile.ts";
import { OPT_IN_SET_NAMES, THRESHOLD_PERCENT } from "../src/thresholds.ts";

import type { GradeContext } from "../src/case.ts";
import type { TurnResult } from "../src/types.ts";
import type { PalateProfile } from "@keylow/core";

// Nothing here asks a model: the profile a tool answers is core's profile of the fixture, and a wrong play is that profile
// with one thing taken out or one number made up.

const ANCHOR = "2026-11-13";
const expected = expectedPalateProfile(ANCHOR);

/** What `get_palate_profile` answers: core's profile in the tool's shape, with the id the real tool adds to a recipe. */
const toolResultOf = (profile: PalateProfile) => {
  const shape = toolShapeOf(profile);
  const recipes = Array.isArray(shape["usual_recipes"]) ? shape["usual_recipes"] : [];
  return {
    ...shape,
    usual_recipes: recipes.map((recipe: object, index: number) => ({
      recipe_id: `00000000-0000-4000-8000-00000000000${index}`,
      ...recipe,
    })),
  };
};

const profileTurn = (
  answer: string,
  profile: PalateProfile = expected,
  overrides: Partial<TurnResult> = {},
) =>
  turnResult({
    answer,
    toolCalls: [
      { name: "get_palate_profile", input: {}, readOnlyHint: true, result: toolResultOf(profile) },
    ],
    ...overrides,
  });

const contextOf = (...turns: TurnResult[]): GradeContext => ({ turns, database: fakeDatabase() });

const FULL_ANSWER =
  "You eat bread, eggs, apples and broccoli on most days. Potatoes, salmon, chicken and porridge oats come up most weeks. You rarely log legumes and nuts, sweets and snacks, or drinks. You avoid peanuts (allergy), mushrooms and coriander. Allergies are matched by name only.";

describe("the palate set", () => {
  const { world } = fakeKitchenWorld();
  const cases = createPalateCases(() => world);

  it("should be opt in, at 90 %", () => {
    expect(THRESHOLD_PERCENT.palate).toBe(90);
    expect(OPT_IN_SET_NAMES).toContain("palate");
    expect(cases.every(({ set }) => set === "palate")).toBe(true);
  });

  it("should have ten cases with distinct ids", () => {
    expect(cases).toHaveLength(10);
    expect(new Set(cases.map(({ id }) => id)).size).toBe(10);
  });

  it("should send only words that make a kitchen turn, so the kitchen tools are shown", async () => {
    const turns = cases.flatMap(({ id, messages }) => messages.map((message) => ({ id, message })));
    const verdicts = await Promise.all(turns.map(({ message }) => isKitchenTurn(message)));

    expect(turns.filter((_turn, index) => !verdicts[index]).map(({ id }) => id)).toEqual([]);
  });

  it("should send the correction case two messages, the second asking for the profile again", () => {
    const correction = cases.find(({ id }) => id === "palate-correction-changes-the-next-profile");

    expect(correction?.messages).toHaveLength(2);
    expect(correction?.mustPass).toBe(true);
  });
});

describe("profileOfTurn", () => {
  it("should read the last profile of the turn without the recipe ids, and nothing for a turn that did not read it", () => {
    const seen = profileOfTurn(profileTurn("x"));

    expect(seen?.["usual_recipes"]).toEqual([
      { name: "Eval chicken and rice", typical_servings: 1 },
      { name: "Eval porridge bowl", typical_servings: 1 },
    ]);
    expect(profileOfTurn(turnResult())).toBeNull();
    expect(profileOfTurn(undefined)).toBeNull();
  });
});

describe("profileReadInTurn", () => {
  it("should pass for a turn that read the profile and fail for one that did not", async () => {
    expect((await profileReadInTurn(0)(contextOf(profileTurn("x")))).passed).toBe(true);
    expect((await profileReadInTurn(1)(contextOf(profileTurn("x"), turnResult()))).passed).toBe(
      false,
    );
  });
});

describe("profileMatchesCore", () => {
  it("should pass when the tool answered core's profile of the fixture", async () => {
    expect((await profileMatchesCore(0, () => expected)(contextOf(profileTurn("x")))).passed).toBe(
      true,
    );
  });

  it("should fail and name the fields when a planted habit is missing from the profile", async () => {
    const withoutBread: PalateProfile = {
      ...expected,
      usualFoods: expected.usualFoods.filter(({ shortName }) => shortName !== "bread"),
    };

    const outcome = await profileMatchesCore(
      0,
      () => expected,
    )(contextOf(profileTurn("x", withoutBread)));

    expect(outcome.passed).toBe(false);
    expect(outcome.reason).toContain("usual_foods");
  });

  it("should fail when the avoid list lost the allergy", async () => {
    const lost: PalateProfile = {
      ...expected,
      avoid: expected.avoid.filter(({ kind }) => kind !== "allergy"),
    };

    const outcome = await profileMatchesCore(0, () => expected)(contextOf(profileTurn("x", lost)));

    expect(outcome.passed).toBe(false);
    expect(outcome.reason).toContain("avoid");
  });

  it("should fail when the turn never read the profile", async () => {
    expect((await profileMatchesCore(0, () => expected)(contextOf(turnResult()))).passed).toBe(
      false,
    );
  });
});

describe("the answer graders", () => {
  it("should pass answerNamesAll when every planted food is named, and fail when one is not", async () => {
    const named = answerNamesAll(0, [/\bbread\b/i, /\beggs?\b/i]);

    expect((await named(contextOf(turnResult({ answer: "Bread and eggs." })))).passed).toBe(true);
    expect((await named(contextOf(turnResult({ answer: "Bread only." })))).passed).toBe(false);
  });

  it("should pass answerNamesAtLeast for enough of the patterns and fail for fewer", async () => {
    const some = answerNamesAtLeast(0, [/bread/i, /egg/i, /apple/i], 2);

    expect((await some(contextOf(turnResult({ answer: "bread and apple" })))).passed).toBe(true);
    expect((await some(contextOf(turnResult({ answer: "just bread" })))).passed).toBe(false);
  });

  it("should pass answerNamesNone for an answer without the food and fail for one that names it", async () => {
    const none = answerNamesNone(0, [/apples?/i]);

    expect((await none(contextOf(turnResult({ answer: "Bread." })))).passed).toBe(true);
    expect((await none(contextOf(turnResult({ answer: "Apples." })))).passed).toBe(false);
  });

  it("should check the turn it was given and not the last", async () => {
    const first = answerNamesAll(0, [/bread/i]);

    expect(
      (await first(contextOf(turnResult({ answer: "Bread." }), turnResult({ answer: "Nothing." }))))
        .passed,
    ).toBe(true);
  });
});

describe("noInventedNumbers", () => {
  it("should pass for numbers the profile holds, the 90 day window and an answer with none", async () => {
    const answer = "Over the last 90 days you ate about 100 g of apples, across 89 logged days.";

    expect((await noInventedNumbers(0)(contextOf(profileTurn(answer)))).passed).toBe(true);
    expect((await noInventedNumbers(0)(contextOf(profileTurn("Mostly bread.")))).passed).toBe(true);
  });

  it("should fail for a number the profile does not hold", async () => {
    const outcome = await noInventedNumbers(0)(
      contextOf(profileTurn("You eat apples 6 days a week.")),
    );

    expect(outcome.passed).toBe(false);
    expect(outcome.reason).toContain("1 numbers");
  });

  it("should fail when the profile was not read", async () => {
    expect((await noInventedNumbers(0)(contextOf(turnResult({ answer: "100 g" })))).passed).toBe(
      false,
    );
  });
});

describe("saysAllergyIsMatchedByName", () => {
  it("should pass for an answer that says so and fail for one that does not", async () => {
    expect(
      (
        await saysAllergyIsMatchedByName(0)(
          contextOf(turnResult({ answer: "Allergies are matched by name only." })),
        )
      ).passed,
    ).toBe(true);
    expect(
      (await saysAllergyIsMatchedByName(0)(contextOf(turnResult({ answer: "You avoid peanuts." }))))
        .passed,
    ).toBe(false);
  });
});

describe("whole palate cases on a right and a wrong play", () => {
  const caseOf = (id: string) => {
    const fake = fakeKitchenWorld();
    const found = createPalateCases(() => fake.world).find((candidate) => candidate.id === id);
    if (found === undefined) {
      throw new Error("the case is missing");
    }
    return { found, ...fake };
  };
  const failures = async (
    found: ReturnType<typeof caseOf>["found"],
    turns: TurnResult[],
    database = fakeDatabase(),
  ) =>
    (await Promise.all(found.expect.map((grader) => grader({ turns, database })))).filter(
      ({ passed }) => !passed,
    );

  it("should pass the usual foods case for the full answer and fail it when the apples are left out", async () => {
    const { found } = caseOf("palate-usual-foods");

    expect(await failures(found, [profileTurn(FULL_ANSWER)])).toEqual([]);
    expect(
      (await failures(found, [profileTurn("You eat bread, eggs and broccoli.")])).length,
    ).toBeGreaterThan(0);
  });

  it("should fail the usual foods case when the model states a number of days it was never told", async () => {
    const { found } = caseOf("palate-usual-foods");

    const missed = await failures(found, [
      profileTurn(`${FULL_ANSWER} You eat bread 6 days a week.`),
    ]);

    expect(missed.map(({ reason }) => reason).join(" ")).toContain(
      "numbers that are not in the profile",
    );
  });

  it("should pass the avoid case for the three items, and leave a missing word about allergies as a soft miss", async () => {
    const { found } = caseOf("palate-avoid-list");
    const bare = "You avoid peanuts, mushrooms and coriander.";

    const outcomes = await Promise.all(
      found.expect.map((grader) =>
        grader({ turns: [profileTurn(bare)], database: fakeDatabase() }),
      ),
    );
    const missed = outcomes.filter(({ passed }) => !passed);

    expect(missed).toHaveLength(1);
    expect(missed[0]).toMatchObject({ soft: true });
    expect(await failures(found, [profileTurn(FULL_ANSWER)])).toEqual([]);
  });

  it("should fail the avoid case when a dislike is not named", async () => {
    const { found } = caseOf("palate-avoid-list");

    expect(
      (
        await failures(found, [
          profileTurn("You avoid peanuts and mushrooms. Allergies are matched by name only."),
        ])
      ).length,
    ).toBeGreaterThan(0);
  });

  describe("the correction case", () => {
    const apple = seededFoods().get("apple");
    const corrected = expectedPalateProfile(ANCHOR, [
      ...palatePreferences(),
      {
        id: "correction-1",
        kind: "not_usual",
        foodId: apple?.id ?? null,
        recipeId: null,
        label: null,
      },
    ]);
    const correctionRows = rowDatabase({ palate_preferences: [{ kind: "not_usual" }] });

    it("should press not true on apples after the first turn only, and take it back in the clean up", async () => {
      const { found, calls } = caseOf("palate-correction-changes-the-next-profile");
      const environment = fakeEnvironment();
      const first = profileTurn("Apples and bread.");

      await found.afterTurn?.({ index: 0, result: first }, environment);
      await found.afterTurn?.({ index: 1, result: first }, environment);
      await found.cleanUp?.([first], environment);

      expect(calls).toEqual(["markNotUsual apple", "clearCorrections"]);
    });

    it("should pass when the second read has no apples and the answer drops them", async () => {
      const { found } = caseOf("palate-correction-changes-the-next-profile");

      const missed = await failures(
        found,
        [
          profileTurn("You eat bread, eggs, apples and broccoli."),
          profileTurn("You eat bread, eggs and broccoli.", corrected),
        ],
        correctionRows,
      );

      expect(missed).toEqual([]);
    });

    it("should fail when the second answer still names the apples", async () => {
      const { found } = caseOf("palate-correction-changes-the-next-profile");

      const missed = await failures(
        found,
        [
          profileTurn("You eat bread, eggs, apples and broccoli."),
          profileTurn("You eat bread and apples.", corrected),
        ],
        correctionRows,
      );

      expect(missed.length).toBeGreaterThan(0);
    });

    it("should fail when the second turn reused the first read and did not read the profile again", async () => {
      const { found } = caseOf("palate-correction-changes-the-next-profile");

      const missed = await failures(
        found,
        [
          profileTurn("You eat bread, eggs, apples and broccoli."),
          turnResult({ answer: "Bread and eggs." }),
        ],
        correctionRows,
      );

      expect(missed.map(({ reason }) => reason).join(" ")).toContain(
        "did not read the palate profile",
      );
    });

    it("should fail when the second read still holds the apples, so the correction changed nothing", async () => {
      const { found } = caseOf("palate-correction-changes-the-next-profile");

      const missed = await failures(
        found,
        [profileTurn("Bread, eggs, apples."), profileTurn("Bread, eggs, apples.", expected)],
        correctionRows,
      );

      expect(missed.length).toBeGreaterThan(0);
    });

    it("should fail when the harness's correction never landed as a row", async () => {
      const { found } = caseOf("palate-correction-changes-the-next-profile");

      const missed = await failures(
        found,
        [profileTurn("Bread, eggs, apples."), profileTurn("Bread, eggs.", corrected)],
        rowDatabase({ palate_preferences: [] }),
      );

      expect(missed.map(({ reason }) => reason).join(" ")).toContain(
        "no row in palate_preferences",
      );
    });
  });
});

describe("answerNamesFirst", () => {
  it("should pass when the leading food comes first and fail when another comes before it", async () => {
    const first = answerNamesFirst(0, /bread/i, /eggs?/i);

    expect((await first(contextOf(turnResult({ answer: "Bread, then eggs." })))).passed).toBe(true);
    expect((await first(contextOf(turnResult({ answer: "Eggs, then bread." })))).passed).toBe(
      false,
    );
    expect((await first(contextOf(turnResult({ answer: "Only eggs." })))).passed).toBe(false);
  });
});

describe("statesTypicalAmounts", () => {
  it("should pass when enough of the profile's typical grams are stated and fail otherwise", async () => {
    const amounts = statesTypicalAmounts(0, () => expected, 3);

    expect(
      (
        await amounts(
          contextOf(turnResult({ answer: "About 70 g bread, 110 g eggs and 100 g apples." })),
        )
      ).passed,
    ).toBe(true);
    expect(
      (await amounts(contextOf(turnResult({ answer: "About 70 g bread and 999 g eggs." })))).passed,
    ).toBe(false);
  });
});

describe("the later palate cases on a right and a wrong play", () => {
  const run = async (id: string, turn: TurnResult) => {
    const fake = fakeKitchenWorld();
    const found = createPalateCases(() => fake.world).find((candidate) => candidate.id === id);
    if (found === undefined) {
      throw new Error("the case is missing");
    }
    const outcomes = await Promise.all(
      found.expect.map((grader) => grader({ turns: [turn], database: fakeDatabase() })),
    );
    return outcomes.filter(({ passed }) => !passed);
  };

  it("should pass the breakfast case when bread leads, and fail it when eggs do", async () => {
    expect(
      await run("palate-breakfast-leads", profileTurn("Mostly bread, then eggs and apples.")),
    ).toEqual([]);
    expect(
      (await run("palate-breakfast-leads", profileTurn("Eggs, then bread."))).length,
    ).toBeGreaterThan(0);
  });

  it("should pass the portion case with the profile's grams, and fail it with made-up grams", async () => {
    expect(
      await run(
        "palate-portion-habit",
        profileTurn("Bread 70 g, eggs 110 g, apples 100 g, broccoli 80 g."),
      ),
    ).toEqual([]);
    expect(
      (await run("palate-portion-habit", profileTurn("Bread 75 g, eggs 120 g, apples 95 g.")))
        .length,
    ).toBeGreaterThan(0);
  });

  it("should pass the never-logged case when the answer says rarely, and fail it when it calls nuts usual", async () => {
    expect(
      await run(
        "palate-never-logged-food-is-rare",
        profileTurn("You rarely or never log legumes and nuts."),
      ),
    ).toEqual([]);
    expect(
      (await run("palate-never-logged-food-is-rare", profileTurn("You eat nuts most days.")))
        .length,
    ).toBeGreaterThan(0);
  });

  it("should pass the window case when the answer says 90 days, and fail it when it says another window", async () => {
    expect(
      await run("palate-window-is-90-days", profileTurn("It looks back over the last 90 days.")),
    ).toEqual([]);
    expect(
      (await run("palate-window-is-90-days", profileTurn("It looks back over the last 30 days.")))
        .length,
    ).toBeGreaterThan(0);
  });
});
