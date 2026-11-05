// The ask-your-data set (KEY-699): 40 questions about the synthetic diary, each answered from the diary read
// tools. Every expected number and every expected citation line is worked out from the fixture with the same
// core functions the tools use (`fixtures/diaryTotals.ts`), so a change to the diary cannot leave a stale
// answer. The questions name their dates, worked out from the anchor date the eval user's diary is dated from.
//
// A case passes when the right tool was called for the right dates, the answer holds the numbers (to the
// Diary's rounding), the citation under the answer is the tool's, the Estimate label is there on a trend
// answer, nothing was written, and the reply never says "I".
import {
  TREND_ESTIMATE,
  describeDayCitation,
  describeRangeCitation,
  describeWeighInCitation,
} from "@keylow/core";
import { roundCalories, roundGrams } from "@keylow/core/format";

import { ASK_TARGETS } from "../fixtures/askExtras.ts";
import { diaryDateOf } from "../fixtures/diary.ts";
import { dayEntries, dayTotals, rangeTotals, weightRange } from "../fixtures/diaryTotals.ts";
import {
  answerContainsNumber,
  cacheReadOnSecondTurn,
  noActionRows,
  toolCalled,
} from "../src/case.ts";

import type { DayEntry } from "../fixtures/diaryTotals.ts";
import type { EvalCase, Grader } from "../src/case.ts";

const pass = (reason: string) => ({ passed: true, reason });
const fail = (reason: string) => ({ passed: false, reason });

/** Passes when the answer meta of the last turn holds one of these lines, which the tools build. */
export function citationIsOneOf(citations: readonly string[]): Grader {
  return (context) => {
    const citation = context.turns.at(-1)?.answerMeta?.citation ?? null;
    return Promise.resolve(
      citation !== null && citations.includes(citation)
        ? pass("the citation is the tool's")
        : fail(
            `the citation under the answer is not the tool's (wanted ${citations.join(" or ")})`,
          ),
    );
  };
}

/** Passes when the answer meta of the last turn carries the Estimate label. */
export function estimateLabelIs(label: string): Grader {
  return (context) =>
    Promise.resolve(
      context.turns.at(-1)?.answerMeta?.estimate === label
        ? pass("the Estimate label is there")
        : fail(`the Estimate label "${label}" is missing from the answer meta`),
    );
}

/** Passes when the last answer never says "I" as a word, which also catches I'm, I've and I'll. */
export function noFirstPerson(): Grader {
  return (context) =>
    Promise.resolve(
      /\bI\b/.test(context.turns.at(-1)?.answer ?? "")
        ? fail("the reply speaks in the first person")
        : pass("the reply has no first person"),
    );
}

// The read tools of the diary, which the ask set may use. The driver gives no `readOnlyHint` yet, so
// `noWrite()` would count every call as a write. `noActionRows()` checks the end state; this checks the names.
const READ_TOOLS: ReadonlySet<string> = new Set([
  "get_day",
  "get_range_totals",
  "get_entries",
  "get_weigh_ins",
  "get_food",
  "get_recipes",
  "search_foods",
]);

/** Passes when every tool called is a read tool. */
export function onlyReadTools(): Grader {
  return (context) => {
    const other = context.turns
      .flatMap((turn) => turn.toolCalls)
      .find((call) => !READ_TOOLS.has(call.name));
    return Promise.resolve(
      other === undefined
        ? pass("only read tools were called")
        : fail(`${other.name} is not a read tool`),
    );
  };
}

const plain = (text: string): string => text.toLowerCase().replaceAll("&", "and");

/** Passes when the last answer names the food or dish, in any case, with "&" read as "and". */
export function answerNames(name: string): Grader {
  return (context) =>
    Promise.resolve(
      plain(context.turns.at(-1)?.answer ?? "").includes(plain(name))
        ? pass(`the answer names ${name}`)
        : fail(`the answer does not name ${name}`),
    );
}

// An amount with its unit, such as "1,200 kcal", "85 g" or "80.5 kg". A date or a count of entries has none.
const AMOUNT_WITH_UNIT = /\d[\d,.]*\s*(?:kcal|calories|cals?|kg|kilos?|grams?|g)\b/i;

