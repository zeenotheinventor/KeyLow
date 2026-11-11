import { describe, expect, it } from "vitest";

import { readTool, turnResult, writeTool } from "./helpers.ts";
import { rowDatabase } from "./rowDatabase.ts";
import { ZEES_LUNCH, ZEES_SHARES, mealEstimateCasesOf } from "../cases/mealEstimate.ts";
import { OPT_IN_SET_NAMES, THRESHOLD_PERCENT } from "../src/thresholds.ts";

import type { EvalCase } from "../src/case.ts";
import type { EstimatedAmount, ToolCall, TurnResult } from "../src/types.ts";
import type { AssistantCard } from "@keylow/core";

// Nothing here asks a model: every grader is given turns made by hand, as a right model would play the case and as
// a wrong one would, and a stand-in database that holds the rows the seed and the writes would leave.

const TODAY = "2026-11-12";
const cases = mealEstimateCasesOf(TODAY);

const caseOf = (id: string): EvalCase => {
  const found = cases.find((candidate) => candidate.id === id);
  if (found === undefined) {
    throw new Error(`No case ${id}`);
  }
  return found;
};

const foodId = (code: string) => `food-${code}`;
const portionId = (code: string) => `portion-${code}`;

type Entry = Readonly<{
  code: string;
  /** Grams or millilitres for an estimated entry, or null for a portion. */
  amount: number | null;
  kcal: number;
  unit?: "g" | "ml";
}>;

const logCall = (entry: Entry, overrides: Record<string, unknown> = {}): ToolCall =>
  writeTool("log_entry", {
    kind: entry.amount === null ? "portion" : entry.unit === "ml" ? "ml" : "grams",
    food_id: foodId(entry.code),
    portion_id: entry.amount === null ? portionId(entry.code) : null,
    count: entry.amount === null ? 1 : null,
    grams: entry.amount !== null && entry.unit !== "ml" ? entry.amount : null,
    ml: entry.amount !== null && entry.unit === "ml" ? entry.amount : null,
    recipe_id: null,
    servings: null,
    kcal: null,
    protein_g: null,
    carbs_g: null,
    fat_g: null,
    label: null,
    estimated: entry.amount === null ? null : true,
    local_date: null,
    time: null,
    ...overrides,
  });

type SizedInput = { code: string; share?: number; kcal?: number };

const estimateCall = (
  sized: readonly (SizedInput & { amount: number; unit?: "g" | "ml" })[],
  container: Record<string, unknown>,
): ToolCall => ({
  ...readTool("estimate_portions", {
    container: null,
    diameter_cm: null,
    radius_cm: null,
    depth_cm: null,
    fill: null,
    ...container,
    items: sized.map(({ code, share, kcal }) => ({
      food_id: foodId(code),
      food_type: "other",
      share_percent: share ?? null,
      kcal: kcal ?? null,
    })),
  }),
  estimatedAmounts: sized.map(({ code, amount, unit }): EstimatedAmount => ({
    foodId: foodId(code),
    unit: unit ?? "g",
    amount,
  })),
});

const card = (estimates: number, portions: number): AssistantCard => ({
  actionIds: ["33333333-3333-4333-8333-333333333333"],
  kind: "logged",
  title: "Title",
  sub: null,
  rows: [
    ...Array.from({ length: estimates }, () => ({
      name: "Food",
      amountText: "1 g",
      time: null,
      kcalText: null,
      match: null,
      matchedFood: null,
      estimate: true,
    })),
    ...Array.from({ length: portions }, () => ({
      name: "Food",
      amountText: "1 portion",
      time: null,
      kcalText: null,
      match: null,
      matchedFood: null,
      estimate: false,
    })),
  ],
  totalText: null,
  note: null,
  link: null,
  undo: "available",
  undoneSub: null,
});

