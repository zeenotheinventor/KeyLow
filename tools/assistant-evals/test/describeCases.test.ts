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

const specOf = (id: string): DescribeSpec => {
  const found = specs.find((candidate) => candidate.id === id);
  if (found === undefined) {
    throw new Error(`No spec ${id}`);
  }
  return found;
};

// What a model that did everything right would send, and the rows the seed and the write would leave.
const foodIdOf = (code: string) => `food-${code}`;
const portionIdOf = (code: string) => `portion-${code}`;

function logCallOf(item: ExpectedItem) {
  const [code] = item.codes;
  return writeTool("log_entry", {
    kind: "count" in item.amount ? "portion" : "grams",
    food_id: foodIdOf(code),
    portion_id: "count" in item.amount ? portionIdOf(code) : null,
    count: "count" in item.amount ? item.amount.count : null,
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
    time: item.time ?? null,
  });
}

function databaseFor(items: readonly ExpectedItem[], actionsPerTurn: Record<string, number> = {}) {
  const codes = items.map(({ codes: [code] }) => code);
  return {
    foods: codes.map((code) => ({ id: foodIdOf(code), source: "cofid", source_ref: code })),
    food_portions: codes
      .filter((code) => portionsOf(code).length > 0)
      .map((code) => ({ id: portionIdOf(code), food_id: foodIdOf(code) })),
    assistant_actions: Object.entries(actionsPerTurn).flatMap(([turnId, count]) =>
      Array.from({ length: count }, () => ({ turn_id: turnId, tool: "log_entry" })),
    ),
  };
}

function perfectLog(spec: LogSpec, overrides: Partial<TurnResult> = {}) {
  const turn = turnResult({
    answer: "Logged.",
    toolCalls: [readTool("search_foods", { q: "food", limit: 5 }), ...spec.items.map(logCallOf)],
    ...overrides,
  });
  const database = rowDatabase(databaseFor(spec.items, { [turn.turnId]: spec.items.length }));
  return { turn, database };
}

async function failuresOf(evalCase: EvalCase, turn: TurnResult, database: EvalDatabase) {
  const outcomes = await Promise.all(
    evalCase.expect.map((grade) => grade({ turns: [turn], database })),
  );
  return outcomes.filter(({ passed }) => !passed).map(({ reason }) => reason);
}

