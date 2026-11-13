// Graders for the mealPlan set (KEY-1038). A plan is graded from the rows the tool wrote and from core: the days are
// judged by core's own view of a plan (`planDayViewsOf`), the entries a confirmed day wrote are compared with the figures
// the planner froze into its items, the shopping list is compared with what core's `planShoppingDraftsOf` sums, and a
// replanned day is checked by `dayFingerprint` on every other day. Nothing here asks a model, and no expected figure is
// typed by hand. A reason holds a count or a day's place in the plan, never a name, a date or a figure of the person's diary.
import { avoidsFood } from "@keylow/core";
import { addCalendarDays } from "@keylow/core/dates";
import { dayFingerprint, planDayViewsOf } from "@keylow/core/plans";

import { callsOf, fail, isRecord, pass } from "./kitchenGraders.ts";
import { kitchenWeek } from "../fixtures/kitchenFacts.ts";
import { palatePreferences } from "../fixtures/palateProfile.ts";

import type { GenerationRoute } from "./kitchenGraders.ts";
import type { EvalCase, GradeContext, GradeOutcome, Grader } from "../src/case.ts";
import type { KitchenWorld } from "../src/kitchenWorld.ts";
import type { MealPlan } from "@keylow/api-client";

type World = () => KitchenWorld;

/**
 * How far an entry's figure may sit from the figure the planner froze into the item it came from. The planner adds
 * unrounded figures, and the diary rounds an entry's figures to two places, so a figure is the same to within a
 * hundredth. A larger gap means the entry is not what was planned.
 */
export const ENTRY_FIGURE_TOLERANCE = 0.01;

/** How far a list row's grams may sit from core's sum. The column is unrounded, so this only absorbs addition order. */
export const LIST_GRAMS_TOLERANCE = 0.01;

const NUTRIENT_KEYS = ["kcal", "protein_g", "carbs_g", "fat_g"] as const;

type Found = Readonly<{ plan: MealPlan }> | Readonly<{ failure: GradeOutcome }>;

/**
 * The plan the turn saved: the one `plan_meals` action of the turn names it, and it must still be a live plan. Found
 * through the turn's own action row, so another case's plan is never read.
 */
async function planOfTurn(
  { turns, database }: GradeContext,
  world: World,
  turnIndex: number,
): Promise<Found> {
  const turn = turns[turnIndex];
  if (turn === undefined) {
    return { failure: fail(`turn ${turnIndex + 1} never happened`) };
  }
  const actions = await database.readRows({
    table: "assistant_actions",
    where: { turn_id: turn.turnId, tool: "plan_meals" },
  });
  const [action] = actions;
  const targetId = isRecord(action) ? action["target_id"] : null;
  if (actions.length !== 1 || typeof targetId !== "string") {
    return {
      failure: fail(
        `turn ${turnIndex + 1} left ${actions.length} plan_meals actions with a plan, not 1`,
      ),
    };
  }
  const plan = (await world().livePlans()).find(({ id }) => id === targetId);
  return plan === undefined
    ? { failure: fail("the plan of the turn is not among the live plans") }
    : { plan };
}

const asGrader =
  (
    world: World,
    turnIndex: number,
    grade: (plan: MealPlan, context: GradeContext) => Promise<GradeOutcome> | GradeOutcome,
  ): Grader =>
  async (context) => {
    const found = await planOfTurn(context, world, turnIndex);
    return "failure" in found ? found.failure : grade(found.plan, context);
  };

/** Passes when the turn saved one assistant plan of `dayCount` consecutive days, the first of them its start date. */
export function planSaved(world: World, turnIndex: number, dayCount: number): Grader {
  return asGrader(world, turnIndex, (plan) => {
    const consecutive = plan.days.every(
      ({ localDate }, index) => localDate === addCalendarDays(plan.startDate, index),
    );
    if (plan.dayCount !== dayCount || plan.days.length !== dayCount || !consecutive) {
      return fail(
        `the plan has ${plan.days.length} days (day count ${plan.dayCount}), wanted ${dayCount} consecutive days`,
      );
    }
    return plan.source === "assistant"
      ? pass(`one assistant plan of ${dayCount} consecutive days`)
      : fail("the plan was not written by the assistant");
  });
}

