// The mealPlan set (KEY-1038, M9 plan section 8): "Plan my meals for the next 7 days" through the real stack, with
// `ASSISTANT_KITCHEN=1` on the served functions (the workflow's `kitchen` input). It is opt in (`--set mealPlan`) at 90 %,
// because each case makes an Opus call for the ranking, and a replan with new words makes one more.
//
// Every case is graded in code, never by a model. The plan the turn saved is found through the turn's own
// `assistant_actions` row. What a plan must satisfy: it covers the days asked for, each day is planned to the person's
// target for its weekday and is within core's tolerance or reported short as core finds it, no recipe appears more often
// than the repeat limit allows (leftovers count), no avoided food is in it, and the ranking left one Opus `plan_generate`
// row. The two buttons of the Plan screen are pressed by the harness between turns, as the app does it
// (`KitchenWorld.confirmDay` and `addPlanToList`), and the diary and the list are then compared with core. A replan
// leaves every other day as it was (`dayFingerprint`), and one with no new words makes no Opus call.
//
// Each case starts from no plans and an empty list, and puts them back, with the entries a confirmation wrote
// (`KitchenWorld.clearPlanning`), so no case reads another's plan and no diary day of another set is left changed.
import { lastTurnComplete, recipeBookGuard } from "./kitchenGraders.ts";
import {
  confirmedDayWroteTheRightEntries,
  daysMeetTheirTargets,
  leftoversAreLinked,
  planGenerationRows,
  planHasNoAvoidedFood,
  planSaved,
  repeatLimitHeld,
  replanGuard,
  shoppingListMatchesCore,
  toolCalledInTurnWith,
  toolNotCalledInTurn,
} from "./mealPlanGraders.ts";
import { kitchenWorldHolder } from "../src/kitchenWorld.ts";

import type { EvalCase, Grader } from "../src/case.ts";
import type { KitchenWorld } from "../src/kitchenWorld.ts";

type World = () => KitchenWorld;

const SEVEN_DAYS = "Plan my meals for the next 7 days";
const THREE_DAYS = "Plan my meals for the next 3 days";

/**
 * What every plan case does around its turns. `prepare` writes the world and clears any plan, entry or list row a case
 * before it left. `cleanUp` runs after the graders, and also when a turn failed.
 */
function planningGuard(world: World): {
  prepare: NonNullable<EvalCase["prepare"]>;
  cleanUp: NonNullable<EvalCase["cleanUp"]>;
  recipesUnchanged: Grader;
} {
  const recipes = recipeBookGuard({
    ensureWorld: () => world().ensureWorld(),
    recipesFingerprint: () => world().recipesFingerprint(),
  });
  return {
    prepare: async () => {
      await recipes.prepare();
      await world().clearPlanning();
    },
    cleanUp: () => world().clearPlanning(),
    recipesUnchanged: recipes.unchanged,
  };
}

/** What a plan of `dayCount` days must be, whatever the person asked: the checks that need no knowledge of the case. */
const planIsSound = (world: World, dayCount: number, turnIndex = 0): Grader[] => [
  planSaved(world, turnIndex, dayCount),
  daysMeetTheirTargets(world, turnIndex),
  leftoversAreLinked(world, turnIndex),
  planHasNoAvoidedFood(world, turnIndex),
  planGenerationRows(1, 1, [turnIndex]),
];

