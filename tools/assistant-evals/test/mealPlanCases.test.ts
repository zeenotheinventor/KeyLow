import { planDayViewsOf } from "@keylow/core/plans";
import { describe, expect, it } from "vitest";

import { fakeEnvironment } from "./fakeEnvironment.ts";
import { turnResult } from "./helpers.ts";
import { isKitchenTurn } from "./kitchenMatcher.ts";
import { fakeKitchenWorld } from "./kitchenWorldFake.ts";
import {
  MONDAY,
  planMealsCall,
  plannedWeek,
  recipeNames,
  storedPlanOf,
  withDay,
} from "./mealPlanFixtures.ts";
import { rowDatabase } from "./rowDatabase.ts";
import { createMealPlanCases } from "../cases/mealPlan.ts";
import {
  ENTRY_FIGURE_TOLERANCE,
  LIST_GRAMS_TOLERANCE,
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
} from "../cases/mealPlanGraders.ts";
import { OPT_IN_SET_NAMES, THRESHOLD_PERCENT } from "../src/thresholds.ts";

import type { EvalDatabase, ToolCall, TurnResult } from "../src/types.ts";
import type { MealPlan } from "@keylow/api-client";
import type { ShoppingItem } from "@keylow/core/shopping";

// Nothing here asks a model: a plan is core's planner over the fixture recipes, written the way the database returns it,
// and a wrong play is that plan with one thing changed.

const environment = fakeEnvironment();
const DEFAULT = { max_repeats: 2, chosen_by: "default" } as const;
const week = plannedWeek(MONDAY, 2);
const plan = storedPlanOf(week);

type Rows = Parameters<typeof rowDatabase>[0];

/** A world that holds these plans, and a database that says the turn's `plan_meals` action wrote the first of them. */
function setup(
  plans: readonly MealPlan[] = [plan],
  turn: TurnResult = turnWith(),
  rows: Rows = {},
) {
  const [first] = plans;
  const { world } = fakeKitchenWorld(undefined, { livePlans: () => Promise.resolve(plans) });
  const database: EvalDatabase = rowDatabase({
    assistant_actions: [{ turn_id: turn.turnId, tool: "plan_meals", target_id: first?.id ?? null }],
    ...rows,
  });
  return { world: () => world, database, turn };
}

function turnWith(calls: readonly ToolCall[] = [planMealsCall(week, DEFAULT)]): TurnResult {
  return turnResult({ toolCalls: calls });
}

const grade = async (
  grader: ReturnType<typeof planSaved>,
  { database, turn }: { database: EvalDatabase; turn: TurnResult },
  extraTurns: readonly TurnResult[] = [],
) => grader({ turns: [turn, ...extraTurns], database });