const reportedDaysOf = (turn: GradeContext["turns"][number] | undefined) => {
  const days =
    turn === undefined ? undefined : callsOf([turn], "plan_meals").at(-1)?.result?.["days"];
  return Array.isArray(days) ? days.filter(isRecord) : [];
};

const reportedShortNutrients = (day: Record<string, unknown> | undefined): string[] | null => {
  if (day === undefined || day["status"] !== "short" || !Array.isArray(day["short_of"])) {
    return null;
  }
  return day["short_of"].flatMap((miss: unknown) =>
    isRecord(miss) && typeof miss["nutrient"] === "string" ? [miss["nutrient"]] : [],
  );
};

const sameMembers = (left: readonly string[], right: readonly string[]): boolean =>
  left.length === right.length && left.every((member) => right.includes(member));

/**
 * Passes when every day of the plan was planned to the person's own target for its weekday (core's `dayTarget`, with the
 * programme's protein), and is either within core's tolerance of it or is reported short by the tool, naming the same
 * nutrients core finds short. Core judges the day (`planDayViewsOf`), from the figures frozen in the items. An empty
 * day fails.
 */
export function daysMeetTheirTargets(world: World, turnIndex: number): Grader {
  return asGrader(world, turnIndex, (plan, { turns }) => {
    const expected = kitchenWeek(plan.startDate);
    const views = planDayViewsOf([plan]);
    const reported = reportedDaysOf(turns[turnIndex]);
    const wrongTarget = views.filter(({ target }, index) => {
      const wanted = expected[index]?.target;
      return (
        wanted === undefined ||
        Math.abs((target.kcal ?? Number.NaN) - wanted.kcal) > 1e-6 ||
        Math.abs((target.protein_g ?? Number.NaN) - wanted.protein_g) > 1e-6 ||
        target.carbs_g !== null ||
        target.fat_g !== null
      );
    }).length;
    if (views.length !== plan.days.length || wrongTarget > 0) {
      return fail(`${wrongTarget} days were not planned to the person's target for the weekday`);
    }
    const empty = views.filter(({ status }) => status === "empty").length;
    if (empty > 0) {
      return fail(`${empty} days have nothing planned`);
    }
    const short = views.filter(({ status }) => status === "short");
    const dishonest = short.filter((view) => {
      const claimed = reportedShortNutrients(
        reported.find((day) => day["local_date"] === view.localDate),
      );
      return (
        claimed === null ||
        !sameMembers(
          claimed,
          view.shortfalls.map(({ nutrient }) => nutrient),
        )
      );
    }).length;
    return dishonest === 0
      ? pass(
          `${views.length - short.length} days within the tolerance, ${short.length} short and reported short`,
        )
      : fail(
          `${dishonest} days are short by core's judgement and not reported short as core finds them`,
        );
  });
}

const placementsOf = (plan: MealPlan): Map<string, number> => {
  const counts = new Map<string, number>();
  for (const item of plan.days.flatMap(({ items }) => items)) {
    if (item.kind === "recipe" && item.recipeId !== null) {
      counts.set(item.recipeId, (counts.get(item.recipeId) ?? 0) + 1);
    }
  }
  return counts;
};

export type RepeatLimitExpected = Readonly<{
  /** The most a recipe may appear, leftovers counted, or null for no limit. */
  maxRepeats: number | null;
  /** Who chose it: the person in this request, or the starting limit. */
  chosenBy: "request" | "default";
}>;

/**
 * Passes when the plan was made under the repeat limit the person's words give (stored in the plan's rules, and told to
 * the model), leftovers are on, and no recipe appears more often than the limit allows, a leftover being an appearance.
 * With no limit nothing is counted, and the plan must say it has none.
 */
