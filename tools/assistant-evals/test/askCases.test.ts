import { describe, expect, it } from "vitest";

import { fakeDatabase, readTool, turnResult, writeTool } from "./helpers.ts";
import {
  answerNames,
  askCasesOf,
  askSpecs,
  citationIsOneOf,
  estimateLabelIs,
  noAmountsStated,
  noFirstPerson,
  onlyReadTools,
} from "../cases/ask.ts";
import { ASK_TARGETS } from "../fixtures/askExtras.ts";
import { dayTotals, rangeTotals } from "../fixtures/diaryTotals.ts";
import { THRESHOLD_PERCENT } from "../src/thresholds.ts";

import type { AskArea, AskSpec } from "../cases/ask.ts";
import type { EvalCase, GradeContext } from "../src/case.ts";
import type { TurnResult } from "../src/types.ts";

const ANCHOR = "2026-11-02";
const specs = askSpecs(ANCHOR);
const cases = askCasesOf(ANCHOR);

const contextOf = (turns: readonly TurnResult[], database = fakeDatabase()): GradeContext => ({
  turns,
  database,
});

async function failuresOf(
  evalCase: EvalCase,
  turns: readonly TurnResult[],
  database = fakeDatabase(),
) {
  const outcomes = await Promise.all(
    evalCase.expect.map((grade) => grade(contextOf(turns, database))),
  );
  return outcomes.filter(({ passed }) => !passed).map(({ reason }) => reason);
}

// The reply a model that did everything right would give, made from the spec and nothing else.
function perfectTurn(spec: AskSpec, overrides: Partial<TurnResult> = {}): TurnResult {
  return turnResult({
    answer: [
      ...spec.mentions,
      ...spec.numbers.map(({ value }) => String(value)),
      spec.noAmounts ? "Nothing is logged there." : "",
    ].join(", "),
    toolCalls: spec.calls.map(([first]) => readTool(first.tool, first.arguments)),
    answerMeta: {
      citation: spec.citations[0] ?? null,
      estimate: spec.estimate ? "Trend weight is an estimate" : null,
    },
    ...overrides,
  });
}

const perfectTurns = (spec: AskSpec): TurnResult[] =>
  spec.messages.length === 1
    ? [perfectTurn(spec)]
    : [turnResult({ answer: "First answer." }), perfectTurn(spec)];

function perfectDatabase(spec: AskSpec, turns: readonly TurnResult[]) {
  const second = turns[1];
  return fakeDatabase(
    second === undefined || spec.messages.length < 2
      ? {}
      : { firstCallByTurnId: { [second.turnId]: { cacheReadInputTokens: 500 } } },
  );
}

describe("the ask set", () => {
  const countOf = (area: AskArea) => specs.filter((spec) => spec.area === area).length;

  it("should have 40 cases, in the five areas of the ticket", () => {
    expect(cases).toHaveLength(40);
    expect([
      countOf("day"),
      countOf("range"),
      countOf("eaten"),
      countOf("weight"),
      countOf("empty"),
    ]).toEqual([8, 10, 8, 8, 6]);
  });

  it("should belong to the ask set, which has the 90 % threshold", () => {
    expect(cases.every(({ set }) => set === "ask")).toBe(true);
    expect(THRESHOLD_PERCENT.ask).toBe(90);
  });

  it("should give every case its own id and its own question", () => {
    expect(new Set(cases.map(({ id }) => id)).size).toBe(40);
    const finalQuestions = cases.flatMap(({ messages }) => messages.slice(-1));
    expect(new Set(finalQuestions).size).toBe(40);
  });

  it("should have four two-turn cases", () => {
    expect(specs.filter(({ messages }) => messages.length === 2)).toHaveLength(4);
    expect(specs.filter(({ messages }) => messages.length > 2)).toHaveLength(0);
  });

  it("should say Ki-Lo and use no em dash in any question", () => {
    for (const message of cases.flatMap(({ messages }) => messages)) {
      expect(message).not.toMatch(/—/);
      expect(message).not.toMatch(/Ki Lo|KiLo/);
    }
  });

  it("should date the questions from the anchor, so the same anchor gives the same set", () => {
    expect(askCasesOf(ANCHOR).map(({ messages }) => messages)).toEqual(
      cases.map(({ messages }) => messages),
    );
    expect(askCasesOf("2026-12-10").map(({ messages }) => messages)).not.toEqual(
      cases.map(({ messages }) => messages),
    );
  });

  it("should ask for the Estimate label on the weight cases that have weigh-ins, and nowhere else", () => {
    const withLabel = specs.filter(({ estimate }) => estimate).map(({ area }) => area);

    expect(new Set(withLabel)).toEqual(new Set(["weight"]));
    expect(withLabel.length).toBeGreaterThanOrEqual(7);
  });

  it("should work every expected number out of the fixture", () => {
    const yesterday = specs.find(({ id }) => id === "day-calories-yesterday");
    const calories = dayTotals(40).kcal ?? Number.NaN;

    expect(yesterday?.numbers.map(({ value }) => value)).toEqual([Math.round(calories)]);
    const week = specs.find(({ id }) => id === "range-average-calories-week");
    expect(week?.numbers[0]?.value).toBe(
      Math.round(rangeTotals(14, 20).average.kcal ?? Number.NaN),
    );
  });

  it("should count the days at target against the targets the eval user is given", () => {
    const days = specs.find(({ id }) => id === "range-days-at-calorie-target");
    const reached = rangeTotals(14, 27).days.filter(
      ({ totals }) => (totals.kcal ?? 0) >= ASK_TARGETS.kcal,
    ).length;

    expect(days?.numbers.map(({ value }) => value)).toEqual([reached]);
    expect(reached).toBeGreaterThan(0);
  });
});