describe("the mealPlan set", () => {
  const { world } = fakeKitchenWorld();
  const cases = createMealPlanCases(() => world);

  it("should be opt in, at 90 %", () => {
    expect(THRESHOLD_PERCENT.mealPlan).toBe(90);
    expect(OPT_IN_SET_NAMES).toContain("mealPlan");
    expect(cases.every(({ set }) => set === "mealPlan")).toBe(true);
  });

  it("should have eight cases with distinct ids", () => {
    expect(cases).toHaveLength(8);
    expect(new Set(cases.map(({ id }) => id)).size).toBe(8);
  });

  it("should send only words that make a kitchen turn, so the kitchen tools are shown", async () => {
    const messages = cases.flatMap(({ id, messages: sent }) => sent.map((text) => ({ id, text })));
    const verdicts = await Promise.all(messages.map(({ text }) => isKitchenTurn(text)));

    expect(messages.filter((_message, index) => !verdicts[index]).map(({ id }) => id)).toEqual([]);
  });

  it("should plan a week, with the default limit, as a must-pass case", () => {
    const ticketCase = cases.find(({ id }) => id === "meal-plan-seven-days-default-limit");

    expect(ticketCase?.messages).toEqual(["Plan my meals for the next 7 days"]);
    expect(ticketCase?.mustPass).toBe(true);
  });

  it("should replan the second day, with and without new words, in a second turn", () => {
    const replans = cases.filter(({ id }) => id.startsWith("meal-plan-replan-day"));

    expect(replans.map(({ messages }) => messages.length)).toEqual([2, 2]);
    expect(replans.map(({ messages }) => messages[1])).toEqual([
      "Replan tomorrow",
      "Replan tomorrow, I would like something with fish",
    ]);
  });

  it("should clear the plans, the entries a confirmation wrote and the list before and after every case", async () => {
    const { world: recording, calls } = fakeKitchenWorld();
    const recorded = createMealPlanCases(() => recording);

    for (const evalCase of recorded) {
      calls.length = 0;
      await evalCase.prepare?.();
      await evalCase.cleanUp?.([], environment);

      expect(calls.filter((call) => call === "clearPlanning")).toHaveLength(2);
    }
  });

  it("should press Confirm day on the first day of the plan, and nothing else, after the first turn", async () => {
    const { world: recording, calls } = fakeKitchenWorld(undefined, {
      livePlans: () => Promise.resolve([plan]),
    });
    const confirm = createMealPlanCases(() => recording).find(({ id }) =>
      id.startsWith("meal-plan-confirm-day"),
    );

    await confirm?.afterTurn?.({ index: 0, result: turnWith() }, environment);

    expect(calls.filter((call) => call.startsWith("confirmDay"))).toEqual([
      `confirmDay ${plan.days[0]?.id}`,
    ]);
  });

  it("should press Add to shopping list for the whole plan after the first turn", async () => {
    const scopes: unknown[] = [];
    const { world: recording } = fakeKitchenWorld(undefined, {
      livePlans: () => Promise.resolve([plan]),
      addPlanToList: (scope) => {
        scopes.push(scope);
        return Promise.resolve();
      },
    });
    const list = createMealPlanCases(() => recording).find(({ id }) =>
      id.startsWith("meal-plan-shopping-list"),
    );

    await list?.afterTurn?.({ index: 0, result: turnWith() }, environment);

    expect(scopes).toEqual([{ start: MONDAY, end: "2026-11-22" }]);
  });
});

describe("the tolerances the graders hold the diary and the list to", () => {
  it("should allow a hundredth between an entry's figure and the planner's", () => {
    expect(ENTRY_FIGURE_TOLERANCE).toBe(0.01);
  });

  it("should allow a hundredth of a gram between a list row and core's sum", () => {
    expect(LIST_GRAMS_TOLERANCE).toBe(0.01);
  });
});

describe("planSaved", () => {
  it("should pass for one assistant plan of seven consecutive days", async () => {
    expect((await grade(planSaved(setup().world, 0, 7), setup())).passed).toBe(true);
  });

  it("should fail for another day count", async () => {
    expect((await grade(planSaved(setup().world, 0, 5), setup())).passed).toBe(false);
  });

  it("should fail when the days do not follow one another", async () => {
    const gap = withDay(plan, 3, (day) => ({ ...day, localDate: "2026-12-25" }));
    const state = setup([gap]);

    expect((await grade(planSaved(state.world, 0, 7), state)).passed).toBe(false);
  });

  it("should fail when the plan was not written by the assistant", async () => {
    const state = setup([{ ...plan, source: "app" }]);

    expect((await grade(planSaved(state.world, 0, 7), state)).passed).toBe(false);
  });

  it("should fail when the turn left no plan_meals action, or two", async () => {
    const none = setup();
    const noneDatabase = rowDatabase({});
    const twice = setup(undefined, undefined, {
      assistant_actions: [
        { turn_id: "x", tool: "plan_meals", target_id: plan.id },
        { turn_id: "x", tool: "plan_meals", target_id: plan.id },
      ],
    });
    const twiceTurn = turnResult({ turnId: "x" });

    expect(
      (await planSaved(none.world, 0, 7)({ turns: [none.turn], database: noneDatabase })).passed,
    ).toBe(false);
    expect(
      (await planSaved(twice.world, 0, 7)({ turns: [twiceTurn], database: twice.database })).passed,
    ).toBe(false);
  });

  it("should fail when the plan is no longer live, as after Undo", async () => {
    const state = setup([]);
    const database = rowDatabase({
      assistant_actions: [{ turn_id: state.turn.turnId, tool: "plan_meals", target_id: plan.id }],
    });

    expect((await planSaved(state.world, 0, 7)({ turns: [state.turn], database })).passed).toBe(
      false,
    );
  });
});