export function repeatLimitHeld(
  world: World,
  turnIndex: number,
  { maxRepeats, chosenBy }: RepeatLimitExpected,
): Grader {
  return asGrader(world, turnIndex, (plan, { turns }) => {
    if (plan.rules["maxRepeats"] !== maxRepeats || plan.rules["leftovers"] !== true) {
      return fail("the plan is stored under another repeat limit, or with leftovers off");
    }
    const told = callsOf(turns.slice(turnIndex, turnIndex + 1), "plan_meals").at(-1)?.result?.[
      "repeat_limit"
    ];
    if (!isRecord(told) || told["max_repeats"] !== maxRepeats || told["chosen_by"] !== chosenBy) {
      return fail("the model was told another repeat limit than the plan was made under");
    }
    if (maxRepeats === null) {
      return pass("the plan has no repeat limit, as the person said");
    }
    const most = Math.max(0, ...placementsOf(plan).values());
    return most <= maxRepeats
      ? pass(`no recipe appears more than ${maxRepeats} times, leftovers counted (most is ${most})`)
      : fail(`a recipe appears ${most} times, over the limit of ${maxRepeats}`);
  });
}

/** Passes when every leftover names a cook in the same plan, which is not a leftover itself and sits no later in the plan. */
export function leftoversAreLinked(world: World, turnIndex: number): Grader {
  return asGrader(world, turnIndex, (plan) => {
    const items = plan.days.flatMap(({ localDate, items: dayItems }) =>
      dayItems.map((item) => ({ item, localDate })),
    );
    const leftovers = items.filter(({ item }) => item.leftoverOf !== null);
    const broken = leftovers.filter(({ item, localDate }) => {
      const cook = items.find(({ item: candidate }) => candidate.id === item.leftoverOf);
      return (
        cook === undefined ||
        cook.item.leftoverOf !== null ||
        cook.item.kind !== item.kind ||
        cook.localDate > localDate
      );
    }).length;
    return broken === 0
      ? pass(`${leftovers.length} leftovers, each linked to a cook of the plan`)
      : fail(`${broken} leftovers name no cook, a leftover, or a later day`);
  });
}

const nameOfItem = (snapshot: Readonly<Record<string, unknown>>): string =>
  typeof snapshot["name"] === "string" ? snapshot["name"] : "";

/** Passes when no planned recipe or food has a name the person's allergy or dislikes avoid. Matching is core's. */
export function planHasNoAvoidedFood(world: World, turnIndex: number): Grader {
  return asGrader(world, turnIndex, (plan) => {
    const preferences = palatePreferences();
    const items = plan.days.flatMap(({ items: dayItems }) => dayItems);
    const hits = items.filter(
      ({ snapshot }) => avoidsFood({ name: nameOfItem(snapshot) }, preferences).avoid,
    ).length;
    return hits === 0
      ? pass(`none of ${items.length} planned items is a food the person avoids`)
      : fail(`${hits} planned items are a food the person avoids`);
  });
}

/** Passes when the turn wrote between `minimum` and `maximum` Opus rows on the `plan_generate` route. */
export function planGenerationRows(
  minimum: number,
  maximum: number,
  turnIndexes?: readonly number[],
): Grader {
  const route: GenerationRoute = "plan_generate";
  return async ({ turns, database }) => {
    const chosen = turns.filter((_turn, index) => turnIndexes?.includes(index) ?? true);
    const rows = (
      await Promise.all(
        chosen.map(({ turnId }) =>
          database.readRows({ table: "assistant_usage", where: { turn_id: turnId, route } }),
        ),
      )
    ).flat();
    const notOpus = rows.filter((row) => row["model"] !== "claude-opus-5-5").length;
    if (rows.length < minimum || rows.length > maximum) {
      return fail(
        `${rows.length} ${route} rows, wanted ${minimum === maximum ? minimum : `${minimum} to ${maximum}`}`,
      );
    }
    return notOpus === 0
      ? pass(`${rows.length} ${route} rows, all Opus`)
      : fail(`${notOpus} ${route} rows are not Opus 5.5`);
  };
}

/** Passes when a call to the tool in the turn has an input the predicate accepts. */
export function toolCalledInTurnWith(
  turnIndex: number,
  tool: string,
  accepts: (input: Readonly<Record<string, unknown>>) => boolean,
  what: string,
): Grader {
  return ({ turns }) => {
    const calls = callsOf(turns.slice(turnIndex, turnIndex + 1), tool);
    if (calls.length === 0) {
      return Promise.resolve(fail(`${tool} was not called in turn ${turnIndex + 1}`));
    }
    return Promise.resolve(
      calls.some(({ input }) => isRecord(input) && accepts(input))
        ? pass(`${tool} was called ${what}`)
        : fail(`${tool} was called, but not ${what}`),
    );
  };
}

