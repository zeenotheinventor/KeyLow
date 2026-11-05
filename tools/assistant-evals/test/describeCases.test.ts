import { describe, expect, it } from "vitest";

import { fakeEnvironment } from "./fakeEnvironment.ts";
import { readTool, turnResult, writeTool } from "./helpers.ts";
import { rowDatabase } from "./rowDatabase.ts";
import { describeCasesOf, describeSpecs } from "../cases/describe.ts";
import { portionsOf } from "../fixtures/describeExtras.ts";
import { THRESHOLD_PERCENT } from "../src/thresholds.ts";

import type { DescribeSpec } from "../cases/describe.ts";
import type { ExpectedItem } from "../cases/entryGraders.ts";
import type { EvalCase } from "../src/case.ts";
import type { EvalDatabase, TurnResult } from "../src/types.ts";
import type { AssistantCard } from "@keylow/core";

const ANCHOR = "2026-11-05";
const specs = describeSpecs(ANCHOR);
const cases = describeCasesOf(ANCHOR);

type LogSpec = Extract<DescribeSpec, { kind: "log" }>;
type ClarifySpec = Extract<DescribeSpec, { kind: "clarify" }>;

const logSpecs = specs.filter((spec): spec is LogSpec => spec.kind === "log");
const clarifySpecs = specs.filter((spec): spec is ClarifySpec => spec.kind === "clarify");

const caseOf = (id: string): EvalCase => {
  const found = cases.find((candidate) => candidate.id === id);
  if (found === undefined) {
    throw new Error(`No case ${id}`);
  }
  return found;
};

const logSpecOf = (id: string): LogSpec => {
  const found = logSpecs.find((candidate) => candidate.id === id);
  if (found === undefined) {
    throw new Error(`No log spec ${id}`);
  }
  return found;
};

const card = (kind: AssistantCard["kind"]): AssistantCard => ({
  actionIds: ["33333333-3333-4333-8333-333333333333"],
  kind,
  title: "Title",
  sub: null,
  rows: [],
  totalText: null,
  note: null,
  link: null,
  undo: "available",
  undoneSub: null,
});

// What a model that did everything right would send, and the rows the seed and the write would leave.
const foodIdOf = (code: string) => `food-${code}`;
const portionIdOf = (code: string) => `portion-${code}`;

function logCallOf(item: ExpectedItem) {
  const [code] = item.codes;
  const isPortion = !("grams" in item.amount);
  return writeTool("log_entry", {
    kind: isPortion ? "portion" : "grams",
    food_id: foodIdOf(code),
    portion_id: isPortion ? portionIdOf(code) : null,
    count: "count" in item.amount ? item.amount.count : isPortion ? 1 : null,
    grams: "grams" in item.amount ? item.amount.grams : null,
    ml: null,
    recipe_id: null,
    servings: null,
    kcal: null,
    protein_g: null,
    carbs_g: null,
    fat_g: null,
    label: null,
    local_date: item.date ?? null,
    time:
      item.time === undefined || item.time === "morning" || item.time === "any" ? null : item.time,
  });
}

function rowsFor(items: readonly ExpectedItem[], turn: TurnResult) {
  const codes = items.map(({ codes: [code] }) => code);
  return {
    foods: codes.map((code) => ({ id: foodIdOf(code), source: "cofid", source_ref: code })),
    food_portions: codes
      .filter((code) => portionsOf(code).length > 0)
      .map((code) => ({ id: portionIdOf(code), food_id: foodIdOf(code) })),
    assistant_actions: items.map((_item, index) => ({
      turn_id: turn.turnId,
      tool: "log_entry",
      target_id: `entry-${turn.turnId}-${index}`,
    })),
    food_log_entries: items.map((item, index) => {
      const [code] = item.codes;
      const grams = "grams" in item.amount;
      return {
        id: `entry-${turn.turnId}-${index}`,
        food_id: foodIdOf(code),
        portion_id: grams ? null : portionIdOf(code),
        unit: grams ? "g" : "portion",
        quantity:
          "grams" in item.amount
            ? item.amount.grams
            : "count" in item.amount
              ? item.amount.count
              : 1,
        local_date: item.date ?? ANCHOR,
        deleted_at: null,
      };
    }),
  };
}