describe("daysMeetTheirTargets", () => {
  // A day cut down to one item is short of what core finds it short of. A truthful tool names exactly that.
  const shortPlan = withDay(plan, 2, (day) => ({ ...day, items: day.items.slice(0, 1) }));
  const reportOf = (
    statusOf: (status: string) => string,
    nutrients?: readonly string[],
  ): ToolCall => ({
    name: "plan_meals",
    input: {},
    result: {
      planned: true,
      repeat_limit: DEFAULT,
      days: planDayViewsOf([shortPlan]).map((view) => ({
        local_date: view.localDate,
        status: statusOf(view.status),
        short_of: (nutrients ?? view.shortfalls.map(({ nutrient }) => nutrient)).map(
          (nutrient) => ({
            nutrient,
          }),
        ),
      })),
    },
  });
  const grade2 = (planState: MealPlan, call: ToolCall = planMealsCall(week, DEFAULT)) => {
    const state = setup([planState], turnWith([call]));
    return grade(daysMeetTheirTargets(state.world, 0), state);
  };

  it("should pass for a week core finds within the tolerance on every day", async () => {
    const outcome = await grade2(plan);

    expect(outcome.passed).toBe(true);
    expect(outcome.reason).toContain("7 days within the tolerance");
  });

  it("should pass for a short day that the tool reported short with the nutrients core finds", async () => {
    const outcome = await grade2(
      shortPlan,
      reportOf((status) => status),
    );

    expect(outcome.passed).toBe(true);
    expect(outcome.reason).toContain("1 short and reported short");
  });

  it("should fail for a short day that the tool reported within", async () => {
    const outcome = await grade2(
      shortPlan,
      reportOf(() => "within"),
    );

    expect(outcome.passed).toBe(false);
    expect(outcome.reason).toContain("not reported short");
  });

  it("should fail for a short day that the tool reported short for other nutrients than core finds", async () => {
    const outcome = await grade2(
      shortPlan,
      reportOf((status) => status, ["fat_g"]),
    );

    expect(outcome.passed).toBe(false);
  });

  it("should fail for a short day when the tool gave no answer", async () => {
    expect((await grade2(shortPlan, { name: "plan_meals", input: {} })).passed).toBe(false);
  });

  it("should fail for a day planned to another target than the person's for its weekday", async () => {
    const wrong = withDay(plan, 0, (day) => ({ ...day, target: { kcal: 2000, protein_g: 90 } }));

    expect((await grade2(wrong)).passed).toBe(false);
  });

  it("should fail for a plan whose days were planned to the targets of another weekday", async () => {
    const shifted = { ...plan, startDate: "2026-11-17" };

    expect((await grade2(shifted)).passed).toBe(false);
  });

  it("should fail for a day that names a target the person did not name", async () => {
    const wrong = withDay(plan, 0, (day) => ({ ...day, target: { ...day.target, carbs_g: 150 } }));

    expect((await grade2(wrong)).passed).toBe(false);
  });

  it("should fail for a day with nothing planned", async () => {
    const outcome = await grade2(withDay(plan, 4, (day) => ({ ...day, items: [] })));

    expect(outcome.passed).toBe(false);
    expect(outcome.reason).toContain("1 days have nothing planned");
  });
});