/** Passes when the last answer states no amount, which is what an empty range has to say. */
export function noAmountsStated(): Grader {
  return (context) =>
    Promise.resolve(
      AMOUNT_WITH_UNIT.test(context.turns.at(-1)?.answer ?? "")
        ? fail("the answer states an amount for a range with nothing in it")
        : pass("the answer states no amount"),
    );
}

export const ASK_AREAS = ["day", "range", "eaten", "weight", "empty"] as const;
export type AskArea = (typeof ASK_AREAS)[number];

type ReadTool = "get_day" | "get_range_totals" | "get_entries" | "get_weigh_ins";

type ToolWithArguments = Readonly<{ tool: ReadTool; arguments: Readonly<Record<string, string>> }>;

/** A call the case expects: any one of these, with at least these arguments (the model may add others). */
type CallExpectation = readonly [ToolWithArguments, ...ToolWithArguments[]];

type ExpectedNumber = Readonly<{ value: number; tolerance: number }>;

/** What a case expects, in plain data. The graders are made from it, and the tests read it too. */
export type AskSpec = Readonly<{
  id: string;
  area: AskArea;
  messages: readonly [string, ...string[]];
  calls: readonly CallExpectation[];
  numbers: readonly ExpectedNumber[];
  mentions: readonly string[];
  /** The lines the tools build for these dates. The answer meta of the last turn has to hold one. */
  citations: readonly string[];
  /** True when the answer rests on the trend weight, so the Estimate label is expected. */
  estimate: boolean;
  /** True for a range with nothing in it, where the answer must not state an amount. */
  noAmounts: boolean;
}>;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

function callMatching(alternatives: CallExpectation): Grader {
  return async (context) => {
    const outcomes = await Promise.all(
      alternatives.map(({ tool, arguments: expected }) =>
        toolCalled(
          tool,
          (input) =>
            isRecord(input) &&
            Object.entries(expected).every(([key, value]) => input[key] === value),
        )(context),
      ),
    );
    return (
      outcomes.find(({ passed }) => passed) ??
      fail(
        `none of ${alternatives.map(({ tool }) => tool).join(", ")} was called for the dates asked`,
      )
    );
  };
}

function gradersOf(spec: AskSpec): Grader[] {
  return [
    ...spec.calls.map(callMatching),
    ...spec.numbers.map(({ value, tolerance }) => answerContainsNumber(value, tolerance)),
    ...spec.mentions.map(answerNames),
    citationIsOneOf(spec.citations),
    ...(spec.estimate ? [estimateLabelIs(TREND_ESTIMATE)] : []),
    ...(spec.noAmounts ? [noAmountsStated()] : []),
    onlyReadTools(),
    noActionRows(),
    noFirstPerson(),
    ...(spec.messages.length > 1 ? [cacheReadOnSecondTurn()] : []),
  ];
}

// Numbers as the Diary prints them, with the room that rounding leaves: a whole number is read to within 1, a
// number under 10 to one decimal. A count is exact.
const kcal = (value: number): ExpectedNumber => ({ value: roundCalories(value), tolerance: 1 });
const grams = (value: number): ExpectedNumber => {
  const rounded = roundGrams(value);
  return { value: rounded, tolerance: Math.abs(rounded) < 10 ? 0.1 : 1 };
};
const kilograms = (value: number): ExpectedNumber => ({ value, tolerance: 0.1 });
const count = (value: number): ExpectedNumber => ({ value, tolerance: 0 });
// "Left" is negative when over target and the answer says "over by", so the size is what is looked for.
const size = ({ value, tolerance }: ExpectedNumber): ExpectedNumber => ({
  value: Math.abs(value),
  tolerance,
});

// How the answer is expected to name a recipe. A food is named by its fixture key, such as "salmon".
const RECIPE_WORDS = new Map<string, string>([
  ["Eval porridge bowl", "porridge"],
  ["Eval chicken and rice", "chicken and rice"],
]);
const wordsFor = (entries: readonly DayEntry[]): string[] => [
  ...new Set(entries.map(({ name }) => RECIPE_WORDS.get(name) ?? name)),
];

const longDate = (date: string): string =>
  new Date(`${date}T00:00:00Z`).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  });

const noNumbers: readonly ExpectedNumber[] = [];