describe.each(cases.map((evalCase, index) => ({ evalCase, spec: specs[index] })))(
  "the case $evalCase.id",
  ({ evalCase, spec }) => {
    if (spec === undefined) {
      throw new Error("no spec for the case");
    }

    it("should pass for the reply the fixture says is right", async () => {
      const turns = perfectTurns(spec);

      expect(await failuresOf(evalCase, turns, perfectDatabase(spec, turns))).toEqual([]);
    });

    it("should fail when the reply says a first-person word", async () => {
      const turns = perfectTurns(spec);
      const last = turns.at(-1);
      if (last === undefined) {
        throw new Error("no turn");
      }
      const wrong = [...turns.slice(0, -1), { ...last, answer: `${last.answer}. I checked.` }];

      expect(await failuresOf(evalCase, wrong, perfectDatabase(spec, turns))).toContainEqual(
        expect.stringMatching(/first person/),
      );
    });

    it("should fail when a tool that writes was called", async () => {
      const turns = perfectTurns(spec);
      const last = turns.at(-1);
      if (last === undefined) {
        throw new Error("no turn");
      }
      const wrong = [
        ...turns.slice(0, -1),
        { ...last, toolCalls: [...last.toolCalls, writeTool("log_entry")] },
      ];

      expect(await failuresOf(evalCase, wrong, perfectDatabase(spec, turns))).not.toEqual([]);
    });

    it("should fail when the citation under the answer is not the tool's", async () => {
      const turns = perfectTurns(spec);
      const last = turns.at(-1);
      if (last === undefined) {
        throw new Error("no turn");
      }
      const wrong = [
        ...turns.slice(0, -1),
        {
          ...last,
          answerMeta: {
            citation: "Based on 3 entries",
            estimate: last.answerMeta?.estimate ?? null,
          },
        },
      ];

      expect(await failuresOf(evalCase, wrong, perfectDatabase(spec, turns))).toContainEqual(
        expect.stringMatching(/citation/),
      );
    });
  },
);

describe("the graders of the ask set", () => {
  describe("citationIsOneOf", () => {
    const grade = citationIsOneOf([
      "Based on 4 entries today and your targets",
      "No entries today",
    ]);

    it("should pass when the answer meta holds one of the citations", async () => {
      const turn = turnResult({ answerMeta: { citation: "No entries today", estimate: null } });

      expect((await grade(contextOf([turn]))).passed).toBe(true);
    });

    it("should fail when the turn sent no answer meta", async () => {
      expect((await grade(contextOf([turnResult()]))).passed).toBe(false);
    });

    it("should fail when the citation is another line", async () => {
      const turn = turnResult({ answerMeta: { citation: "Based on 9 entries", estimate: null } });

      expect((await grade(contextOf([turn]))).passed).toBe(false);
    });
  });

  describe("estimateLabelIs", () => {
    const grade = estimateLabelIs("Trend weight is an estimate");

    it("should pass when the answer meta carries the label", async () => {
      const turn = turnResult({
        answerMeta: { citation: "x", estimate: "Trend weight is an estimate" },
      });

      expect((await grade(contextOf([turn]))).passed).toBe(true);
    });

    it("should fail when the label is missing", async () => {
      const turn = turnResult({ answerMeta: { citation: "x", estimate: null } });

      expect((await grade(contextOf([turn]))).passed).toBe(false);
    });
  });

  describe("noFirstPerson", () => {
    it("should pass for a reply with no I", async () => {
      const turn = turnResult({ answer: "Ki-Lo shows 1,306 kcal. It is item A of the list." });

      expect((await noFirstPerson()(contextOf([turn]))).passed).toBe(true);
    });

    it.each(["I think so.", "Here is what I found.", "I'm sure.", "I've checked it."])(
      "should fail for %j",
      async (answer) => {
        expect((await noFirstPerson()(contextOf([turnResult({ answer })]))).passed).toBe(false);
      },
    );
  });

  describe("onlyReadTools", () => {
    it("should pass when every call is a read tool of the diary", async () => {
      const turn = turnResult({ toolCalls: [readTool("get_day"), readTool("get_weigh_ins")] });

      expect((await onlyReadTools()(contextOf([turn]))).passed).toBe(true);
    });

    it("should fail on a tool that writes", async () => {
      const turn = turnResult({ toolCalls: [readTool("get_day"), writeTool("log_entry")] });

      expect((await onlyReadTools()(contextOf([turn]))).passed).toBe(false);
    });
  });

  describe("answerNames", () => {
    it("should pass when the answer names the food, in any case, and reads & as and", async () => {
      const turn = turnResult({ answer: "Salmon, potatoes and Chicken & Rice." });

      expect((await answerNames("salmon")(contextOf([turn]))).passed).toBe(true);
      expect((await answerNames("chicken and rice")(contextOf([turn]))).passed).toBe(true);
    });

    it("should fail when the food is not named", async () => {
      const turn = turnResult({ answer: "Salmon and potatoes." });

      expect((await answerNames("broccoli")(contextOf([turn]))).passed).toBe(false);
    });
  });

  describe("noAmountsStated", () => {
    it("should pass for an answer that says nothing was logged", async () => {
      const turn = turnResult({ answer: "Nothing is logged for 1 September." });

      expect((await noAmountsStated()(contextOf([turn]))).passed).toBe(true);
    });

    it.each([
      "You ate 1,200 kcal.",
      "That was 85 g of protein.",
      "About 80.5 kg.",
      "2000 calories.",
    ])("should fail for %j", async (answer) => {
      expect((await noAmountsStated()(contextOf([turnResult({ answer })]))).passed).toBe(false);
    });
  });
});