describe("repeatLimitHeld", () => {
  it("should pass when the plan is under the default limit of 2 and the model was told so", async () => {
    const state = setup();

    expect(
      (await grade(repeatLimitHeld(state.world, 0, { maxRepeats: 2, chosenBy: "default" }), state))
        .passed,
    ).toBe(true);
  });

  it("should pass for a plan with no limit, however often a recipe repeats", async () => {
    const noLimit = storedPlanOf(plannedWeek(MONDAY, null), { maxRepeats: null });
    const state = setup(
      [noLimit],
      turnWith([planMealsCall(week, { max_repeats: null, chosen_by: "request" })]),
    );

    expect(
      (
        await grade(
          repeatLimitHeld(state.world, 0, { maxRepeats: null, chosenBy: "request" }),
          state,
        )
      ).passed,
    ).toBe(true);
  });

  it("should pass for a plan under a limit of 1 with no recipe used twice", async () => {
    const one = storedPlanOf(plannedWeek(MONDAY, 1), { maxRepeats: 1 });
    const state = setup(
      [one],
      turnWith([planMealsCall(week, { max_repeats: 1, chosen_by: "request" })]),
    );

    expect(
      (await grade(repeatLimitHeld(state.world, 0, { maxRepeats: 1, chosenBy: "request" }), state))
        .passed,
    ).toBe(true);
  });

  it("should count a leftover as a use: a cook with its leftover is over a limit of 1", async () => {
    const [cook] = recipeNames.filter((name) => name.includes("bake"));
    const twice = withDay(plan, 0, (day) => ({
      ...day,
      items: day.items.map((item) =>
        item.kind === "recipe" ? { ...item, recipeId: cook ?? "" } : item,
      ),
    }));
    const doubled = withDay(twice, 1, (day) => ({
      ...day,
      items: day.items.map((item) =>
        item.kind === "recipe" ? { ...item, recipeId: cook ?? "" } : item,
      ),
    }));
    const state = setup(
      [{ ...doubled, rules: { ...doubled.rules, maxRepeats: 1 } }],
      turnWith([planMealsCall(week, { max_repeats: 1, chosen_by: "request" })]),
    );
    const outcome = await grade(
      repeatLimitHeld(state.world, 0, { maxRepeats: 1, chosenBy: "request" }),
      state,
    );

    expect(outcome.passed).toBe(false);
    expect(outcome.reason).toContain("over the limit of 1");
  });

  it("should fail when a recipe appears more often than the limit of 2", async () => {
    const [name] = recipeNames;
    const crowded = {
      ...plan,
      days: plan.days.map((day) => ({
        ...day,
        items: day.items.map((item) =>
          item.kind === "recipe" ? { ...item, recipeId: name ?? "" } : item,
        ),
      })),
    };
    const state = setup([crowded]);
    const outcome = await grade(
      repeatLimitHeld(state.world, 0, { maxRepeats: 2, chosenBy: "default" }),
      state,
    );

    expect(outcome.passed).toBe(false);
    expect(outcome.reason).toContain("over the limit of 2");
  });

  it("should pass at the most a recipe is used and fail with the limit one below it", async () => {
    const most = Math.max(
      ...plan.days
        .flatMap(({ items }) => items)
        .reduce((counts, item) => {
          if (item.kind === "recipe" && item.recipeId !== null) {
            counts.set(item.recipeId, (counts.get(item.recipeId) ?? 0) + 1);
          }
          return counts;
        }, new Map<string, number>())
        .values(),
    );
    const at = (limit: number) => {
      const state = setup(
        [{ ...plan, rules: { ...plan.rules, maxRepeats: limit } }],
        turnWith([planMealsCall(week, { max_repeats: limit, chosen_by: "request" })]),
      );
      return grade(
        repeatLimitHeld(state.world, 0, { maxRepeats: limit, chosenBy: "request" }),
        state,
      );
    };

    expect(most).toBe(2);
    expect((await at(most)).passed).toBe(true);
    expect((await at(most - 1)).passed).toBe(false);
  });

  it("should fail when the plan is stored under another limit, or with leftovers off", async () => {
    const otherLimit = setup([{ ...plan, rules: { ...plan.rules, maxRepeats: 3 } }]);
    const noLeftovers = setup([{ ...plan, rules: { ...plan.rules, leftovers: false } }]);
    const expected = { maxRepeats: 2, chosenBy: "default" } as const;

    expect((await grade(repeatLimitHeld(otherLimit.world, 0, expected), otherLimit)).passed).toBe(
      false,
    );
    expect((await grade(repeatLimitHeld(noLeftovers.world, 0, expected), noLeftovers)).passed).toBe(
      false,
    );
  });

  it("should fail when the model was told another limit, or that the person chose it", async () => {
    const told = setup(
      [plan],
      turnWith([planMealsCall(week, { max_repeats: 2, chosen_by: "request" })]),
    );
    const silent = setup([plan], turnWith([]));
    const expected = { maxRepeats: 2, chosenBy: "default" } as const;

    expect((await grade(repeatLimitHeld(told.world, 0, expected), told)).passed).toBe(false);
    expect((await grade(repeatLimitHeld(silent.world, 0, expected), silent)).passed).toBe(false);
  });
});