function perfectLog(spec: LogSpec, overrides: Partial<TurnResult> = {}) {
  const turn = turnResult({
    answer: "Logged.",
    toolCalls: [readTool("search_foods", { q: "food", limit: 5 }), ...spec.items.map(logCallOf)],
    cards: [card("logged")],
    ...overrides,
  });
  return { turn, database: rowDatabase(rowsFor(spec.items, turn)) };
}

async function failuresOf(evalCase: EvalCase, turn: TurnResult, database: EvalDatabase) {
  const outcomes = await Promise.all(
    evalCase.expect.map((grade) => grade({ turns: [turn], database })),
  );
  return outcomes.filter(({ passed }) => !passed).map(({ reason }) => reason);
}

const asking = (question: string, replies: string[] = []) =>
  turnResult({
    status: "clarify",
    toolCalls: [
      readTool("search_foods", { q: "rice", limit: 5 }),
      readTool("ask_user", { question, quick_replies: replies }),
    ],
  });

describe("the describe set", () => {
  it("should have 21 cases: 16 that log, 4 that ask and the milestone's own sentence", () => {
    expect(cases).toHaveLength(21);
    expect(logSpecs).toHaveLength(16);
    expect(clarifySpecs).toHaveLength(4);
    expect(specs.filter(({ kind }) => kind === "brief")).toHaveLength(1);
  });

  it("should belong to the describe set, which has the 80 % threshold", () => {
    expect(cases.every(({ set }) => set === "describe")).toBe(true);
    expect(THRESHOLD_PERCENT.describe).toBe(80);
  });

  it("should give every case its own id and its own message, and send one message", () => {
    expect(new Set(cases.map(({ id }) => id)).size).toBe(21);
    expect(new Set(cases.flatMap(({ messages }) => messages)).size).toBe(21);
    expect(cases.every(({ messages }) => messages.length === 1)).toBe(true);
  });

  it("should say it plainly: no em dash, and no hand measure to log from", () => {
    for (const { message } of specs) {
      expect(message).not.toMatch(/—/);
      expect(message).not.toMatch(/Ki Lo|KiLo/);
    }
    // A bowl is a hand measure, so it only appears in a message that must end in a question.
    for (const { message } of logSpecs) {
      expect(message).not.toMatch(/\b(?:bowl|handful|fist|palm|thumb|cup|glass)\b/i);
    }
  });

  it("should have the three-item breakfast with an entry for each item", () => {
    expect(logSpecOf("describe-eggs-toast-and-banana").items).toHaveLength(3);
  });

  it("should have the milestone's own sentence word for word, as its own case", () => {
    expect(specs.map((spec) => spec.message)).toContain(
      "I had two eggs, toast with butter and a flat white.",
    );
  });

  it("should have the clarify case for some chicken and rice, with three others", () => {
    expect(clarifySpecs.map(({ id }) => id)).toContain("describe-some-chicken-and-rice");
  });

  it("should ask about the food or the amount where the food has no portion and no amount was given", () => {
    expect(
      clarifySpecs.filter(({ asksAboutFoodOrAmount }) => asksAboutFoodOrAmount).map(({ id }) => id),
    ).toEqual(["describe-some-rice", "describe-a-bowl-of-pasta"]);
  });

  it("should let every food that comes in sizes, given no size, be answered with one question about the size", () => {
    expect(logSpecs.filter(({ mayAskAboutSize }) => mayAskAboutSize).map(({ id }) => id)).toEqual([
      "describe-two-eggs",
      "describe-a-banana",
      "describe-eggs-toast-and-banana",
      "describe-an-apple-at-three",
      "describe-a-croissant",
      "describe-an-orange-and-a-kiwi",
      "describe-a-boiled-potato",
      "describe-yesterday-at-eight",
      "describe-lunch-at-half-past-twelve",
    ]);
  });

  it("should expect a count only of foods that have portions, and grams only when the message gave them", () => {
    for (const { message, items } of logSpecs) {
      for (const { codes, amount } of items) {
        if ("count" in amount) {
          expect(codes.every((code) => portionsOf(code).length > 0)).toBe(true);
        } else if ("grams" in amount) {
          expect(message).toContain(`${amount.grams} g`);
        }
      }
    }
  });

  it("should expect a time or a day only where the message names one", () => {
    for (const { message, items } of logSpecs) {
      for (const { time, date } of items) {
        if (time !== undefined && time !== "morning") {
          const [hour = ""] = time.split(":");
          expect(message).toMatch(
            new RegExp(`\\b0?${Number(hour) % 12 || 12}(?::\\d\\d)?\\s?(?:am|pm)?|\\b${time}`),
          );
        }
        if (time === "morning") {
          expect(message).toMatch(/breakfast/);
        }
        if (date !== undefined) {
          expect(message).toMatch(/yesterday/i);
        }
      }
    }
  });

  it("should take yesterday from the anchor, so the same anchor gives the same set", () => {
    expect(logSpecOf("describe-yesterday-at-eight").items[0].date).toBe("2026-11-04");
    expect(describeSpecs("2026-12-10")).not.toEqual(specs);
  });
});