/** Every case of the set, as plain data. `anchorDate` is the day after the diary's last day (today, in a run). */
export function askSpecs(anchorDate: string): readonly AskSpec[] {
  const date = (dayNumber: number) => diaryDateOf(anchorDate, dayNumber);
  const say = (dayNumber: number) => longDate(date(dayNumber));

  const dayCall = (dayNumber: number): CallExpectation => [
    { tool: "get_day", arguments: { local_date: date(dayNumber) } },
  ];
  // "What did I eat?" is answered from either tool, so either is accepted for the day.
  const eatenOnDay = (dayNumber: number): CallExpectation => [
    { tool: "get_day", arguments: { local_date: date(dayNumber) } },
    { tool: "get_entries", arguments: { from: date(dayNumber), to: date(dayNumber) } },
  ];
  const rangeCall = (tool: ReadTool, firstDay: number, lastDay: number): CallExpectation => [
    { tool, arguments: { from: date(firstDay), to: date(lastDay) } },
  ];

  const dayCitation = (dayNumber: number, entryCount: number) =>
    describeDayCitation({ localDate: date(dayNumber), today: anchorDate, entryCount });
  const rangeCitation = (firstDay: number, lastDay: number, entryCount: number) =>
    describeRangeCitation({ from: date(firstDay), to: date(lastDay), entryCount });
  // The two lines a question about what was eaten on one day can end with, whichever tool answered.
  const eatenCitations = (dayNumber: number, shown: number, all: number) => [
    ...new Set([
      dayCitation(dayNumber, all),
      rangeCitation(dayNumber, dayNumber, shown),
      rangeCitation(dayNumber, dayNumber, all),
    ]),
  ];
  const weighInCitation = (firstDay: number, lastDay: number) =>
    describeWeighInCitation({
      from: date(firstDay),
      to: date(lastDay),
      count: weightRange(anchorDate, firstDay, lastDay).weighIns.length,
    });

  const leftOf = (target: number | null, eaten: number | null) => (target ?? 0) - (eaten ?? 0);
  const daysAtTarget = (firstDay: number, lastDay: number, key: keyof typeof ASK_TARGETS) =>
    rangeTotals(firstDay, lastDay).days.filter(
      ({ totals }) => ASK_TARGETS[key] !== null && (totals[key] ?? 0) >= (ASK_TARGETS[key] ?? 0),
    ).length;

  const spec = (
    area: AskArea,
    id: string,
    messages: AskSpec["messages"],
    expected: Pick<AskSpec, "calls" | "citations"> & Partial<AskSpec>,
  ): AskSpec => ({
    mentions: [],
    numbers: noNumbers,
    estimate: false,
    noAmounts: false,
    ...expected,
    area,
    id,
    messages,
  });

  const dayEntryCount = (dayNumber: number) => dayEntries(dayNumber).length;
  const dayArea = (
    id: string,
    messages: AskSpec["messages"],
    dayNumber: number,
    numbers: readonly ExpectedNumber[],
  ) =>
    spec("day", id, messages, {
      calls: [dayCall(dayNumber)],
      numbers,
      citations: [dayCitation(dayNumber, dayEntryCount(dayNumber))],
    });

  const average = (firstDay: number, lastDay: number) => rangeTotals(firstDay, lastDay).average;
  const total = (firstDay: number, lastDay: number) => rangeTotals(firstDay, lastDay).total;
  const rangeArea = (
    id: string,
    messages: AskSpec["messages"],
    ranges: readonly (readonly [number, number])[],
    numbers: readonly ExpectedNumber[],
  ) => {
    const last = ranges.at(-1) ?? [0, 0];
    return spec("range", id, messages, {
      calls: ranges.map(([firstDay, lastDay]) => rangeCall("get_range_totals", firstDay, lastDay)),
      numbers,
      citations: [rangeCitation(last[0], last[1], rangeTotals(last[0], last[1]).entryCount)],
    });
  };

  const entriesBetween = (dayNumber: number, from: string | null, until: string | null) =>
    dayEntries(dayNumber).filter(
      ({ time }) => (from === null || time >= from) && (until === null || time <= until),
    );
  const eatenArea = (
    id: string,
    messages: AskSpec["messages"],
    dayNumber: number,
    shown: readonly DayEntry[],
    numbers: readonly ExpectedNumber[],
  ) =>
    spec("eaten", id, messages, {
      calls: [eatenOnDay(dayNumber)],
      mentions: wordsFor(shown),
      numbers,
      citations: eatenCitations(dayNumber, shown.length, dayEntryCount(dayNumber)),
    });
  const kcalOfEach = (entries: readonly DayEntry[]) =>
    entries.map(({ nutrients }) => kcal(nutrients.kcal ?? 0));

  const weightArea = (
    id: string,
    messages: AskSpec["messages"],
    ranges: readonly (readonly [number, number])[],
    numbers: readonly ExpectedNumber[],
  ) => {
    const last = ranges.at(-1) ?? [0, 0];
    return spec("weight", id, messages, {
      calls: ranges.map(([firstDay, lastDay]) => rangeCall("get_weigh_ins", firstDay, lastDay)),
      numbers,
      citations: [weighInCitation(last[0], last[1])],
      estimate: true,
    });
  };
  const weights = (firstDay: number, lastDay: number) =>
    weightRange(anchorDate, firstDay, lastDay).weighIns.map(({ weightKg }) => weightKg);

  const emptyDay = (id: string, message: string, dayNumber: number) =>
    spec("empty", id, [message], {
      calls: [eatenOnDay(dayNumber)],
      citations: eatenCitations(dayNumber, 0, 0),
      noAmounts: true,
    });

  const day = (dayNumber: number) => dayTotals(dayNumber);
  const trendOf = (firstDay: number, lastDay: number) => weightRange(anchorDate, firstDay, lastDay);
  const dinnerEntries = entriesBetween(37, "17:00", null);
  const biggestEntry = dayEntries(12).reduce((biggest, entry) =>
    (entry.nutrients.kcal ?? 0) > (biggest.nutrients.kcal ?? 0) ? entry : biggest,
  );
  const breakfastsOf = (firstDay: number, lastDay: number) =>
    Array.from({ length: lastDay - firstDay + 1 }, (_, offset) =>
      entriesBetween(firstDay + offset, null, "10:00"),
    ).flat();

  return [
    // Day totals and what is left.
    dayArea(
      "day-calories-yesterday",
      ["How many calories did I eat yesterday?", "And the day before?"],
      40,
      [kcal(day(40).kcal ?? 0)],
    ),
    dayArea("day-protein-on-a-date", [`How much protein did I eat on ${say(38)}?`], 38, [
      grams(day(38).protein_g ?? 0),
    ]),
    spec("day", "day-calories-left-today", ["How many calories do I have left today?"], {
      calls: [dayCall(42)],
      // Nothing is logged today, so the whole target is left.
      numbers: [kcal(ASK_TARGETS.kcal)],
      citations: [dayCitation(42, 0)],
    }),
    dayArea(
      "day-calories-left-on-a-date",
      [`How many calories did I have left on ${say(36)}?`],
      36,
      [size(kcal(leftOf(ASK_TARGETS.kcal, day(36).kcal)))],
    ),
    dayArea(
      "day-protein-left-on-a-date",
      [`How much protein did I have left to reach my target on ${say(33)}?`],
      33,
      [size(grams(leftOf(ASK_TARGETS.protein_g, day(33).protein_g)))],
    ),
    dayArea("day-all-macros", [`What were my protein, carbs and fat on ${say(30)}?`], 30, [
      grams(day(30).protein_g ?? 0),
      grams(day(30).carbs_g ?? 0),
      grams(day(30).fat_g ?? 0),
    ]),
    dayArea(
      "day-eaten-and-left",
      [`How many calories did I eat on ${say(27)}, and how many were left?`],
      27,
      [kcal(day(27).kcal ?? 0), size(kcal(leftOf(ASK_TARGETS.kcal, day(27).kcal)))],
    ),
    dayArea("day-fibre", [`How much fibre did I eat on ${say(25)}?`], 25, [
      grams(day(25).fibre_g ?? 0),
    ]),

    // Range averages and days at target.
    rangeArea(
      "range-average-calories-week",
      [`What was my average daily calorie intake from ${say(14)} to ${say(20)}?`],
      [[14, 20]],
      [kcal(average(14, 20).kcal ?? 0)],
    ),
    rangeArea(
      "range-average-protein-week",
      [`What was my average daily protein from ${say(21)} to ${say(27)}?`],
      [[21, 27]],
      [grams(average(21, 27).protein_g ?? 0)],
    ),
    rangeArea(
      "range-average-carbs-fortnight",
      [`What was my average daily carbs from ${say(28)} to ${say(41)}?`],
      [[28, 41]],
      [grams(average(28, 41).carbs_g ?? 0)],
    ),
    rangeArea(
      "range-average-fat-week",
      [`What was my average daily fat from ${say(7)} to ${say(13)}?`],
      [[7, 13]],
      [grams(average(7, 13).fat_g ?? 0)],
    ),
    rangeArea(
      "range-total-calories",
      [`How many calories did I eat in total from ${say(0)} to ${say(6)}?`],
      [[0, 6]],
      [kcal(total(0, 6).kcal ?? 0)],
    ),
    rangeArea(
      "range-days-at-calorie-target",
      [`On how many days from ${say(14)} to ${say(27)} did I reach my calorie target?`],
      [[14, 27]],
      [count(daysAtTarget(14, 27, "kcal"))],
    ),
    rangeArea(
      "range-days-at-protein-target",
      [`On how many days from ${say(0)} to ${say(13)} did I reach my protein target?`],
      [[0, 13]],
      [count(daysAtTarget(0, 13, "protein_g"))],
    ),
    rangeArea(
      "range-average-against-calorie-target",
      [
        `How far was my average daily calorie intake from my target between ${say(7)} and ${say(13)}?`,
      ],
      [[7, 13]],
      [size(kcal(leftOf(average(7, 13).kcal, ASK_TARGETS.kcal)))],
    ),
    rangeArea(
      "range-average-fibre",
      [`What was my average daily fibre from ${say(14)} to ${say(27)}?`],
      [[14, 27]],
      [grams(average(14, 27).fibre_g ?? 0)],
    ),
    rangeArea(
      "range-average-calories-then-the-week-before",
      [
        `What was my average daily calorie intake from ${say(28)} to ${say(34)}?`,
        "And for the 7 days before that?",
      ],
      [
        [28, 34],
        [21, 27],
      ],
      [kcal(average(21, 27).kcal ?? 0)],
    ),

    // What was eaten on a day or in an hour window.
    eatenArea(
      "eaten-on-a-day-then-the-day-after",
      [`What did I eat on ${say(18)}?`, "And the day after?"],
      19,
      dayEntries(19),
      [],
    ),
    eatenArea(
      "eaten-on-a-day-with-recipes",
      [`What did I eat on ${say(24)}?`],
      24,
      dayEntries(24),
      [],
    ),
    eatenArea(
      "eaten-at-midday",
      [`What did I eat between 12:00 and 14:00 on ${say(19)}?`],
      19,
      entriesBetween(19, "12:00", "14:00"),
      kcalOfEach(entriesBetween(19, "12:00", "14:00")),
    ),
    eatenArea(
      "eaten-after-six",
      [`What did I eat after 18:00 on ${say(22)}?`],
      22,
      entriesBetween(22, "18:00", null),
      kcalOfEach(entriesBetween(22, "18:00", null)),
    ),
    eatenArea(
      "eaten-before-ten",
      [`What did I eat before 10:00 on ${say(31)}?`],
      31,
      entriesBetween(31, null, "10:00"),
      kcalOfEach(entriesBetween(31, null, "10:00")),
    ),
    eatenArea(
      "eaten-for-dinner",
      [`What did I have for dinner on ${say(37)}?`],
      37,
      dinnerEntries,
      [],
    ),
    spec(
      "eaten",
      "eaten-breakfasts-over-three-days",
      [`What did I have for breakfast from ${say(5)} to ${say(7)}?`],
      {
        calls: [rangeCall("get_entries", 5, 7)],
        mentions: wordsFor(breakfastsOf(5, 7)),
        citations: [
          ...new Set([
            rangeCitation(5, 7, breakfastsOf(5, 7).length),
            rangeCitation(5, 7, rangeTotals(5, 7).entryCount),
          ]),
        ],
      },
    ),
    eatenArea(
      "eaten-biggest-entry",
      [`Which single entry had the most calories on ${say(12)}?`],
      12,
      [biggestEntry],
      [kcal(biggestEntry.nutrients.kcal ?? 0)],
    ),

    // Weigh-ins and the trend, each with the Estimate label.
    weightArea(
      "weight-trend-at-the-end",
      [`Between ${say(28)} and ${say(40)}, what is my trend weight at the end?`],
      [[28, 40]],
      [kilograms(trendOf(28, 40).trendEnd ?? 0)],
    ),
    weightArea(
      "weight-weekly-rate",
      [`How fast is my weight changing, looking at ${say(26)} to ${say(40)}?`],
      [[26, 40]],
      [size(kilograms(trendOf(26, 40).weeklyRateKg ?? 0))],
    ),
    weightArea(
      "weight-each-weigh-in",
      [`What did I weigh at each weigh-in from ${say(30)} to ${say(36)}?`],
      [[30, 36]],
      weights(30, 36).map(kilograms),
    ),
    weightArea(
      "weight-how-many-weigh-ins",
      [`How many times did I weigh in from ${say(20)} to ${say(33)}?`],
      [[20, 33]],
      [count(weights(20, 33).length)],
    ),
    weightArea(
      "weight-heaviest",
      [`What was my heaviest weigh-in from ${say(14)} to ${say(40)}?`],
      [[14, 40]],
      [kilograms(Math.max(...weights(14, 40)))],
    ),
    weightArea(
      "weight-lightest",
      [`What was my lightest weigh-in from ${say(0)} to ${say(20)}?`],
      [[0, 20]],
      [kilograms(Math.min(...weights(0, 20)))],
    ),
    weightArea(
      "weight-trend-start-and-end",
      [`What was my trend weight at the start and at the end of ${say(6)} to ${say(40)}?`],
      [[6, 40]],
      [kilograms(trendOf(6, 40).trendStart ?? 0), kilograms(trendOf(6, 40).trendEnd ?? 0)],
    ),
    weightArea(
      "weight-trend-then-another-range",
      [
        `What is my trend weight on ${say(40)}, looking back to ${say(28)}?`,
        `And on ${say(26)}, looking back to ${say(14)}?`,
      ],
      [
        [28, 40],
        [14, 26],
      ],
      [kilograms(trendOf(14, 26).trendEnd ?? 0)],
    ),

    // Empty ranges and dates before the first entry.
    emptyDay("empty-a-day-long-before-the-diary", `What did I eat on ${say(-20)}?`, -20),
    spec("empty", "empty-today", ["What have I eaten today?"], {
      calls: [eatenOnDay(42)],
      citations: eatenCitations(42, 0, 0),
      noAmounts: true,
    }),
    spec(
      "empty",
      "empty-range-before-the-diary",
      [`What was my average daily calorie intake from ${say(-30)} to ${say(-24)}?`],
      {
        calls: [rangeCall("get_range_totals", -30, -24)],
        citations: [rangeCitation(-30, -24, 0)],
        noAmounts: true,
      },
    ),
    spec(
      "empty",
      "empty-weigh-ins-before-the-diary",
      [`What did I weigh from ${say(-10)} to ${say(-3)}?`],
      {
        calls: [rangeCall("get_weigh_ins", -10, -3)],
        citations: [weighInCitation(-10, -3)],
        noAmounts: true,
      },
    ),
    spec(
      "empty",
      "empty-range-that-starts-before-the-diary",
      [`What was my average daily calorie intake from ${say(-3)} to ${say(3)}?`],
      {
        calls: [rangeCall("get_range_totals", -3, 3)],
        // Only the four days the diary has count, so the average is over those.
        numbers: [kcal(average(-3, 3).kcal ?? 0)],
        citations: [rangeCitation(-3, 3, rangeTotals(-3, 3).entryCount)],
      },
    ),
    emptyDay("empty-the-day-before-the-first-entry", `What did I eat on ${say(-1)}?`, -1),
  ];
}

/** The cases of the set for a diary dated from `anchorDate`. */
export function askCasesOf(anchorDate: string): readonly EvalCase[] {
  return askSpecs(anchorDate).map((spec) => ({
    id: spec.id,
    set: "ask",
    messages: spec.messages,
    expect: gradersOf(spec),
  }));
}

/** The set for a run now: the eval user's diary is dated from today (UTC), as `createFixtureUser` does. */
export const askCases: readonly EvalCase[] = askCasesOf(new Date().toISOString().slice(0, 10));