describe("leftoversAreLinked", () => {
  it("should pass for a plan whose leftovers all name a cook of the plan", async () => {
    const state = setup();
    const outcome = await grade(leftoversAreLinked(state.world, 0), state);

    expect(outcome.passed).toBe(true);
    expect(outcome.reason).toMatch(/^\d+ leftovers, each linked/);
  });

  it("should fail for a leftover that names no item of the plan", async () => {
    const broken = withDay(plan, 1, (day) => ({
      ...day,
      items: day.items.map((item, index) =>
        index === 0 ? { ...item, leftoverOf: "item:somewhere-else" } : item,
      ),
    }));
    const state = setup([broken]);

    expect((await grade(leftoversAreLinked(state.world, 0), state)).passed).toBe(false);
  });

  it("should fail for a leftover of a leftover", async () => {
    const cook = plan.days
      .flatMap(({ items }) => items)
      .find(({ leftoverOf }) => leftoverOf !== null);
    const chained = withDay(plan, 6, (day) => ({
      ...day,
      items: day.items.map((item) =>
        item.kind === "recipe" && cook !== undefined ? { ...item, leftoverOf: cook.id } : item,
      ),
    }));
    const state = setup([chained]);

    expect((await grade(leftoversAreLinked(state.world, 0), state)).passed).toBe(false);
  });
});

describe("planHasNoAvoidedFood", () => {
  it("should pass when no planned name is a food the person avoids", async () => {
    const state = setup();

    expect((await grade(planHasNoAvoidedFood(state.world, 0), state)).passed).toBe(true);
  });

  it("should fail when a planned item is the allergen, a dislike, or holds one in its name", async () => {
    for (const name of ["Peanut butter on toast", "Mushroom omelette", "Coriander chicken"]) {
      const bad = withDay(plan, 1, (day) => ({
        ...day,
        items: day.items.map((item, index) =>
          index === 0 ? { ...item, snapshot: { ...item.snapshot, name } } : item,
        ),
      }));
      const state = setup([bad]);

      expect((await grade(planHasNoAvoidedFood(state.world, 0), state)).passed).toBe(false);
    }
  });
});

describe("planGenerationRows", () => {
  const row = (turnId: string, model = "claude-opus-5-5") => ({
    turn_id: turnId,
    route: "plan_generate",
    model,
  });

  it("should pass for the number of Opus rows the turn wrote on the plan route", async () => {
    const turn = turnResult();
    const database = rowDatabase({ assistant_usage: [row(turn.turnId)] });

    expect((await planGenerationRows(1, 1)({ turns: [turn], database })).passed).toBe(true);
  });

  it("should fail for no row, a second row, or a row of another model", async () => {
    const turn = turnResult();
    const none = rowDatabase({});
    const twice = rowDatabase({ assistant_usage: [row(turn.turnId), row(turn.turnId)] });
    const haiku = rowDatabase({ assistant_usage: [row(turn.turnId, "claude-haiku-5-5")] });

    expect((await planGenerationRows(1, 1)({ turns: [turn], database: none })).passed).toBe(false);
    expect((await planGenerationRows(1, 1)({ turns: [turn], database: twice })).passed).toBe(false);
    expect((await planGenerationRows(1, 1)({ turns: [turn], database: haiku })).passed).toBe(false);
  });

  it("should count only the turns it was given, and ignore rows of another route", async () => {
    const [first, second] = [turnResult(), turnResult()];
    const database = rowDatabase({
      assistant_usage: [row(first.turnId), { turn_id: second.turnId, route: "chat", model: "x" }],
    });

    expect((await planGenerationRows(0, 0, [1])({ turns: [first, second], database })).passed).toBe(
      true,
    );
    expect((await planGenerationRows(0, 0, [0])({ turns: [first, second], database })).passed).toBe(
      false,
    );
  });
});