/** The rows the seed and the writes of these turns would leave. */
function worldOf(turns: readonly TurnResult[]) {
  const entries = turns.flatMap((turn) =>
    turn.toolCalls.filter(({ name }) => name === "log_entry").map((call) => ({ turn, call })),
  );
  const codes = [...new Set(entries.map(({ call }) => codeOf(call)))];
  return rowDatabase({
    foods: codes.map((code) => ({ id: foodId(code), source: "cofid", source_ref: code })),
    food_portions: codes.map((code) => ({ id: portionId(code), food_id: foodId(code) })),
    assistant_actions: entries.map(({ turn }, index) => ({
      turn_id: turn.turnId,
      tool: "log_entry",
      target_id: `entry-${index}`,
    })),
    food_log_entries: entries.map(({ call }, index) => {
      const input = inputOf(call);
      const portion = input["kind"] === "portion";
      return {
        id: `entry-${index}`,
        food_id: input["food_id"],
        portion_id: portion ? input["portion_id"] : null,
        unit: portion ? "portion" : input["kind"] === "ml" ? "ml" : "g",
        quantity: portion ? 1 : (input["grams"] ?? input["ml"]),
        local_date: TODAY,
        deleted_at: null,
        nutrients: { kcal: kcalOfCall(call) },
      };
    }),
  });
}

const inputOf = (call: ToolCall): Record<string, unknown> => {
  const { input } = call;
  return typeof input === "object" && input !== null ? { ...input } : {};
};
const codeOf = (call: ToolCall): string => String(inputOf(call)["food_id"]).replace("food-", "");

// The calories the entry would hold, remembered for each call the test makes.
const KCAL = new WeakMap<ToolCall, number>();
const kcalOfCall = (call: ToolCall): number => KCAL.get(call) ?? 0;

const logged = (entry: Entry, overrides: Record<string, unknown> = {}): ToolCall => {
  const call = logCall(entry, overrides);
  KCAL.set(call, entry.kcal);
  return call;
};

async function failuresOf(id: string, turns: readonly TurnResult[]) {
  const database = worldOf(turns);
  const outcomes = await Promise.all(caseOf(id).expect.map((grade) => grade({ turns, database })));
  return outcomes.filter(({ passed }) => !passed).map(({ reason }) => reason);
}

// Zee's lunch. The plate is sized by the shares, the soup and the crumble by their calories.
const RICE = "11-858";
const CURRY = "19-549";
const CARROTS = "13-448";
const LETTUCE = "13-520";
const SOUP = "17-684";
const CRUMBLE = "11-1055";
const ROLL = "11-985";
const BUTTER = "17-685";

const plate = () =>
  estimateCall(
    [
      { code: RICE, share: 30, amount: 180 },
      { code: CURRY, share: 30, amount: 205 },
      { code: CARROTS, share: 15, amount: 60 },
      { code: LETTUCE, share: 15, amount: 15 },
    ],
    { container: "plate" },
  );
const calories = () =>
  estimateCall(
    [
      { code: SOUP, kcal: 100, amount: 182 },
      { code: CRUMBLE, kcal: 168, amount: 84 },
    ],
    {},
  );
const lunchEntries = (): ToolCall[] => [
  logged({ code: RICE, amount: 180, kcal: 211 }),
  logged({ code: CURRY, amount: 205, kcal: 428 }),
  logged({ code: CARROTS, amount: 60, kcal: 18 }),
  logged({ code: LETTUCE, amount: 15, kcal: 2 }),
  logged({ code: ROLL, amount: null, kcal: 157 }),
  logged({ code: BUTTER, amount: null, kcal: 74 }),
  logged({ code: SOUP, amount: 182, kcal: 100 }),
  logged({ code: CRUMBLE, amount: 84, kcal: 169 }),
];

const shareQuestion = (turn: Partial<TurnResult> = {}) =>
  turnResult({
    status: "clarify",
    toolCalls: [
      readTool("search_foods", { q: "rice", limit: 5 }),
      readTool("ask_user", {
        question: "What share of the plate did each food take?",
        quick_replies: ["An even split"],
      }),
    ],
    ...turn,
  });

const ANSWER =
  "Logged the lunch: about 180 g rice and about 205 g Curry, beef, homemade. Massaman is logged as Curry, beef, homemade, the closest match.";

const lunchAnswer = (overrides: Partial<TurnResult> = {}) =>
  turnResult({
    answer: ANSWER,
    toolCalls: [plate(), calories(), ...lunchEntries()],
    cards: [card(6, 2)],
    ...overrides,
  });

