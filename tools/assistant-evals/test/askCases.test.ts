import { readFileSync, readdirSync } from "node:fs";

import { sumEntries } from "@keylow/core/diary";
import { roundCalories, roundGrams } from "@keylow/core/format";
import { describe, expect, it } from "vitest";

import { fakeDatabase, readTool, turnResult, writeTool } from "./helpers.ts";
import {
  answerNames,
  askCasesOf,
  askSpecs,
  citationIsOneOf,
  estimateLabelIs,
  noAmountsStated,
  DIARY_READ_TOOLS,
  noFirstPerson,
  onlyReadTools,
  READ_TOOLS,
} from "../cases/ask.ts";
import { ASK_TARGETS } from "../fixtures/askExtras.ts";
import { diaryDateOf } from "../fixtures/diary.ts";
import { dayEntries as entriesOf, dayTotals, rangeTotals } from "../fixtures/diaryTotals.ts";
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

// The calls that satisfy an expectation, by its first route. A route that covers dates is several get_day calls.
const callsOf = (route: AskSpec["calls"][number][number]) =>
  "covers" in route
    ? route.covers.map((localDate) => readTool("get_day", { local_date: localDate }))
    : [readTool(route.tool, route.arguments)];

// The reply a model that did everything right would give, made from the spec and nothing else.
function perfectTurn(spec: AskSpec, overrides: Partial<TurnResult> = {}): TurnResult {
  return turnResult({
    answer: [
      ...spec.mentions.map(([firstWord]) => firstWord),
      ...spec.numbers.map(({ value }) => String(value)),
      spec.noAmounts ? "Nothing is logged there." : "",
    ].join(", "),
    toolCalls: spec.calls.flatMap(([first]) => callsOf(first)),
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

  it("should have 41 cases, in the five areas of the ticket", () => {
    expect(cases).toHaveLength(41);
    expect([
      countOf("day"),
      countOf("range"),
      countOf("eaten"),
      countOf("weight"),
      countOf("empty"),
    ]).toEqual([8, 10, 9, 8, 6]);
  });

  it("should belong to the ask set, which has the 90 % threshold", () => {
    expect(cases.every(({ set }) => set === "ask")).toBe(true);
    expect(THRESHOLD_PERCENT.ask).toBe(90);
  });

  it("should give every case its own id and its own question", () => {
    expect(new Set(cases.map(({ id }) => id)).size).toBe(41);
    const finalQuestions = cases.flatMap(({ messages }) => messages.slice(-1));
    expect(new Set(finalQuestions).size).toBe(41);
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

    it("should pass when several reads joined their lines with a dot and one is the expected line", async () => {
      const turn = turnResult({
        answerMeta: {
          citation: "Based on 9 entries, 5 to 11 Oct · No entries today",
          estimate: null,
        },
      });

      expect((await grade(contextOf([turn]))).passed).toBe(true);
    });

    it("should fail when a part is not a line any read tool gives", async () => {
      const turn = turnResult({
        answerMeta: { citation: "No entries today · Trust me, it was fine", estimate: null },
      });

      expect((await grade(contextOf([turn]))).passed).toBe(false);
    });

    it("should fail when no part is the expected line", async () => {
      const turn = turnResult({
        answerMeta: {
          citation: "Based on 9 entries, 5 to 11 Oct · No entries, 1 Sep",
          estimate: null,
        },
      });

      expect((await grade(contextOf([turn]))).passed).toBe(false);
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

    it.each(["search_exercises", "get_routines", "get_training_goals"])(
      "should fail on %s, which is the wrong tool for a question about the diary",
      async (tool) => {
        const turn = turnResult({ toolCalls: [readTool("get_day"), readTool(tool)] });

        expect((await onlyReadTools()(contextOf([turn]))).passed).toBe(false);
      },
    );
  });

  describe("answerNames", () => {
    it("should pass when the answer names the food, in any case, and reads & as and", async () => {
      const turn = turnResult({ answer: "Salmon, potatoes and Chicken & Rice." });

      expect((await answerNames("salmon")(contextOf([turn]))).passed).toBe(true);
      expect((await answerNames("chicken and rice")(contextOf([turn]))).passed).toBe(true);
    });

    it("should pass for any spelling it is given, such as yoghurt for yogurt", async () => {
      const turn = turnResult({ answer: "Greek yoghurt with an apple." });

      expect((await answerNames("yogurt", "yoghurt")(contextOf([turn]))).passed).toBe(true);
    });

    it("should fail when the food is not named", async () => {
      const turn = turnResult({ answer: "Salmon and potatoes." });

      expect((await answerNames("broccoli")(contextOf([turn]))).passed).toBe(false);
    });
  });

  describe("noAmountsStated, with the amounts a target allows", () => {
    const allowed = noAmountsStated([1300, 90]);

    it("should pass for an amount equal to a target", async () => {
      const turn = turnResult({ answer: "Nothing yet, so all 1,300 kcal and 90 g are left." });

      expect((await allowed(contextOf([turn]))).passed).toBe(true);
    });

    it.each(["You ate 1,300 kcal today.", "You ate 90 g of protein.", "Today you had 1,300 kcal."])(
      "should fail for a target figure that is not said of the target or of what is left: %j",
      async (answer) => {
        expect((await allowed(contextOf([turnResult({ answer })]))).passed).toBe(false);
      },
    );

    it.each([
      "All 1,300 kcal of your target are left.",
      "Nothing is logged, so 1,300 kcal remain.",
      "Your goal is 1,300 kcal.",
      "Nothing yet, so 1,300 kcal to go.",
    ])(
      "should pass for a target figure said of the target or of what is left: %j",
      async (answer) => {
        expect((await allowed(contextOf([turnResult({ answer })]))).passed).toBe(true);
      },
    );

    it("should fail for any other amount", async () => {
      const turn = turnResult({ answer: "All 1,300 kcal are left after 250 kcal." });

      expect((await allowed(contextOf([turn]))).passed).toBe(false);
    });
  });

  describe("noAmountsStated, what it prints", () => {
    it("should show the stray amount with about 40 characters of its clause each side", async () => {
      const answer =
        "Nothing is logged for that day, so there is no way you ate 1,300 kcal of anything that I could name here.";

      const outcome = await noAmountsStated([90])(contextOf([turnResult({ answer })]));

      expect(outcome.passed).toBe(false);
      expect(outcome.reason).toBe(
        'the answer states an amount for a range with nothing in it: "so there is no way you ate [1,300 kcal] of anything that I could name here"',
      );
    });

    it("should cut the context at the clause, so a long answer prints a short line", async () => {
      const outcome = await noAmountsStated()(
        contextOf([turnResult({ answer: "Fine. You had 250 g of oats. Then nothing." })]),
      );

      expect(outcome.reason).toBe(
        'the answer states an amount for a range with nothing in it: "You had [250 g] of oats"',
      );
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

describe("a failing case", () => {
  const evalCase = cases.find(({ id }) => id === "range-average-calories-week");
  const spec = specs.find(({ id }) => id === "range-average-calories-week");

  it("should print the question, the tools called with their arguments and the expected number", async () => {
    if (evalCase === undefined || spec === undefined) {
      throw new Error("the case is not registered");
    }
    const turn = turnResult({
      answer: "It was 999 kcal.",
      toolCalls: [readTool("get_range_totals", { from: "2026-10-05", to: "2026-10-11" })],
      answerMeta: { citation: spec.citations[0] ?? null, estimate: null },
    });

    const reasons = await failuresOf(evalCase, [turn]);

    expect(reasons).toHaveLength(1);
    expect(reasons[0]).toContain(`question: "${spec.messages[0]}"`);
    expect(reasons[0]).toContain(
      'tools: get_range_totals({"from":"2026-10-05","to":"2026-10-11"})',
    );
    expect(reasons[0]).toContain(String(spec.numbers[0]?.value));
  });

  it("should name no tool when none was called, and never print the answer", async () => {
    if (evalCase === undefined) {
      throw new Error("the case is not registered");
    }

    const reasons = await failuresOf(evalCase, [turnResult({ answer: "Secret diary text 1234." })]);

    expect(reasons.length).toBeGreaterThan(0);
    for (const reason of reasons) {
      expect(reason).toContain("tools: none");
      expect(reason).not.toContain("Secret diary text");
    }
  });
});

describe("the routes the set accepts", () => {
  const callsOfCase = (id: string) => {
    const found = specs.find((spec) => spec.id === id);
    if (found === undefined) {
      throw new Error(`no spec ${id}`);
    }
    return found;
  };
  const run = (id: string, turn: TurnResult) => {
    const evalCase = cases.find((candidate) => candidate.id === id);
    if (evalCase === undefined) {
      throw new Error(`no case ${id}`);
    }
    return failuresOf(evalCase, [turn]);
  };

  it("should take get_range_totals over one day for a question about a day's totals", async () => {
    const spec = callsOfCase("day-protein-on-a-date");
    const date = diaryDateOf(ANCHOR, 38);
    const turn = perfectTurn(spec, {
      toolCalls: [readTool("get_range_totals", { from: date, to: date })],
      answerMeta: { citation: spec.citations.at(-1) ?? null, estimate: null },
    });

    expect(await run("day-protein-on-a-date", turn)).toEqual([]);
  });

  it("should take one get_day call per day for a question about three days", async () => {
    const spec = callsOfCase("eaten-breakfasts-over-three-days");
    const turn = perfectTurn(spec, {
      toolCalls: ["2026-09-26", "2026-09-27", "2026-09-28"].map((localDate) =>
        readTool("get_day", { local_date: localDate }),
      ),
    });

    expect(await run("eaten-breakfasts-over-three-days", turn)).toEqual([]);
  });

  it("should fail a question about three days when one of them was never read", async () => {
    const spec = callsOfCase("eaten-breakfasts-over-three-days");
    const turn = perfectTurn(spec, {
      toolCalls: ["2026-09-26", "2026-09-27"].map((localDate) =>
        readTool("get_day", { local_date: localDate }),
      ),
    });

    expect(await run("eaten-breakfasts-over-three-days", turn)).not.toEqual([]);
  });

  it("should accept 1,300 kcal said of the target on an empty day, and no other amount", async () => {
    const spec = callsOfCase("empty-today");
    const good = perfectTurn(spec, {
      answer: "Nothing is logged yet, so all 1,300 kcal are left.",
    });
    const bad = perfectTurn(spec, { answer: "Nothing is logged, you ate 1,200 kcal." });

    expect(await run("empty-today", good)).toEqual([]);
    expect(await run("empty-today", bad)).not.toEqual([]);
  });

  it("should not take the porridge bowl for oats, nor oats for the porridge bowl", async () => {
    const spec = callsOfCase("eaten-breakfasts-over-three-days");
    const withoutOats = perfectTurn(spec, { answer: "Yogurt, apple, porridge, egg, bread." });
    const withoutBowl = perfectTurn(spec, { answer: "Yogurt, apple, oats, egg, bread." });
    const both = perfectTurn(spec, { answer: "Yogurt, apple, oats, porridge bowl, egg, bread." });

    expect(await run("eaten-breakfasts-over-three-days", withoutOats)).not.toEqual([]);
    expect(await run("eaten-breakfasts-over-three-days", withoutBowl)).not.toEqual([]);
    expect(await run("eaten-breakfasts-over-three-days", both)).toEqual([]);
  });

  it("should not ask for a minor item such as 10 g of olive oil", () => {
    const spec = callsOfCase("eaten-after-six");

    expect(spec.mentions.flat()).not.toContain("oil");
    expect(spec.numbers.map(({ value }) => value)).not.toContain(90);
  });

  it("should ask for the calories of each item where it expects them", () => {
    for (const id of ["eaten-at-midday", "eaten-after-six", "eaten-before-ten"]) {
      expect(callsOfCase(id).messages[0]).toMatch(/how many calories (?:was|were) each/i);
    }
  });

  // KEY-975. A meal is a window of hours, and its total is the totals get_entries gives for the window.
  describe("the meal total case", () => {
    const lunch = entriesOf(20).filter(({ time }) => time >= "12:00" && time <= "14:00");

    it("should ask for the calories and macros of lunch, and expect the sum of the lunch entries", () => {
      const spec = callsOfCase("eaten-lunch-total");
      const sum = sumEntries(lunch);

      expect(lunch.length).toBeGreaterThan(1);
      expect(spec.messages[0]).toMatch(/calories and macros of my lunch/i);
      expect(spec.numbers.map(({ value }) => value)).toEqual([
        roundCalories(sum.kcal ?? Number.NaN),
        roundGrams(sum.protein_g ?? Number.NaN),
        roundGrams(sum.fat_g ?? Number.NaN),
        roundGrams(sum.carbs_g ?? Number.NaN),
        roundGrams(sum.fibre_g ?? Number.NaN),
      ]);
    });

    it("should expect get_entries, because get_day cannot total a meal", async () => {
      const spec = callsOfCase("eaten-lunch-total");
      const perfect = perfectTurn(spec);
      const dayOnly = {
        ...perfect,
        toolCalls: [readTool("get_day", { local_date: diaryDateOf(ANCHOR, 20) })],
      };

      expect(await run("eaten-lunch-total", perfect)).toEqual([]);
      expect(await run("eaten-lunch-total", dayOnly)).not.toEqual([]);
    });

    it("should fail when the reply leaves the totals out", async () => {
      const spec = callsOfCase("eaten-lunch-total");
      const noTotals = { ...perfectTurn(spec), answer: "Chicken, rice and broccoli." };

      expect(await run("eaten-lunch-total", noTotals)).not.toEqual([]);
    });
  });

  it("should word the second range of the trend case as a range of its own", () => {
    expect(callsOfCase("weight-trend-then-another-range").messages[1]).toMatch(/^And from .+ to /);
  });
});

describe("READ_TOOLS", () => {
  const toolsFolder = new URL(
    "../../../packages/db/supabase/functions/_shared/assistant/tools/",
    import.meta.url,
  );

  // A tool file says `name: "get_day"` and `kind: "read"`. Test files, fixtures and helpers say neither.
  const readToolsOfRegistry = readdirSync(toolsFolder)
    .filter((file) => file.endsWith(".ts") && !file.endsWith(".test.ts"))
    .flatMap((file) => {
      const source = readFileSync(new URL(file, toolsFolder), "utf8");
      if (/^\s+group: "kitchen",$/m.test(source)) {
        return [];
      }
      const name = /^\s+name: "([a-z_]+)",$/m.exec(source)?.[1];
      return name !== undefined && /^\s+kind: "read",$/m.test(source) ? [name] : [];
    });

  it("should be exactly the read-kind tools of the registry, so a new read tool cannot fail cases", () => {
    expect([...READ_TOOLS].sort()).toEqual([...readToolsOfRegistry].sort());
  });

  it("should include ask_user, which a question may end on", () => {
    expect(READ_TOOLS.has("ask_user")).toBe(true);
  });

  it("should hold the training reads, which the diary cases do not accept", () => {
    for (const tool of [
      "search_exercises",
      "get_routines",
      "get_training_goals",
      "get_exercise_progress",
      "show_exercise_muscles",
    ]) {
      expect(READ_TOOLS.has(tool)).toBe(true);
      expect(DIARY_READ_TOOLS.has(tool)).toBe(false);
    }
  });

  it("should give the diary cases every read tool but the training reads and estimate_portions", () => {
    const trainingReads = [
      "search_exercises",
      "get_routines",
      "get_training_goals",
      "get_muscle_state",
      "suggest_next_session",
      "get_workouts",
      "get_exercise_progress",
      "show_exercise_muscles",
      "show_exercise_form",
      "estimate_portions",
    ];

    expect([...DIARY_READ_TOOLS].sort()).toEqual(
      [...READ_TOOLS].filter((tool) => !trainingReads.includes(tool)).sort(),
    );
  });
});