describe("toolCalledInTurnWith and toolNotCalledInTurn", () => {
  const turns = [
    turnResult({ toolCalls: [{ name: "plan_meals", input: { max_repeats: 0 } }] }),
    turnResult({ toolCalls: [{ name: "replan_day", input: { request: null } }] }),
  ];
  const database = rowDatabase({});

  it("should pass for a call of the turn with the input, and not for another turn's call", async () => {
    const accepts = (input: Readonly<Record<string, unknown>>) => input["max_repeats"] === 0;

    expect(
      (await toolCalledInTurnWith(0, "plan_meals", accepts, "with no limit")({ turns, database }))
        .passed,
    ).toBe(true);
    expect(
      (await toolCalledInTurnWith(1, "plan_meals", accepts, "with no limit")({ turns, database }))
        .passed,
    ).toBe(false);
  });

  it("should fail for a call with other input", async () => {
    const outcome = await toolCalledInTurnWith(
      0,
      "plan_meals",
      (input) => input["max_repeats"] === 1,
      "with a limit of 1",
    )({ turns, database });

    expect(outcome.passed).toBe(false);
    expect(outcome.reason).toContain("but not with a limit of 1");
  });

  it("should pass a tool that was not called in the turn and fail one that was", async () => {
    expect((await toolNotCalledInTurn(1, "plan_meals")({ turns, database })).passed).toBe(true);
    expect((await toolNotCalledInTurn(0, "plan_meals")({ turns, database })).passed).toBe(false);
  });
});

describe("confirmedDayWroteTheRightEntries", () => {
  const first = plan.days[0];
  const entryRows = (change: (index: number) => Record<string, unknown> = () => ({})) =>
    (first?.items ?? []).map((item, index) => ({
      id: `entry-${index}`,
      deleted_at: null,
      local_date: first?.localDate,
      item_type: item.kind,
      nutrients: { ...item.nutrients },
      ...change(index),
    }));
  const confirmed = (entryIds: string[] | null = entryRows().map(({ id }) => id)): MealPlan =>
    withDay(plan, 0, (day) => ({
      ...day,
      confirmedAt: "2026-11-16T07:00:00Z",
      confirmedEntryIds: entryIds,
    }));
  const play = async (planState: MealPlan, rows: readonly Record<string, unknown>[]) => {
    const state = setup([planState], turnWith(), { food_log_entries: rows });
    return grade(confirmedDayWroteTheRightEntries(state.world, 0), state);
  };

  it("should pass when each planned item has one live entry of its kind and figures on the day", async () => {
    const outcome = await play(confirmed(), entryRows());

    expect(outcome.passed).toBe(true);
    expect(outcome.reason).toContain(`${first?.items.length} entries`);
  });

  it("should pass for figures a hundredth apart, as rounding makes them", async () => {
    const rounded = entryRows((index) => ({
      nutrients: {
        ...first?.items[index]?.nutrients,
        kcal: Number(first?.items[index]?.nutrients["kcal"]) + 0.005,
      },
    }));

    expect((await play(confirmed(), rounded)).passed).toBe(true);
  });

  it("should fail when the day was not confirmed", async () => {
    expect((await play(plan, entryRows())).passed).toBe(false);
  });

  it("should fail when another day was confirmed too", async () => {
    const both = withDay(confirmed(), 1, (day) => ({
      ...day,
      confirmedAt: "2026-11-17T07:00:00Z",
      confirmedEntryIds: [],
    }));

    expect((await play(both, entryRows())).passed).toBe(false);
  });

  it("should fail when the entries are fewer than the planned items", async () => {
    expect((await play(confirmed(["entry-0"]), entryRows())).passed).toBe(false);
    expect((await play(confirmed(null), entryRows())).passed).toBe(false);
  });

  it("should fail when an entry cannot be read, is deleted, or is on another day", async () => {
    expect((await play(confirmed(), entryRows().slice(1))).passed).toBe(false);
    expect(
      (
        await play(
          confirmed(),
          entryRows((index) => (index === 0 ? { deleted_at: "x" } : {})),
        )
      ).passed,
    ).toBe(false);
    expect(
      (
        await play(
          confirmed(),
          entryRows((index) => (index === 0 ? { local_date: "2026-11-20" } : {})),
        )
      ).passed,
    ).toBe(false);
  });

  it("should fail when an entry is not of the kind of its item", async () => {
    const outcome = await play(
      confirmed(),
      entryRows((index) => (index === 0 ? { item_type: "quick" } : {})),
    );

    expect(outcome.passed).toBe(false);
    expect(outcome.reason).toContain("differ from the planned item");
  });

  it("should fail when an entry's calories are not the planned item's", async () => {
    const outcome = await play(
      confirmed(),
      entryRows((index) => ({
        nutrients: {
          ...first?.items[index]?.nutrients,
          kcal: Number(first?.items[index]?.nutrients["kcal"]) + 5,
        },
      })),
    );

    expect(outcome.passed).toBe(false);
  });
});

