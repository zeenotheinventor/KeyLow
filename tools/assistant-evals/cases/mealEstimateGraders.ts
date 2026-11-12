// The graders of the meal estimate set (KEY-966). A described meal is logged in grams that `estimate_portions`
// worked out, so these read the arguments of the calls and what the database holds, never the wording of the
// reply, except where the rule is about the words ("about", the substitution). The amounts a tool answered come
// from `ToolCall.estimatedAmounts`, which holds the food, the unit and the size and nothing else of the result.
import { inputsOf, isFoodOf, isRecord } from "./entryGraders.ts";

import type { GradeOutcome, Grader } from "../src/case.ts";
import type { EstimatedAmount, EvalDatabase, ToolCall, TurnResult } from "../src/types.ts";

const pass = (reason: string): GradeOutcome => ({ passed: true, reason });
const fail = (reason: string): GradeOutcome => ({ passed: false, reason });

/** The foods that are right for some words: the seeded CoFID foods, or any food whose name fits. */
export type FoodMatch = Readonly<{
  /** The CoFID codes of the foods that are right, any one of them. */
  codes: readonly string[];
  /** A food of any source whose name fits is right too, for a dish the seed holds only some of (a soup, a crumble). */
  namePattern?: RegExp;
}>;

/** One food of a meal: the foods that are right for the words, and how the amount is sized. */
export type SizedItem = FoodMatch &
  Readonly<{
    /** The share of the plate or bowl the person named, as a whole percent. */
    share?: number;
    /** The calories the person gave for the food. */
    kcal?: number;
  }>;

/** Whether the food is the match: one of the seeded codes, or named as the match says. */
export async function isItemFood(
  foodId: string,
  { codes, namePattern }: FoodMatch,
  database: EvalDatabase,
): Promise<boolean> {
  if (await isFoodOf(foodId, codes, database)) {
    return true;
  }
  if (namePattern === undefined) {
    return false;
  }
  const rows = await database.readRows({ table: "foods", where: { id: foodId } });
  return rows.some(({ name }) => typeof name === "string" && namePattern.test(name));
}

async function isAnyFood(
  foodId: string,
  foods: readonly FoodMatch[],
  database: EvalDatabase,
): Promise<boolean> {
  for (const food of foods) {
    if (await isItemFood(foodId, food, database)) {
      return true;
    }
  }
  return false;
}

/** The names of the foods the turns picked, for a failure to say what was chosen instead. */
async function pickedFoodsText(
  turns: readonly TurnResult[],
  database: EvalDatabase,
): Promise<string> {
  const foodIds = new Set<string>();
  for (const call of turns.flatMap((turn) => turn.toolCalls)) {
    const sized = call.name === "estimate_portions" ? itemsOfCall(call) : [];
    const logged = call.name === "log_entry" && isRecord(call.input) ? [call.input] : [];
    for (const entry of [...sized, ...logged]) {
      const foodId = entry["food_id"];
      if (typeof foodId === "string") {
        foodIds.add(foodId);
      }
    }
  }
  const names: string[] = [];
  for (const id of foodIds) {
    const [row] = await database.readRows({ table: "foods", where: { id } });
    names.push(typeof row?.["name"] === "string" ? row["name"] : id);
  }
  return names.length === 0 ? "no food was picked" : `foods picked: ${names.join(", ")}`;
}

/** The container a share-sized item goes through: one of the names, and the diameter the person gave, or null when they gave none. */
export type ExpectedContainer = Readonly<{
  names: readonly string[];
  diameterCm: number | null;
}>;

/** The energy of an item sized by calories may differ from the figure the person gave by this much, in percent. */
export const KCAL_TOLERANCE_PERCENT = 2;

const callsOf = (turns: readonly TurnResult[], name: string): ToolCall[] =>
  turns.flatMap((turn) => turn.toolCalls).filter((call) => call.name === name);

const itemsOfCall = (call: ToolCall): Record<string, unknown>[] => {
  const items = isRecord(call.input) ? call.input["items"] : undefined;
  return Array.isArray(items) ? items.filter(isRecord) : [];
};