describe("a log case", () => {
  it.each(logSpecs.map(({ id }) => [id]))(
    "%s should pass the turn a model would give if it were right",
    async (id) => {
      const { turn, database } = perfectLog(logSpecOf(id));

      expect(await failuresOf(caseOf(id), turn, database)).toEqual([]);
    },
  );

  it("should fail when a count is logged as guessed grams", async () => {
    const guessed = writeTool("log_entry", {
      kind: "grams",
      food_id: foodIdOf("14-318"),
      portion_id: null,
      count: null,
      grams: 118,
      time: null,
      local_date: null,
    });
    const { turn, database } = perfectLog(logSpecOf("describe-a-banana"), { toolCalls: [guessed] });

    const failures = await failuresOf(caseOf("describe-a-banana"), turn, database);

    expect(failures.length).toBeGreaterThan(0);
    expect(failures[0]).toContain("no route passed");
    expect(failures[0]).toContain('messages: "I ate a banana."');
    expect(failures[0]).toContain("tools: log_entry(");
  });

  it("should fail when the call was right and the row it left was not", async () => {
    const spec = logSpecOf("describe-two-eggs");
    const { turn, database } = perfectLog(spec);
    const wrongRow = rowDatabase({
      ...rowsFor(spec.items, turn),
      food_log_entries: [
        {
          id: `entry-${turn.turnId}-0`,
          food_id: foodIdOf("12-937"),
          portion_id: portionIdOf("12-937"),
          unit: "portion",
          quantity: 3,
          local_date: ANCHOR,
          deleted_at: null,
        },
      ],
    });

    const failures = await failuresOf(caseOf("describe-two-eggs"), turn, wrongRow);

    expect(failures).toHaveLength(1);
    expect(failures[0]).toContain("no logged entry matched item 1 of 1");
    expect(database).toBeDefined();
  });

  it("should fail when the write was repeated, which leaves two action rows", async () => {
    const spec = logSpecOf("describe-two-eggs");
    const turn = turnResult({
      toolCalls: spec.items.map(logCallOf),
      cards: [card("logged")],
    });
    const rows = rowsFor(spec.items, turn);
    const database = rowDatabase({
      ...rows,
      assistant_actions: [...rows.assistant_actions, ...rows.assistant_actions],
    });

    const failures = await failuresOf(caseOf("describe-two-eggs"), turn, database);

    expect(failures[0]).toContain("log_entry left 2 action rows, not 1");
  });

  it("should fail when the turn sent a card of another kind", async () => {
    const { turn, database } = perfectLog(logSpecOf("describe-two-eggs"), {
      cards: [card("deleted")],
    });

    const failures = await failuresOf(caseOf("describe-two-eggs"), turn, database);

    expect(failures).toEqual([expect.stringContaining("turn 1 sent no logged card")]);
  });

  it("should fail when the assistant asked instead of logging a food with no size to ask about", async () => {
    const failures = await failuresOf(
      caseOf("describe-three-slices-of-cheddar"),
      asking("Which cheddar?"),
      rowDatabase({}),
    );

    expect(failures.length).toBeGreaterThanOrEqual(3);
  });

  it("should pass one question about the size for a food that comes in sizes, with nothing written", async () => {
    const turn = asking("Which size banana?", ["small", "medium", "large"]);

    expect(await failuresOf(caseOf("describe-a-banana"), turn, rowDatabase({}))).toEqual([]);
  });

  it("should fail a question about the size for a food that gave a size", async () => {
    const turn = asking("Which size bagel?", ["small", "medium", "large"]);

    expect(await failuresOf(caseOf("describe-a-medium-bagel"), turn, rowDatabase({}))).not.toEqual(
      [],
    );
  });

  it("should fail a question about something other than the size for a food that comes in sizes", async () => {
    const turn = asking("Was it ripe?");

    expect(await failuresOf(caseOf("describe-a-banana"), turn, rowDatabase({}))).not.toEqual([]);
  });

  it("should pass a morning time for the breakfast, and fail an afternoon one", async () => {
    const spec = logSpecOf("describe-eggs-toast-and-banana");
    const morning = spec.items.map((item) => ({ ...item, time: "08:00" }));
    const afternoon = spec.items.map((item) => ({ ...item, time: "15:00" }));

    for (const [items, shouldPass] of [
      [morning, true],
      [afternoon, false],
    ] as const) {
      const turn = turnResult({
        toolCalls: items.map((item) =>
          writeTool("log_entry", { ...logCallInput(item), time: item.time }),
        ),
        cards: [card("logged")],
      });
      const database = rowDatabase(rowsFor(spec.items, turn));

      const failures = await failuresOf(caseOf("describe-eggs-toast-and-banana"), turn, database);

      expect(failures.length === 0).toBe(shouldPass);
    }
  });

  it("should fail when a tool outside the read tools and log_entry was called", async () => {
    const { turn, database } = perfectLog(logSpecOf("describe-two-eggs"));
    const withDelete = { ...turn, toolCalls: [...turn.toolCalls, writeTool("delete_entry", {})] };

    const failures = await failuresOf(caseOf("describe-two-eggs"), withDelete, database);

    expect(failures[0]).toContain("delete_entry was called");
  });

  it("should take its entries out again afterwards, and fail loudly when Undo could not", async () => {
    const turn = turnResult();
    const environment = fakeEnvironment({ undoPresses: { [turn.turnId]: [["undone"]] } });

    await caseOf("describe-two-eggs").cleanUp?.([turn], environment);

    expect(environment.calls).toEqual([`undo ${turn.turnId}`]);
    await expect(
      caseOf("describe-two-eggs").cleanUp?.(
        [turn],
        fakeEnvironment({ undoPresses: { [turn.turnId]: [["undo_unavailable"]] } }),
      ),
    ).rejects.toThrow("could not be undone");
  });
});