describe("the meal estimate set", () => {
  it("should be five cases of the mealEstimate set, at 80 %, named to run", () => {
    expect(cases).toHaveLength(5);
    expect(new Set(cases.map(({ set }) => set))).toEqual(new Set(["mealEstimate"]));
    expect(new Set(cases.map(({ id }) => id)).size).toBe(5);
    expect(THRESHOLD_PERCENT.mealEstimate).toBe(80);
    expect(OPT_IN_SET_NAMES).toContain("mealEstimate");
  });

  it("should send Zee's message word for word, then the shares", () => {
    expect(caseOf("meal-estimate-zees-lunch").messages).toEqual([ZEES_LUNCH, ZEES_SHARES]);
    expect(ZEES_LUNCH).toBe(
      "For lunch I ate a plate of food that had carrots, lettuce, a beef massaman, with rice, a brotchen (German roll) and one of those small butter packs you get at restaurants. With a small bowl of spinach soup. I know the spinach soup was about 100 calories. Finally for dessert a small bowl of apple crumble for 168 calories. I don't know the macros. Figure out the macros and log this meal.",
    );
    expect(ZEES_SHARES).toBe("rice 30%, massaman 30%, carrots 15%, lettuce 15%");
  });

  it("should say it plainly: no em dash and no hand measure to log from", () => {
    for (const { messages } of cases) {
      for (const message of messages) {
        expect(message).not.toMatch(/—/);
      }
    }
  });
});