const sizeGiven = (value: unknown): boolean => value !== null && value !== undefined;

const describeSizedItem = ({ codes, namePattern, share, kcal }: SizedItem): string =>
  `${[...codes, ...(namePattern === undefined ? [] : [String(namePattern)])].join("|")}${share === undefined ? "" : ` ${share}%`}${kcal === undefined ? "" : ` ${kcal} kcal`}`;

/** Every amount an `estimate_portions` call of the turns answered for the food, in grams or millilitres. */
function estimatedAmountsFor(turns: readonly TurnResult[], foodId: string): EstimatedAmount[] {
  return callsOf(turns, "estimate_portions")
    .flatMap((call) => call.estimatedAmounts ?? [])
    .filter((amount) => amount.foodId === foodId);
}

/** Takes each item, in order, to a candidate of its own, and answers the position of the first it cannot. */
async function firstUnmatched<Candidate>(
  items: readonly SizedItem[],
  candidates: readonly Candidate[],
  matches: (candidate: Candidate, item: SizedItem) => Promise<boolean>,
): Promise<number> {
  const used = new Set<number>();
  for (const [position, item] of items.entries()) {
    let found = -1;
    for (const [index, candidate] of candidates.entries()) {
      if (!used.has(index) && (await matches(candidate, item))) {
        found = index;
        break;
      }
    }
    if (found === -1) {
      return position;
    }
    used.add(found);
  }
  return -1;
}

async function sizedByCall(
  call: ToolCall,
  item: SizedItem,
  container: ExpectedContainer | undefined,
  database: EvalDatabase,
): Promise<boolean> {
  const input = isRecord(call.input) ? call.input : {};
  if (container !== undefined) {
    const named =
      typeof input["container"] === "string" && container.names.includes(input["container"]);
    const sizeAsked =
      container.diameterCm === null
        ? !sizeGiven(input["diameter_cm"]) && !sizeGiven(input["radius_cm"])
        : input["diameter_cm"] === container.diameterCm;
    if (!named || !sizeAsked) {
      return false;
    }
  }
  for (const sized of itemsOfCall(call)) {
    const foodId = sized["food_id"];
    if (
      typeof foodId === "string" &&
      (item.share === undefined || sized["share_percent"] === item.share) &&
      (item.kcal === undefined || sized["kcal"] === item.kcal) &&
      (await isItemFood(foodId, item, database))
    ) {
      return true;
    }
  }
  return false;
}

/**
 * Passes when each item has an `estimate_portions` call that names it: the right food, and the share or the
 * calories the person gave, unchanged. When a container is expected, the call also names one of its containers
 * and passes the diameter the person gave, or none when they gave none (a size nobody said is a guess). An item
 * with no share and no calories is accepted with any share.
 */
export function sizedWithEstimatePortions(
  items: readonly SizedItem[],
  container?: ExpectedContainer,
): Grader {
  return async ({ turns, database }) => {
    const calls = callsOf(turns, "estimate_portions");
    for (const item of items) {
      let named = false;
      for (const call of calls) {
        if (await sizedByCall(call, item, container, database)) {
          named = true;
          break;
        }
      }
      if (!named) {
        return fail(
          `no estimate_portions call sized ${describeSizedItem(item)} (${await pickedFoodsText(turns, database)})`,
        );
      }
    }
    return pass(`estimate_portions sized the ${items.length} items`);
  };
}

/** Passes when exactly one `estimate_portions` call named one of the containers: a plate is sized once, not again. */
export function estimatedContainerOnce(names: readonly string[]): Grader {
  return ({ turns }) => {
    const count = callsOf(turns, "estimate_portions").filter(
      ({ input }) =>
        isRecord(input) &&
        typeof input["container"] === "string" &&
        names.includes(input["container"]),
    ).length;
    return Promise.resolve(
      count === 1
        ? pass("the container was sized once")
        : fail(`estimate_portions sized the container ${count} times, not once`),
    );
  };
}