export function createMealPlanCases(world: World): EvalCase[] {
  const planned = (
    id: string,
    message: string,
    dayCount: number,
    extra: () => Grader[],
    mustPass = false,
  ): EvalCase => {
    const { prepare, cleanUp, recipesUnchanged } = planningGuard(world);
    return {
      id,
      set: "mealPlan",
      prepare,
      cleanUp,
      messages: [message],
      expect: [
        lastTurnComplete(),
        toolCalledInTurnWith(0, "plan_meals", () => true, "once the person asked for a plan"),
        ...planIsSound(world, dayCount),
        ...extra(),
        recipesUnchanged,
      ],
      ...(mustPass ? { mustPass: true as const } : {}),
    };
  };

  // Nothing said about repeats: the starting limit of 2 applies, and the model is told so.
  const defaultLimit = planned(
    "meal-plan-seven-days-default-limit",
    SEVEN_DAYS,
    7,
    () => [repeatLimitHeld(world, 0, { maxRepeats: 2, chosenBy: "default" })],
    true,
  );

  // "No limit" is a choice (Zee, 2026-11-13), passed as 0 and stored as a plan with no limit.
  const noLimit = planned(
    "meal-plan-no-limit",
    `${SEVEN_DAYS}. I don't mind eating the same thing again and again, so there is no limit on repeats.`,
    7,
    () => [
      toolCalledInTurnWith(0, "plan_meals", (input) => input["max_repeats"] === 0, "with no limit"),
      repeatLimitHeld(world, 0, { maxRepeats: null, chosenBy: "request" }),
    ],
  );

  // A limit of 1 with leftovers on: a cook that makes two servings is two appearances, so such a recipe is never placed.
  const limitOfOne = planned(
    "meal-plan-limit-one-with-leftovers",
    `${SEVEN_DAYS}. Use each recipe only once in the week, and count leftovers as a use.`,
    7,
    () => [
      toolCalledInTurnWith(
        0,
        "plan_meals",
        (input) => input["max_repeats"] === 1,
        "with a limit of 1",
      ),
      repeatLimitHeld(world, 0, { maxRepeats: 1, chosenBy: "request" }),
    ],
  );

  // The person's allergy and dislikes are in their palate, and no planned item may be a food they name.
  const withAllergy = planned(
    "meal-plan-avoids-the-allergy-and-dislikes",
    "Plan my meals for the next 5 days. Remember I am allergic to peanuts.",
    5,
    () => [repeatLimitHeld(world, 0, { maxRepeats: 2, chosenBy: "default" })],
  );

  // Confirming the first day, as the Plan screen's button does, writes one diary entry for each planned item.
  const confirmGuard = planningGuard(world);
  const confirmDay: EvalCase = {
    id: "meal-plan-confirm-day-writes-the-diary",
    set: "mealPlan",
    prepare: confirmGuard.prepare,
    cleanUp: confirmGuard.cleanUp,
    messages: [THREE_DAYS],
    afterTurn: async ({ index }) => {
      const [first] = (await world().livePlans()).flatMap(({ days }) => days);
      if (index === 0 && first !== undefined) {
        await world().confirmDay(first.id);
      }
    },
    expect: [
      lastTurnComplete(),
      ...planIsSound(world, 3),
      confirmedDayWroteTheRightEntries(world, 0),
      confirmGuard.recipesUnchanged,
    ],
  };

  // "Add to shopping list" for the whole plan sums the ingredients of every cook once, as core does.
  const shoppingGuard = planningGuard(world);
  const shoppingList: EvalCase = {
    id: "meal-plan-shopping-list-matches-core",
    set: "mealPlan",
    prepare: shoppingGuard.prepare,
    cleanUp: shoppingGuard.cleanUp,
    messages: [THREE_DAYS],
    afterTurn: async ({ index }) => {
      const [plan] = await world().livePlans();
      const last = plan?.days.at(-1);
      if (index === 0 && plan !== undefined && last !== undefined) {
        await world().addPlanToList({ start: plan.startDate, end: last.localDate });
      }
    },
    expect: [
      lastTurnComplete(),
      ...planIsSound(world, 3),
      shoppingListMatchesCore(world, 0),
      shoppingGuard.recipesUnchanged,
    ],
  };

  // Replanning tomorrow with no new words reuses the plan's stored ranking: no Opus call, and no other day moves.
  const withoutWords = replanGuard(world);
  const withoutWordsGuard = planningGuard(world);
  const replanWithoutWords: EvalCase = {
    id: "meal-plan-replan-day-without-words",
    set: "mealPlan",
    prepare: withoutWordsGuard.prepare,
    cleanUp: withoutWordsGuard.cleanUp,
    messages: [SEVEN_DAYS, "Replan tomorrow"],
    afterTurn: withoutWords.afterTurn,
    expect: [
      lastTurnComplete(),
      ...planIsSound(world, 7),
      toolNotCalledInTurn(1, "plan_meals"),
      toolCalledInTurnWith(
        1,
        "replan_day",
        (input) => input["request"] === null,
        "with no new words",
      ),
      withoutWords.secondDayWasReplanned(1),
      withoutWords.everyOtherDayUnchanged(1),
      planGenerationRows(0, 0, [1]),
      withoutWordsGuard.recipesUnchanged,
    ],
  };

  // New words for the day cost one Opus call, and still leave every other day as it was.
  const withWords = replanGuard(world);
  const withWordsGuard = planningGuard(world);
  const replanWithWords: EvalCase = {
    id: "meal-plan-replan-day-with-new-words",
    set: "mealPlan",
    prepare: withWordsGuard.prepare,
    cleanUp: withWordsGuard.cleanUp,
    messages: [SEVEN_DAYS, "Replan tomorrow, I would like something with fish"],
    afterTurn: withWords.afterTurn,
    expect: [
      lastTurnComplete(),
      ...planIsSound(world, 7),
      toolNotCalledInTurn(1, "plan_meals"),
      toolCalledInTurnWith(
        1,
        "replan_day",
        ({ request }) => typeof request === "string" && request.trim() !== "",
        "with the person's new words",
      ),
      withWords.secondDayWasReplanned(1),
      withWords.everyOtherDayUnchanged(1),
      planGenerationRows(1, 1, [1]),
      withWordsGuard.recipesUnchanged,
    ],
  };

  return [
    defaultLimit,
    noLimit,
    limitOfOne,
    withAllergy,
    confirmDay,
    shoppingList,
    replanWithoutWords,
    replanWithWords,
  ];
}

export const mealPlanCases: readonly EvalCase[] = createMealPlanCases(() =>
  kitchenWorldHolder.current(),
);