/** Passes when the turn made no call to the tool. */
export function toolNotCalledInTurn(turnIndex: number, tool: string): Grader {
  return ({ turns }) => {
    const calls = callsOf(turns.slice(turnIndex, turnIndex + 1), tool).length;
    return Promise.resolve(
      calls === 0
        ? pass(`${tool} was not called in turn ${turnIndex + 1}`)
        : fail(`${tool} was called ${calls} times in turn ${turnIndex + 1}`),
    );
  };
}

const figureOf = (nutrients: unknown, key: (typeof NUTRIENT_KEYS)[number]): number | null => {
  const value = isRecord(nutrients) ? nutrients[key] : undefined;
  return typeof value === "number" ? value : null;
};

const sameFigureWithin = (left: number | null, right: number | null, tolerance: number): boolean =>
  left === null || right === null ? left === right : Math.abs(left - right) <= tolerance;

/**
 * Passes when the first day of the plan was confirmed and no other, and the diary holds one live entry for each planned
 * item of it, on that day, of the item's kind, with the figures the planner froze into the item, and the day's entries
 * add up to core's total for the day. The press is made by the case's `afterTurn` (`world.confirmDay`).
 */
export function confirmedDayWroteTheRightEntries(world: World, turnIndex: number): Grader {
  return asGrader(world, turnIndex, async (plan, { database }) => {
    const [day, ...others] = plan.days;
    if (day === undefined || day.confirmedAt === null) {
      return fail("the first day of the plan was not confirmed");
    }
    if (others.some(({ confirmedAt }) => confirmedAt !== null)) {
      return fail("a day other than the first was confirmed");
    }
    const ids = day.confirmedEntryIds ?? [];
    if (day.items.length === 0 || ids.length !== day.items.length) {
      return fail(`the day has ${day.items.length} planned items and ${ids.length} entries`);
    }
    const rows: Readonly<Record<string, unknown>>[] = [];
    for (const id of ids) {
      const [row] = await database.readRows({ table: "food_log_entries", where: { id } });
      if (row === undefined) {
        return fail("an entry the confirmation wrote cannot be read");
      }
      rows.push(row);
    }
    const wrong = rows.filter((row, index) => {
      const item = day.items[index];
      return (
        item === undefined ||
        row["deleted_at"] !== null ||
        row["local_date"] !== day.localDate ||
        row["item_type"] !== item.kind ||
        NUTRIENT_KEYS.some(
          (key) =>
            !sameFigureWithin(
              figureOf(row["nutrients"], key),
              figureOf(item.nutrients, key),
              ENTRY_FIGURE_TOLERANCE,
            ),
        )
      );
    }).length;
    if (wrong > 0) {
      return fail(`${wrong} of ${rows.length} entries differ from the planned item they came from`);
    }
    const [view] = planDayViewsOf([{ ...plan, days: [{ ...day, confirmedAt: null }] }]);
    const written = rows.reduce((sum, row) => sum + (figureOf(row["nutrients"], "kcal") ?? 0), 0);
    const planned = view?.totals.kcal ?? Number.NaN;
    return Math.abs(written - planned) <= ENTRY_FIGURE_TOLERANCE * rows.length
      ? pass(
          `${rows.length} entries, each the planned item's figures, adding up to core's total for the day`,
        )
      : fail("the entries do not add up to core's total for the day");
  });
}

/**
 * Passes when the shopping list holds exactly the foods core sums for the plan's days, each once, with core's grams.
 * The press is made by the case's `afterTurn` (`world.addPlanToList`), and the list is empty before it.
 */