const unitOf = (kind: unknown): "g" | "ml" | null =>
  kind === "grams" ? "g" : kind === "ml" ? "ml" : null;

const lunchTime = (given: unknown): boolean =>
  given === null ||
  given === undefined ||
  (typeof given === "string" && given >= "11:00" && given <= "15:00");

const timeOk = (given: unknown, lunch: boolean): boolean =>
  lunch ? lunchTime(given) : given === null || given === undefined;

const dayOk = (given: unknown, today: string): boolean =>
  given === null || given === undefined || given === today;

/** The calories of a stored entry, or null when the row holds none. */
const kcalOfRow = (row: Readonly<Record<string, unknown>>): number | null => {
  const { nutrients } = row;
  const kcal = isRecord(nutrients) ? nutrients["kcal"] : undefined;
  return typeof kcal === "number" ? kcal : null;
};

const withinTolerance = (kcal: number | null, wanted: number): boolean =>
  kcal !== null && Math.abs(kcal - wanted) <= (wanted * KCAL_TOLERANCE_PERCENT) / 100;

/**
 * Passes when each item has a `log_entry` call of its own in grams or millilitres, sent with `estimated` true, for
 * the right food, in exactly the amount an `estimate_portions` call answered for that food. `lunch` lets the call
 * carry a time between 11:00 and 15:00, for a message that says "for lunch", and otherwise it carries none.
 */
export function loggedEstimatedAmounts(
  items: readonly SizedItem[],
  today: string,
  lunch = false,
): Grader {
  return async ({ turns, database }) => {
    const inputs = inputsOf(turns, "log_entry");
    const missing = await firstUnmatched(items, inputs, async (input, item) => {
      if (!isRecord(input)) {
        return false;
      }
      const foodId = input["food_id"];
      const unit = unitOf(input["kind"]);
      const quantity = unit === "g" ? input["grams"] : input["ml"];
      return (
        typeof foodId === "string" &&
        unit !== null &&
        input["estimated"] === true &&
        estimatedAmountsFor(turns, foodId).some(
          (sized) => sized.unit === unit && sized.amount === quantity,
        ) &&
        dayOk(input["local_date"], today) &&
        timeOk(input["time"], lunch) &&
        (await isItemFood(foodId, item, database))
      );
    });
    const item = items[missing];
    return item === undefined
      ? pass(
          `log_entry sent the ${items.length} estimated amounts, each as estimate_portions gave it`,
        )
      : fail(
          `no log_entry call logged ${describeSizedItem(item)} with estimated true, in the amount estimate_portions gave (${await pickedFoodsText(turns, database)})`,
        );
  };
}

/**
 * Passes when the entries the turns left are the items, read from the database: each is the right food in the
 * amount `estimate_portions` answered, and an item sized by calories holds the calories the person gave, within
 * `KCAL_TOLERANCE_PERCENT`. It is the end state, so a call that looked right but landed otherwise does not pass.
 */
export function estimatedRows(items: readonly SizedItem[], today: string): Grader {
  return async ({ turns, database }) => {
    const actions = (
      await Promise.all(
        turns.map(({ turnId }) =>
          database.readRows({
            table: "assistant_actions",
            where: { turn_id: turnId, tool: "log_entry" },
          }),
        ),
      )
    ).flat();
    const rows = (
      await Promise.all(
        actions.flatMap(({ target_id: id }) =>
          typeof id === "string"
            ? [database.readRows({ table: "food_log_entries", where: { id, deleted_at: null } })]
            : [],
        ),
      )
    ).flat();
    const missing = await firstUnmatched(items, rows, async (row, item) => {
      const { food_id: foodId, unit, local_date: day } = row;
      if (typeof foodId !== "string" || (unit !== "g" && unit !== "ml") || day !== today) {
        return false;
      }
      return (
        estimatedAmountsFor(turns, foodId).some(
          (sized) => sized.unit === unit && sized.amount === Number(row["quantity"]),
        ) &&
        (item.kcal === undefined || withinTolerance(kcalOfRow(row), item.kcal)) &&
        (await isItemFood(foodId, item, database))
      );
    });
    const item = items[missing];
    return item === undefined
      ? pass(`the diary holds the ${items.length} estimated entries`)
      : fail(
          `no logged entry matched ${describeSizedItem(item)} in the amount and calories (${await pickedFoodsText(turns, database)})`,
        );
  };
}