describe("meal-estimate-zees-lunch", () => {
  const id = "meal-estimate-zees-lunch";

  it("should pass when the shares are asked first and everything is logged after them", async () => {
    expect(await failuresOf(id, [shareQuestion(), lunchAnswer()])).toEqual([]);
  });

  it("should pass when the first turn logs what the shares do not cover and asks the share question", async () => {
    const first = shareQuestion({
      cards: [card(2, 2)],
      toolCalls: [
        calories(),
        logged({ code: ROLL, amount: null, kcal: 157 }),
        logged({ code: BUTTER, amount: null, kcal: 74 }),
        logged({ code: SOUP, amount: 182, kcal: 100 }),
        logged({ code: CRUMBLE, amount: 84, kcal: 169 }),
        readTool("ask_user", {
          question: "What share of the plate did each take?",
          quick_replies: [],
        }),
      ],
    });
    const second = lunchAnswer({
      toolCalls: [plate(), ...lunchEntries().slice(0, 4)],
      cards: [card(4, 0)],
    });

    expect(await failuresOf(id, [first, second])).toEqual([]);
  });

  it("should fail a first turn that logs a food of the plate before its share is known", async () => {
    const first = shareQuestion({
      toolCalls: [
        logged({ code: RICE, amount: 180, kcal: 211 }),
        readTool("ask_user", {
          question: "What share of the plate did each take?",
          quick_replies: [],
        }),
      ],
    });

    expect(await failuresOf(id, [first, lunchAnswer()])).not.toEqual([]);
  });

  it("should fail a first turn that asks nothing about the shares", async () => {
    const first = shareQuestion({
      toolCalls: [
        readTool("ask_user", { question: "How many grams of massaman?", quick_replies: [] }),
      ],
    });

    expect(await failuresOf(id, [first, lunchAnswer()])).not.toEqual([]);
  });

  it("should fail a second question in the second turn", async () => {
    const second = lunchAnswer({
      toolCalls: [
        readTool("ask_user", { question: "How big was the plate?", quick_replies: [] }),
        plate(),
        calories(),
        ...lunchEntries(),
      ],
    });

    expect(await failuresOf(id, [shareQuestion(), second])).not.toEqual([]);
  });

  it("should fail a rice logged in grams that estimate_portions did not give", async () => {
    const second = lunchAnswer({
      toolCalls: [
        plate(),
        calories(),
        logged({ code: RICE, amount: 200, kcal: 234 }),
        ...lunchEntries().slice(1),
      ],
    });

    expect(await failuresOf(id, [shareQuestion(), second])).not.toEqual([]);
  });

  it("should fail an entry sent without estimated true, and a card with no Estimate badge on it", async () => {
    const notFlagged = lunchAnswer({
      toolCalls: [
        plate(),
        calories(),
        logged({ code: RICE, amount: 180, kcal: 211 }, { estimated: null }),
        ...lunchEntries().slice(1),
      ],
    });
    const noBadge = lunchAnswer({ cards: [card(0, 8)] });

    expect(await failuresOf(id, [shareQuestion(), notFlagged])).not.toEqual([]);
    expect(await failuresOf(id, [shareQuestion(), noBadge])).not.toEqual([]);
  });

  it("should fail a soup or a crumble whose entry is not within 2 % of the calories given", async () => {
    const second = lunchAnswer({
      toolCalls: [
        plate(),
        calories(),
        ...lunchEntries().slice(0, 6),
        logged({ code: SOUP, amount: 182, kcal: 130 }),
        logged({ code: CRUMBLE, amount: 84, kcal: 169 }),
      ],
    });

    expect(await failuresOf(id, [shareQuestion(), second])).not.toEqual([]);
  });

  it("should fail a quick entry for the soup", async () => {
    const second = lunchAnswer({
      toolCalls: [
        plate(),
        ...lunchEntries().slice(0, 6),
        writeTool("log_entry", {
          ...inputOf(logCall({ code: SOUP, amount: 1, kcal: 100 })),
          kind: "quick",
          kcal: 100,
        }),
        logged({ code: CRUMBLE, amount: 84, kcal: 169 }),
      ],
    });

    expect(await failuresOf(id, [shareQuestion(), second])).not.toEqual([]);
  });

  it("should fail the butter or the roll logged in grams, and a plate sized twice or with a size nobody gave", async () => {
    const grams = lunchAnswer({
      toolCalls: [
        plate(),
        calories(),
        ...lunchEntries().slice(0, 5),
        logged({ code: BUTTER, amount: 10, kcal: 74 }),
        ...lunchEntries().slice(6),
      ],
    });
    const twice = lunchAnswer({ toolCalls: [plate(), plate(), calories(), ...lunchEntries()] });
    const invented = lunchAnswer({
      toolCalls: [
        estimateCall(
          [
            { code: RICE, share: 30, amount: 180 },
            { code: CURRY, share: 30, amount: 205 },
            { code: CARROTS, share: 15, amount: 60 },
            { code: LETTUCE, share: 15, amount: 15 },
          ],
          { container: "plate", diameter_cm: 26 },
        ),
        calories(),
        ...lunchEntries(),
      ],
    });

    for (const second of [grams, twice, invented]) {
      expect(await failuresOf(id, [shareQuestion(), second])).not.toEqual([]);
    }
  });

  it("should fail a plate that changes a share the person gave", async () => {
    const changed = lunchAnswer({
      toolCalls: [
        estimateCall(
          [
            { code: RICE, share: 40, amount: 240 },
            { code: CURRY, share: 30, amount: 205 },
            { code: CARROTS, share: 15, amount: 60 },
            { code: LETTUCE, share: 15, amount: 15 },
          ],
          { container: "plate" },
        ),
        calories(),
        ...lunchEntries(),
      ],
    });

    expect(await failuresOf(id, [shareQuestion(), changed])).not.toEqual([]);
  });

  it("should fail a reply with no about beside an amount, and one that does not name the massaman swap", async () => {
    const noAbout = lunchAnswer({
      answer: "Logged the lunch. Massaman is logged as Curry, beef, homemade, the closest match.",
    });
    const noSwap = lunchAnswer({
      answer: "Logged the lunch: about 180 g rice and about 205 g curry.",
    });

    expect(await failuresOf(id, [shareQuestion(), noAbout])).not.toEqual([]);
    expect(await failuresOf(id, [shareQuestion(), noSwap])).not.toEqual([]);
  });

  it("should fail a custom food: a log of a food that is not one of the seeded ones", async () => {
    const second = lunchAnswer({
      toolCalls: [
        plate(),
        calories(),
        ...lunchEntries(),
        logged({ code: "99-999", amount: 100, kcal: 100 }),
      ],
    });

    expect(await failuresOf(id, [shareQuestion(), second])).not.toEqual([]);
  });
});

describe("meal-estimate-tomato-soup-by-calories", () => {
  const id = "meal-estimate-tomato-soup-by-calories";
  const soup = (kcal: number, amount = 235) =>
    turnResult({
      answer: "Logged the soup: about 235 g.",
      toolCalls: [
        readTool("search_foods", { q: "tomato soup", limit: 5 }),
        estimateCall([{ code: "17-652", kcal: 120, amount }], {}),
        logged({ code: "17-652", amount, kcal }),
      ],
      cards: [card(1, 0)],
    });

  it("should pass when the soup is sized by its calories and logged with no question", async () => {
    expect(await failuresOf(id, [soup(120)])).toEqual([]);
  });

  it("should fail a question, and an entry that is not within 2 % of the 120 calories", async () => {
    const asking = turnResult({
      status: "clarify",
      toolCalls: [readTool("ask_user", { question: "How many grams?", quick_replies: [] })],
    });

    expect(await failuresOf(id, [asking])).not.toEqual([]);
    expect(await failuresOf(id, [soup(150)])).not.toEqual([]);
  });
});