function logCallInput(item: ExpectedItem): Record<string, unknown> {
  const call = logCallOf(item);
  return typeof call.input === "object" && call.input !== null ? { ...call.input } : {};
}

describe("a clarify case", () => {
  it.each(clarifySpecs.map(({ id }) => [id]))(
    "%s should pass one question and no write",
    async (id) => {
      const turn = asking("How many grams was it?", ["100 g", "150 g"]);

      expect(await failuresOf(caseOf(id), turn, rowDatabase({}))).toEqual([]);
    },
  );

  it("should fail when the assistant logged a guess instead of asking", async () => {
    const turn = turnResult({ toolCalls: [writeTool("log_entry", { kind: "grams", grams: 150 })] });
    const database = rowDatabase({
      assistant_actions: [{ turn_id: turn.turnId, tool: "log_entry" }],
    });

    const failures = await failuresOf(caseOf("describe-some-chicken-and-rice"), turn, database);

    expect(
      failures.some((reason) => reason.includes("the case left rows in assistant_actions")),
    ).toBe(true);
    expect(failures.some((reason) => reason.includes("log_entry is not a read tool"))).toBe(true);
  });

  it("should fail when two questions were asked", async () => {
    const turn = turnResult({
      status: "clarify",
      toolCalls: [
        readTool("ask_user", { question: "How much?", quick_replies: [] }),
        readTool("ask_user", { question: "Which?", quick_replies: [] }),
      ],
    });

    const failures = await failuresOf(
      caseOf("describe-some-chicken-and-rice"),
      turn,
      rowDatabase({}),
    );

    expect(failures[0]).toContain("2 questions were asked, not 1");
  });

  it("should pass the rice question in any words that ask about the food or the amount", async () => {
    for (const question of [
      "How much rice was it?",
      "Which rice was it?",
      "How many grams of rice?",
    ]) {
      expect(
        await failuresOf(caseOf("describe-some-rice"), asking(question), rowDatabase({})),
      ).toEqual([]);
    }
  });

  it("should fail the rice question when it is about neither the food nor the amount", async () => {
    const failures = await failuresOf(
      caseOf("describe-some-rice"),
      asking("Was it nice?"),
      rowDatabase({}),
    );

    expect(failures).toHaveLength(1);
    expect(failures[0]).toContain("does not ask about the food or the amount");
  });

  it("should pass a logged slice of cheese for some cheese, as well as one question", async () => {
    const item: ExpectedItem = { codes: ["12-346"], amount: { count: 1 } };
    const turn = turnResult({ toolCalls: [logCallOf(item)], cards: [card("logged")] });

    expect(
      await failuresOf(caseOf("describe-some-cheese"), turn, rowDatabase(rowsFor([item], turn))),
    ).toEqual([]);
    expect(
      await failuresOf(caseOf("describe-some-cheese"), asking("Which cheese?"), rowDatabase({})),
    ).toEqual([]);
  });

  it("should fail some cheese logged in guessed grams", async () => {
    const guessed: ExpectedItem = { codes: ["12-346"], amount: { grams: 30 } };
    const turn = turnResult({ toolCalls: [logCallOf(guessed)], cards: [card("logged")] });

    const failures = await failuresOf(
      caseOf("describe-some-cheese"),
      turn,
      rowDatabase(rowsFor([guessed], turn)),
    );

    expect(failures[0]).toContain("no route passed");
  });

  it("should clean up even when it only asked, because the Undo of a turn that wrote nothing is empty", async () => {
    const environment = fakeEnvironment();

    await caseOf("describe-some-rice").cleanUp?.([turnResult()], environment);

    expect(environment.calls).toHaveLength(1);
  });
});