/** Passes when no `log_entry` call was kind quick: a person who wants the macros is never given a calories-only entry. */
export function neverQuick(): Grader {
  return ({ turns }) => {
    const quick = inputsOf(turns, "log_entry").some(
      (input) => isRecord(input) && input["kind"] === "quick",
    );
    return Promise.resolve(
      quick ? fail("log_entry logged a quick entry") : pass("no quick entry was logged"),
    );
  };
}

/** Passes when no `log_entry` call was sent with `estimated` true: grams the person gave are never estimated. */
export function neverEstimated(): Grader {
  return ({ turns }) => {
    const estimated = inputsOf(turns, "log_entry").some(
      (input) => isRecord(input) && input["estimated"] === true,
    );
    return Promise.resolve(
      estimated ? fail("log_entry sent estimated true") : pass("no log_entry was estimated"),
    );
  };
}

/** Passes when `estimate_portions` was not called: the person gave the grams, so there is nothing to work out. */
export function estimatePortionsNotCalled(): Grader {
  return ({ turns }) => {
    const calls = callsOf(turns, "estimate_portions").length;
    return Promise.resolve(
      calls === 0
        ? pass("estimate_portions was not called")
        : fail(`estimate_portions was called ${calls} times`),
    );
  };
}

/** Passes when the cards the turns sent hold exactly this many rows with the Estimate badge. */
export function estimateBadgeRows(expected: number): Grader {
  return ({ turns }) => {
    const found = turns
      .flatMap((turn) => turn.cards ?? [])
      .flatMap((card) => card.rows)
      .filter((row) => row.estimate).length;
    return Promise.resolve(
      found === expected
        ? pass(`${expected} card rows carry the Estimate badge`)
        : fail(`${found} card rows carry the Estimate badge, not ${expected}`),
    );
  };
}

/** Passes when no card row of the turns carries the Estimate badge. */
export const noEstimateBadge = (): Grader => estimateBadgeRows(0);

const SHARE_WORDS =
  /\bshares?\b|%|\bpercent|\bsplit\b|\bproportions?\b|\bhow much of (?:the|your) (?:plate|bowl)\b|\bof the plate\b/i;

const questionTextOf = (call: ToolCall): string => {
  const input = isRecord(call.input) ? call.input : {};
  const replies: unknown = input["quick_replies"];
  const quickReplies: unknown[] = Array.isArray(replies) ? replies : [];
  return [input["question"], ...quickReplies]
    .filter((part): part is string => typeof part === "string")
    .join(" ");
};

/** Passes when the turn, counted from 0, asked exactly one `ask_user` question, and it is about the share of the plate each food took. */
export function askedAboutSharesInTurn(turnIndex: number): Grader {
  return ({ turns }) => {
    const asked = (turns[turnIndex]?.toolCalls ?? []).filter(({ name }) => name === "ask_user");
    if (asked.length !== 1) {
      return Promise.resolve(fail(`turn ${turnIndex + 1} asked ${asked.length} questions, not 1`));
    }
    const [only] = asked;
    return Promise.resolve(
      only !== undefined && SHARE_WORDS.test(questionTextOf(only))
        ? pass("the question is about the shares of the plate")
        : fail("the question is not about the shares of the plate"),
    );
  };
}

/** Passes when the turn, counted from 0, asked nothing. */
export function noQuestionInTurn(turnIndex: number): Grader {
  return ({ turns }) => {
    const asked = (turns[turnIndex]?.toolCalls ?? []).filter(
      ({ name }) => name === "ask_user",
    ).length;
    return Promise.resolve(
      asked === 0
        ? pass(`turn ${turnIndex + 1} asked nothing`)
        : fail(`turn ${turnIndex + 1} asked a question`),
    );
  };
}