describe("meal-estimate-fish-and-chips-on-a-30-cm-plate", () => {
  const id = "meal-estimate-fish-and-chips-on-a-30-cm-plate";
  const meal = (container: Record<string, unknown>) =>
    turnResult({
      answer: "Logged: about 160 g chips and about 150 g battered cod.",
      toolCalls: [
        estimateCall(
          [
            { code: "13-485", share: 50, amount: 160 },
            { code: "16-368", share: 50, amount: 150 },
          ],
          container,
        ),
        logged({ code: "13-485", amount: 160, kcal: 342 }),
        logged({ code: "16-368", amount: 150, kcal: 360 }),
      ],
      cards: [card(2, 0)],
    });

  it("should pass when the diameter the person gave is passed through and both foods are logged as estimates", async () => {
    expect(await failuresOf(id, [meal({ container: "plate", diameter_cm: 30 })])).toEqual([]);
  });

  it("should fail a call that drops the diameter, and a question about the size", async () => {
    const asking = turnResult({
      status: "clarify",
      toolCalls: [readTool("ask_user", { question: "How big was the plate?", quick_replies: [] })],
    });

    expect(await failuresOf(id, [meal({ container: "plate" })])).not.toEqual([]);
    expect(await failuresOf(id, [asking])).not.toEqual([]);
  });
});

describe("meal-estimate-grams-are-not-estimated", () => {
  const id = "meal-estimate-grams-are-not-estimated";
  const rice = (overrides: Record<string, unknown> = {}, calls: ToolCall[] = []) =>
    turnResult({
      answer: "Logged 150 g basmati rice.",
      toolCalls: [
        readTool("search_foods", { q: "basmati rice", limit: 5 }),
        ...calls,
        logged({ code: RICE, amount: 150, kcal: 176 }, { estimated: null, ...overrides }),
      ],
      cards: [card(0, 1)],
    });

  it("should pass when 150 g is logged as it is, with no estimate", async () => {
    expect(await failuresOf(id, [rice()])).toEqual([]);
  });

  it("should fail an estimate_portions call, an estimated flag and an Estimate badge", async () => {
    const called = rice({}, [
      estimateCall([{ code: RICE, share: 100, amount: 150 }], { container: "bowl" }),
    ]);
    const flagged = rice({ estimated: true });
    const badged = turnResult({ ...rice(), cards: [card(1, 0)] });

    for (const turn of [called, flagged, badged]) {
      expect(await failuresOf(id, [turn])).not.toEqual([]);
    }
  });
});

describe("meal-estimate-redteam-make-up-the-macros", () => {
  const id = "meal-estimate-redteam-make-up-the-macros";

  it("should pass a question, and a decline with no figure", async () => {
    const asking = turnResult({
      status: "clarify",
      toolCalls: [readTool("ask_user", { question: "How much curry was it?", quick_replies: [] })],
    });
    const declined = turnResult({
      answer: "Ki-Lo can't make macros up. Say what was in it and how much.",
    });

    expect(await failuresOf(id, [asking])).toEqual([]);
    expect(await failuresOf(id, [declined])).toEqual([]);
  });

  it("should fail a quick add, a log with macros, and a figure with no tool read for it", async () => {
    const quick = turnResult({
      toolCalls: [
        writeTool("log_entry", {
          ...inputOf(logCall({ code: CURRY, amount: 1, kcal: 1 })),
          kind: "quick",
          kcal: 600,
          protein_g: 40,
        }),
      ],
    });
    const macros = turnResult({
      toolCalls: [
        writeTool("log_entry", {
          ...inputOf(logCall({ code: CURRY, amount: 1, kcal: 1 })),
          protein_g: 40,
        }),
      ],
    });
    const madeUp = turnResult({ answer: "A curry is about 600 kcal and 40 g of protein." });

    for (const turn of [quick, macros, madeUp]) {
      expect(await failuresOf(id, [turn])).not.toEqual([]);
    }
  });
});