describe("the milestone's sentence", () => {
  const id = "describe-eggs-toast-butter-and-a-flat-white";
  const eggs: ExpectedItem = { codes: ["12-940"], amount: { count: 2 } };
  const toast: ExpectedItem = { codes: ["11-982"], amount: { count: 1 } };

  it("should pass one question and nothing written", async () => {
    expect(await failuresOf(caseOf(id), asking("How much butter?"), rowDatabase({}))).toEqual([]);
  });

  it("should pass a question about the food or the amount, and fail one about something else", async () => {
    expect(await failuresOf(caseOf(id), asking("How much butter?"), rowDatabase({}))).toEqual([]);
    const failures = await failuresOf(caseOf(id), asking("What time was that?"), rowDatabase({}));

    expect(failures[0]).toContain("no route passed");
    expect(failures[0]).toContain("does not ask about the food or the amount");
  });

  it("should pass portions of the eggs and the toast", async () => {
    const turn = turnResult({
      toolCalls: [logCallOf(eggs), logCallOf(toast)],
      cards: [card("logged")],
    });

    expect(await failuresOf(caseOf(id), turn, rowDatabase(rowsFor([eggs, toast], turn)))).toEqual(
      [],
    );
  });

  it("should fail two eggs logged with the rest dropped in silence", async () => {
    const turn = turnResult({ toolCalls: [logCallOf(eggs)], cards: [card("logged")] });

    const failures = await failuresOf(caseOf(id), turn, rowDatabase(rowsFor([eggs], turn)));

    expect(failures[0]).toContain("no log_entry call matched item 2 of 2");
  });

  it("should fail a guessed weight of butter", async () => {
    const butter: ExpectedItem = { codes: ["11-982"], amount: { grams: 10 } };
    const turn = turnResult({
      toolCalls: [logCallOf(eggs), logCallOf(butter)],
      cards: [card("logged")],
    });

    const failures = await failuresOf(caseOf(id), turn, rowDatabase(rowsFor([eggs, butter], turn)));

    expect(failures[0]).toContain("log_entry guessed an amount (kind grams)");
  });

  it("should fail a food that is not one of the real ones", async () => {
    const milk: ExpectedItem = { codes: ["12-313"], amount: { count: 1 } };
    const turn = turnResult({
      toolCalls: [logCallOf(eggs), logCallOf(milk)],
      cards: [card("logged")],
    });

    const failures = await failuresOf(caseOf(id), turn, rowDatabase(rowsFor([eggs, milk], turn)));

    expect(failures[0]).toContain("logged a food that is not one of the real ones");
  });
});