describe("the describe set", () => {
  it("should have 20 cases, 16 that log and 4 that ask", () => {
    expect(cases).toHaveLength(20);
    expect(logSpecs).toHaveLength(16);
    expect(clarifySpecs).toHaveLength(4);
  });

  it("should belong to the describe set, which has the 80 % threshold", () => {
    expect(cases.every(({ set }) => set === "describe")).toBe(true);
    expect(THRESHOLD_PERCENT.describe).toBe(80);
  });

  it("should give every case its own id and its own message, and send one message", () => {
    expect(new Set(cases.map(({ id }) => id)).size).toBe(20);
    expect(new Set(cases.flatMap(({ messages }) => messages)).size).toBe(20);
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

  it("should have the three-item brief with an entry for each item", () => {
    const brief = specOf("describe-eggs-toast-and-banana");

    expect(brief.kind === "log" && brief.items).toHaveLength(3);
  });

  it("should have the clarify case for some chicken and rice, with three others", () => {
    expect(specOf("describe-some-chicken-and-rice").kind).toBe("clarify");
    expect(clarifySpecs.map(({ id }) => id)).toContain("describe-some-chicken-and-rice");
  });

  it("should ask for grams where the food has no portion and no amount was given", () => {
    const asksForGrams = clarifySpecs.filter(({ asksForGrams: asks }) => asks);

    expect(asksForGrams.map(({ id }) => id)).toEqual([
      "describe-some-rice",
      "describe-a-bowl-of-pasta",
    ]);
  });

  it("should expect a count only of foods that have portions, and grams only when the message gave them", () => {
    for (const { message, items } of logSpecs) {
      for (const { codes, amount } of items) {
        if ("count" in amount) {
          expect(codes.every((code) => portionsOf(code).length > 0)).toBe(true);
        } else {
          expect(message).toContain(`${amount.grams} g`);
        }
      }
    }
  });

  it("should expect a time or a day only where the message names one", () => {
    for (const { message, items } of logSpecs) {
      for (const { time, date } of items) {
        if (time !== undefined) {
          const [hour = ""] = time.split(":");
          expect(message).toMatch(
            new RegExp(`\\b0?${Number(hour) % 12 || 12}(?::\\d\\d)?\\s?(?:am|pm)?|\\b${time}`),
          );
        }
        if (date !== undefined) {
          expect(message).toMatch(/yesterday/i);
        }
      }
    }
  });

  it("should take yesterday from the anchor, so the same anchor gives the same set", () => {
    const eight = specOf("describe-yesterday-at-eight");

    expect(eight.kind === "log" && eight.items[0].date).toBe("2026-11-04");
    expect(describeSpecs("2026-12-10")).not.toEqual(specs);
  });
});

describe("a log case", () => {
  it.each(logSpecs.map(({ id }) => [id]))(
    "%s should pass the turn a model would give if it were right",
    async (id) => {
      const spec = specOf(id);
      if (spec.kind !== "log") {
        throw new Error("not a log case");
      }
      const { turn, database } = perfectLog(spec);

      expect(await failuresOf(caseOf(id), turn, database)).toEqual([]);
    },
  );

  it("should fail when a count is logged as guessed grams", async () => {
    const spec = specOf("describe-a-banana");
    if (spec.kind !== "log") {
      throw new Error("not a log case");
    }
    const guessed = writeTool("log_entry", {
      kind: "grams",
      food_id: foodIdOf("14-318"),
      portion_id: null,
      count: null,
      grams: 118,
      time: null,
      local_date: null,
    });
    const { turn, database } = perfectLog(spec, { toolCalls: [guessed] });

    const failures = await failuresOf(caseOf("describe-a-banana"), turn, database);

    expect(failures).toHaveLength(1);
    expect(failures[0]).toContain("no log_entry call matched item 1 of 1");
    expect(failures[0]).toContain('messages: "I ate a banana."');
    expect(failures[0]).toContain("tools: log_entry(");
  });

  it("should fail when the write was repeated, which leaves two action rows", async () => {
    const spec = specOf("describe-two-eggs");
    if (spec.kind !== "log") {
      throw new Error("not a log case");
    }
    const turn = turnResult({ toolCalls: spec.items.map(logCallOf) });
    const database = rowDatabase(databaseFor(spec.items, { [turn.turnId]: 2 }));

    const failures = await failuresOf(caseOf("describe-two-eggs"), turn, database);

    expect(failures[0]).toContain("log_entry left 2 action rows, not 1");
  });

  it("should fail when the assistant asked instead of logging", async () => {
    const spec = specOf("describe-two-eggs");
    if (spec.kind !== "log") {
      throw new Error("not a log case");
    }
    const turn = turnResult({
      status: "clarify",
      toolCalls: [readTool("ask_user", { question: "Which eggs?", quick_replies: [] })],
    });

    const failures = await failuresOf(
      caseOf("describe-two-eggs"),
      turn,
      rowDatabase(databaseFor(spec.items)),
    );

    expect(failures.length).toBeGreaterThanOrEqual(3);
  });

  it("should fail when a tool outside the read tools and log_entry was called", async () => {
    const spec = specOf("describe-two-eggs");
    if (spec.kind !== "log") {
      throw new Error("not a log case");
    }
    const { turn, database } = perfectLog(spec);
    const withDelete = { ...turn, toolCalls: [...turn.toolCalls, writeTool("delete_entry", {})] };

    const failures = await failuresOf(caseOf("describe-two-eggs"), withDelete, database);

    expect(failures[0]).toContain("delete_entry was called");
  });

  it("should take its entries out again afterwards, because they are for today", async () => {
    const environment = fakeEnvironment();
    const turn = turnResult();

    await caseOf("describe-two-eggs").cleanUp?.([turn], environment);

    expect(environment.calls).toEqual([`undo ${turn.turnId}`]);
  });
});

describe("a clarify case", () => {
  const asking = (question: string, replies: string[] = []) =>
    turnResult({
      status: "clarify",
      toolCalls: [
        readTool("search_foods", { q: "rice", limit: 5 }),
        readTool("ask_user", { question, quick_replies: replies }),
      ],
    });

  it.each(clarifySpecs.map(({ id }) => [id]))(
    "%s should pass one question and no write",
    async (id) => {
      const turn = asking("How many grams was it?", ["100 g", "150 g"]);

      expect(await failuresOf(caseOf(id), turn, rowDatabase({}))).toEqual([]);
    },
  );

  it("should fail when the assistant logged a guess instead of asking", async () => {
    const turn = turnResult({
      toolCalls: [writeTool("log_entry", { kind: "grams", grams: 150 })],
    });
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

  it("should fail the grams cases when the question does not ask for grams", async () => {
    const turn = asking("How much rice was it?", ["a bowl", "a plate"]);

    const failures = await failuresOf(caseOf("describe-some-rice"), turn, rowDatabase({}));

    expect(failures).toHaveLength(1);
    expect(failures[0]).toContain("does not ask for an amount in grams");
  });

  it("should not ask for grams on the cases where the food or its type is the doubt", async () => {
    const turn = asking("Which cheese was it?", ["Cheddar", "Brie"]);

    expect(await failuresOf(caseOf("describe-some-cheese"), turn, rowDatabase({}))).toEqual([]);
  });

  it("should leave nothing to clean up, because nothing was written", () => {
    expect(caseOf("describe-some-rice").cleanUp).toBeUndefined();
  });
});