/**
 * Passes when every `log_entry` call of the turn, counted from 0, is for one of these foods. It is for the route
 * where the first turn logs what the share question does not cover and leaves the plate for later.
 */
export function turnLoggedOnlyFoods(turnIndex: number, foods: readonly FoodMatch[]): Grader {
  return async ({ turns, database }) => {
    const calls = (turns[turnIndex]?.toolCalls ?? []).filter(({ name }) => name === "log_entry");
    for (const { input } of calls) {
      const foodId = isRecord(input) ? input["food_id"] : undefined;
      if (typeof foodId !== "string" || !(await isAnyFood(foodId, foods, database))) {
        return fail(
          `turn ${turnIndex + 1} logged a food of the plate before the shares were known (${await pickedFoodsText(turns, database)})`,
        );
      }
    }
    return pass(`turn ${turnIndex + 1} logged nothing of the plate`);
  };
}

/** Passes when every `log_entry` call is for one of these foods. */
export function onlyFoodsOfMatches(foods: readonly FoodMatch[]): Grader {
  return async ({ turns, database }) => {
    for (const input of inputsOf(turns, "log_entry")) {
      const foodId = isRecord(input) ? input["food_id"] : undefined;
      if (typeof foodId !== "string" || !(await isAnyFood(foodId, foods, database))) {
        return fail(
          `log_entry logged a food that is not one of the right ones (${await pickedFoodsText(turns, database)})`,
        );
      }
    }
    return pass("only the right foods were logged");
  };
}

/** Passes when the last reply names the dish and says which food stands in for it, as "Massaman is logged as Curry, beef, homemade, the closest match." */
export function namesTheSubstitution(dish: string): Grader {
  const dishPattern = new RegExp(`\\b${dish}\\b`, "i");
  return ({ turns }) => {
    const answer = turns.at(-1)?.answer ?? "";
    return Promise.resolve(
      dishPattern.test(answer) &&
        /\bcurry\b/i.test(answer) &&
        /\b(?:closest|nearest|similar|instead|stands? in|logged as|used)\b/i.test(answer)
        ? pass(`the reply names the ${dish} substitution`)
        : fail(`the reply does not name the ${dish} substitution`),
    );
  };
}

const MACRO_OR_CALORIE_FIGURE =
  /\d+(?:\.\d+)?\s?(?:kcal|calories)\b|\d+(?:\.\d+)?\s?g\s+(?:of\s+)?(?:protein|carbs?|carbohydrates?|fat)\b|\b(?:protein|carbs?|carbohydrates?|fat)\D{0,12}\d+(?:\.\d+)?\s?g\b/i;

const READS_NUMBERS: ReadonlySet<string> = new Set([
  "search_foods",
  "get_food",
  "estimate_portions",
]);

/**
 * Passes when the reply holds no macro or calorie figure unless a tool that gives food figures was called to
 * read it. A figure with nothing read is one the model made up. This cannot tell a made-up figure from a read
 * one after a read, so it is the floor, and the entries are graded by what they hold.
 */
export function noMadeUpFigures(): Grader {
  return ({ turns }) => {
    const answer = turns.at(-1)?.answer ?? "";
    const read = turns.some((turn) => turn.toolCalls.some(({ name }) => READS_NUMBERS.has(name)));
    return Promise.resolve(
      MACRO_OR_CALORIE_FIGURE.test(answer) && !read
        ? fail("the reply gives a macro or calorie figure and no tool was read for it")
        : pass("no figure was made up"),
    );
  };
}

/** Passes when no `log_entry` call carries a macro the person did not give, and none is a quick add. */
export function noInventedMacros(): Grader {
  return ({ turns }) => {
    const invented = inputsOf(turns, "log_entry").some(
      (input) =>
        isRecord(input) &&
        (input["kind"] === "quick" ||
          ["protein_g", "carbs_g", "fat_g"].some(
            (field) => input[field] !== null && input[field] !== undefined,
          )),
    );
    return Promise.resolve(
      invented
        ? fail("log_entry carried invented macros or a quick add")
        : pass("no macro was invented"),
    );
  };
}