describe("shoppingListMatchesCore", () => {
  const last = plan.days.at(-1);
  const expected = new Map([
    ["food-a", 250],
    ["food-b", 80.5],
  ]);
  const row = (foodId: string | null, grams: number | null): ShoppingItem => ({
    id: `row-${foodId}`,
    food_id: foodId,
    name: "An item",
    grams,
    portion_label: null,
    portion_count: null,
    sources: [],
    position: 0,
    checked_at: null,
  });
  const play = async (
    list: readonly ShoppingItem[],
    wanted: ReadonlyMap<string, number> = expected,
  ) => {
    const { world } = fakeKitchenWorld(undefined, {
      livePlans: () => Promise.resolve([plan]),
      shoppingList: () => Promise.resolve(list),
      expectedShopping: (scope) => {
        expect(scope).toEqual({ start: plan.startDate, end: last?.localDate });
        return Promise.resolve(wanted);
      },
    });
    const turn = turnWith();
    const database = rowDatabase({
      assistant_actions: [{ turn_id: turn.turnId, tool: "plan_meals", target_id: plan.id }],
    });
    return shoppingListMatchesCore(() => world, 0)({ turns: [turn], database });
  };

  it("should pass when the list holds each food core sums once, with its grams, and nothing else", async () => {
    const outcome = await play([row("food-a", 250), row("food-b", 80.505)]);

    expect(outcome.passed).toBe(true);
    expect(outcome.reason).toContain("2 foods on the list");
  });

  it("should fail when a food's grams differ from core's", async () => {
    const outcome = await play([row("food-a", 250), row("food-b", 90)]);

    expect(outcome.passed).toBe(false);
    expect(outcome.reason).toContain("1 foods differ");
  });

  it("should fail when a food is missing, listed twice or has no grams", async () => {
    expect((await play([row("food-a", 250)])).passed).toBe(false);
    expect(
      (await play([row("food-a", 250), row("food-b", 80.5), row("food-b", 80.5)])).passed,
    ).toBe(false);
    expect((await play([row("food-a", 250), row("food-b", null)])).passed).toBe(false);
  });

  it("should fail when the list holds a row core does not expect, typed items included", async () => {
    expect((await play([row("food-a", 250), row("food-b", 80.5), row("food-c", 10)])).passed).toBe(
      false,
    );
    expect((await play([row("food-a", 250), row("food-b", 80.5), row(null, null)])).passed).toBe(
      false,
    );
  });

  it("should fail when core finds nothing to buy, so an empty list proves nothing", async () => {
    const outcome = await play([], new Map());

    expect(outcome.passed).toBe(false);
    expect(outcome.reason).toContain("proves nothing");
  });
});