export function shoppingListMatchesCore(world: World, turnIndex: number): Grader {
  return asGrader(world, turnIndex, async (plan) => {
    const last = plan.days.at(-1);
    if (last === undefined) {
      return fail("the plan has no days");
    }
    const expected = await world().expectedShopping({ start: plan.startDate, end: last.localDate });
    if (expected.size === 0) {
      return fail("core finds nothing to buy for the plan, so the list proves nothing");
    }
    const list = await world().shoppingList();
    const wrong = [...expected].filter(([foodId, grams]) => {
      const rows = list.filter(({ food_id: rowFood }) => rowFood === foodId);
      const [row] = rows;
      return (
        rows.length !== 1 ||
        row?.grams === null ||
        row === undefined ||
        Math.abs(row.grams - grams) > LIST_GRAMS_TOLERANCE
      );
    }).length;
    const stray = list.filter(
      ({ food_id: rowFood }) => rowFood === null || !expected.has(rowFood),
    ).length;
    return wrong === 0 && stray === 0
      ? pass(`${expected.size} foods on the list, each once with core's grams, and nothing else`)
      : fail(`${wrong} foods differ from core's sums and ${stray} list rows are not in the plan`);
  });
}

/** One day as a replan must leave it: its target, whether it is confirmed, what it holds and where its leftovers point. */
function fingerprintsOf(plans: readonly MealPlan[]): ReadonlyMap<string, string> {
  const fingerprints = new Map<string, string>();
  for (const plan of plans) {
    const places = new Map<string, readonly [string, number]>();
    for (const day of plan.days) {
      for (const item of day.items) {
        places.set(item.id, [day.localDate, item.position]);
      }
    }
    for (const day of plan.days) {
      fingerprints.set(
        day.localDate,
        JSON.stringify({
          target: day.target,
          confirmed: day.confirmedAt !== null,
          items: dayFingerprint(day.items),
          cooks: day.items.map((item) =>
            item.leftoverOf === null ? null : (places.get(item.leftoverOf) ?? "unknown"),
          ),
        }),
      );
    }
  }
  return fingerprints;
}

/**
 * The checks of a case that plans a week and then replans one day. `afterTurn` reads every day of the plan once the
 * first turn is over, and the graders compare the plan after the replan with it. A case makes its own, because it holds
 * what `afterTurn` read.
 */
export function replanGuard(world: World): {
  afterTurn: NonNullable<EvalCase["afterTurn"]>;
  secondDayWasReplanned: (turnIndex: number) => Grader;
  everyOtherDayUnchanged: (turnIndex: number) => Grader;
} {
  let before: ReadonlyMap<string, string> | null = null;
  const dates = (): string[] => [...(before?.keys() ?? [])].sort();
  const replanCalls = (turns: GradeContext["turns"], turnIndex: number) =>
    callsOf(turns.slice(turnIndex, turnIndex + 1), "replan_day");

  return {
    afterTurn: async ({ index }) => {
      if (index === 0) {
        before = fingerprintsOf(await world().livePlans());
      }
    },
    secondDayWasReplanned:
      (turnIndex) =>
      ({ turns }) => {
        const second = dates()[1];
        const call = replanCalls(turns, turnIndex).at(-1);
        if (second === undefined || call === undefined) {
          return Promise.resolve(fail("there is no second day, or replan_day was not called"));
        }
        const day = call.result?.["day"];
        const input = isRecord(call.input) ? call.input : {};
        return Promise.resolve(
          input["local_date"] === second &&
            call.result?.["replanned"] === true &&
            isRecord(day) &&
            day["local_date"] === second
            ? pass("replan_day replanned the second day of the plan")
            : fail("replan_day did not replan the second day of the plan"),
        );
      },
    everyOtherDayUnchanged:
      (turnIndex) =>
      async ({ turns }) => {
        const input = replanCalls(turns, turnIndex).at(-1)?.input;
        const replanned = isRecord(input) ? input["local_date"] : undefined;
        if (before === null || typeof replanned !== "string") {
          return fail("the plan was not read before the replan, or replan_day named no day");
        }
        const after = fingerprintsOf(await world().livePlans());
        const days = [...before.keys()].filter((date) => date !== replanned);
        const changed = days.filter((date) => after.get(date) !== before?.get(date)).length;
        return changed === 0 && after.size === before.size
          ? pass(`the other ${days.length} days are as they were`)
          : fail(
              `${changed} of the other ${days.length} days changed, and the plan has ${after.size} days`,
            );
      },
  };
}