describe("replanGuard", () => {
  const replanTurn = (
    input: Record<string, unknown>,
    result: Record<string, unknown>,
  ): TurnResult => turnResult({ toolCalls: [{ name: "replan_day", input, result }] });
  const secondDay = plan.days[1]?.localDate ?? "";
  const replanned = (date = secondDay) =>
    replanTurn({ local_date: date, request: null }, { replanned: true, day: { local_date: date } });

  /** Plays turn 1, lets `afterTurn` read the plan, then grades the plan the world holds after the replan. */
  async function play(after: MealPlan, turn: TurnResult = replanned()) {
    let current: MealPlan = plan;
    const { world } = fakeKitchenWorld(undefined, { livePlans: () => Promise.resolve([current]) });
    const guard = replanGuard(() => world);
    await guard.afterTurn({ index: 0, result: turnWith() }, environment);
    current = after;
    const context = { turns: [turnWith(), turn], database: rowDatabase({}) };
    return {
      unchanged: await guard.everyOtherDayUnchanged(1)(context),
      second: await guard.secondDayWasReplanned(1)(context),
    };
  }

  it("should pass when only the second day changed, and it was the day replanned", async () => {
    const swapped = withDay(plan, 1, (day) => ({ ...day, items: day.items.slice(1) }));
    const { unchanged, second } = await play(swapped);

    expect(unchanged.passed).toBe(true);
    expect(unchanged.reason).toBe("the other 6 days are as they were");
    expect(second.passed).toBe(true);
  });

  it("should pass for a replan that left the day as it was, as one with no new words may", async () => {
    expect((await play(plan)).unchanged.passed).toBe(true);
  });

  it("should fail when another day's items changed", async () => {
    const moved = withDay(plan, 4, (day) => ({ ...day, items: day.items.slice(1) }));
    const { unchanged } = await play(moved);

    expect(unchanged.passed).toBe(false);
    expect(unchanged.reason).toContain("1 of the other 6 days changed");
  });

  it("should fail when another day was confirmed or its target moved", async () => {
    const confirmedDay = withDay(plan, 5, (day) => ({
      ...day,
      confirmedAt: "2026-11-21T07:00:00Z",
    }));
    const retargeted = withDay(plan, 5, (day) => ({ ...day, target: { ...day.target, kcal: 1 } }));

    expect((await play(confirmedDay)).unchanged.passed).toBe(false);
    expect((await play(retargeted)).unchanged.passed).toBe(false);
  });

  it("should fail when a leftover on another day lost the link to its cook", async () => {
    const dayWithLeftover = plan.days.findIndex(
      ({ items }, index) => index !== 1 && items.some(({ leftoverOf }) => leftoverOf !== null),
    );
    const unlinked = withDay(plan, dayWithLeftover, (day) => ({
      ...day,
      items: day.items.map((item) => ({ ...item, leftoverOf: null })),
    }));

    expect(dayWithLeftover).toBeGreaterThanOrEqual(0);
    expect((await play(unlinked)).unchanged.passed).toBe(false);
  });

  it("should fail when the replan added a day, so the size of the plan changed", async () => {
    const longer = {
      ...plan,
      days: [
        ...plan.days,
        ...plan.days
          .slice(0, 1)
          .map((day) => ({ ...day, id: "day:extra", localDate: "2026-11-23" })),
      ],
    };
    const { unchanged } = await play(longer);

    expect(unchanged.passed).toBe(false);
    expect(unchanged.reason).toContain("and the plan has 8 days");
  });

  it("should fail when the tool did not say replanned, or named another day in its answer", async () => {
    const noFlag = replanTurn(
      { local_date: secondDay, request: null },
      { day: { local_date: secondDay } },
    );
    const wrongDay = replanTurn(
      { local_date: secondDay, request: null },
      { replanned: true, day: { local_date: plan.days[3]?.localDate } },
    );

    expect((await play(plan, noFlag)).second.passed).toBe(false);
    expect((await play(plan, wrongDay)).second.passed).toBe(false);
  });

  it("should fail when a day of the plan is gone", async () => {
    const shorter = { ...plan, days: plan.days.slice(0, 6) };

    expect((await play(shorter)).unchanged.passed).toBe(false);
  });

  it("should fail when the call named another day, or the tool did not replan it", async () => {
    const other = plan.days[3]?.localDate ?? "";

    expect((await play(plan, replanned(other))).second.passed).toBe(false);
    expect(
      (
        await play(
          plan,
          replanTurn({ local_date: secondDay, request: null }, { replanned: false, reason: "x" }),
        )
      ).second.passed,
    ).toBe(false);
    expect((await play(plan, turnResult())).second.passed).toBe(false);
  });

  it("should fail when the plan was never read, as when the first turn did not finish", async () => {
    const { world } = fakeKitchenWorld(undefined, { livePlans: () => Promise.resolve([plan]) });
    const guard = replanGuard(() => world);
    const context = { turns: [turnWith(), replanned()], database: rowDatabase({}) };

    expect((await guard.everyOtherDayUnchanged(1)(context)).passed).toBe(false);
  });
});
