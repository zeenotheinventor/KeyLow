// The graders of the training advice set (KEY-895). They read tool calls, statuses, rows and the numbers in an
// answer, and never ask a model. See `trainingAdvice.ts` for how a case uses them.
import { READ_TOOLS } from "./ask.ts";
import { answerContainsNumber, noActionRows } from "../src/case.ts";

import type { GradeOutcome, Grader } from "../src/case.ts";
import type { ToolCall } from "../src/types.ts";

export const pass = (reason: string): GradeOutcome => ({ passed: true, reason });
export const fail = (reason: string): GradeOutcome => ({ passed: false, reason });

export type GradeContext = Parameters<Grader>[0];

export const answerOf = (context: GradeContext): string => context.turns.at(-1)?.answer ?? "";
export const callsOf = (context: GradeContext): ToolCall[] =>
  context.turns.flatMap((turn) => turn.toolCalls);

export const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

export type ExpectedNumber = Readonly<{ value: number; tolerance: number }>;

/** Satisfied when the answer holds any one of these numbers or any one of these words. */
export type Evidence = Readonly<{
  numbers?: readonly ExpectedNumber[];
  words?: readonly string[];
}>;

/** All its evidence has to be in the answer. */
export type Route = readonly Evidence[];

/** The loads, set counts and rep ranges some tool of the case could have given. Zero is always allowed. */
export type AllowedFigures = Readonly<{
  loads: readonly number[];
  setCounts: readonly number[];
  repRanges: readonly (readonly [number, number])[];
}>;

// ---------------------------------------------------------------------------------------------------------
// Failing the set
// ---------------------------------------------------------------------------------------------------------

/**
 * Marks a grader critical: when it fails, the set fails whatever its percentage. The writes and the tools that
 * are not reads are the cases of it, because one of those is a fault that no pass rate can make up for.
 */
export const critical =
  (grade: Grader): Grader =>
  async (context) => {
    const outcome = await grade(context);
    return outcome.passed ? outcome : { ...outcome, critical: true };
  };

/**
 * Marks a grader soft: when it fails, the case counts as a miss in the percentage and is no missed must-pass.
 */
export const soft =
  (grade: Grader): Grader =>
  async (context) => {
    const outcome = await grade(context);
    return outcome.passed ? outcome : { ...outcome, soft: true };
  };

// "I", "I'm", "I've", "I'll" and "I'd", with a straight or a curly apostrophe.
const FIRST_PERSON = /\bI(?:['\u2019](?:m|ve|ll|d))?(?![\w'\u2019])/g;
// A numeral and not the pronoun: "I." or "I)" starting a list item, and "Type I", "Part I" and the like.
const ROMAN_NUMERAL_BEFORE =
  /\b(?:type|part|level|phase|grade|stage|class|set|step|day|week|block|tier)\s+$/i;
const CONTEXT_CHARACTERS = 20;

/**
 * Passes when the reply never says "I" as a word. The prompt forbids the first person, and the food sets use the
 * same check, apart from the numeral. A failure says the word and about 40 characters around it, and no more of
 * the answer: the eval user is synthetic, and the slip cannot be told from the words without seeing it.
 */
export function noFirstPersonWithContext(): Grader {
  return (context) => {
    const answer = answerOf(context).replaceAll(/\s+/g, " ");
    for (const match of answer.matchAll(FIRST_PERSON)) {
      const start = match.index;
      const after = answer.slice(start + match[0].length);
      const isNumeral =
        match[0] === "I" &&
        (/^[.)](?:\s|$)/.test(after) || ROMAN_NUMERAL_BEFORE.test(answer.slice(0, start)));
      if (!isNumeral) {
        const before = answer.slice(Math.max(0, start - CONTEXT_CHARACTERS), start);
        const following = answer.slice(
          start + match[0].length,
          start + match[0].length + CONTEXT_CHARACTERS,
        );
        return Promise.resolve(
          fail(`the reply speaks in the first person: "${before}[${match[0]}]${following}"`),
        );
      }
    }
    return Promise.resolve(pass("the reply has no first person"));
  };
}

/** Passes when every tool called is a read tool. This set builds its allowed tools from `READ_TOOLS`. */
export function onlyTrainingReadTools(): Grader {
  return (context) => {
    const other = callsOf(context).find((call) => !READ_TOOLS.has(call.name));
    return Promise.resolve(
      other === undefined
        ? pass("only read tools were called")
        : fail(`${other.name} is not a read tool`),
    );
  };
}

export const noWriteRows = (): Grader => noActionRows();

/** Passes when the last turn ended with an answer, or with a question when the case allows one. */
export function endedWell(mayClarify: boolean): Grader {
  return (context) => {
    const status = context.turns.at(-1)?.status;
    return Promise.resolve(
      status === "complete" || (mayClarify && status === "clarify")
        ? pass("the turn ended with an answer")
        : fail(`the last turn ended ${status ?? "never"}`),
    );
  };
}

/** Passes when the last turn ended with a clarifying question, which a case may take in place of an answer. */
export const endedWithQuestion = (context: GradeContext): boolean =>
  context.turns.at(-1)?.status === "clarify";

// ---------------------------------------------------------------------------------------------------------
// The line under the answer, the markers and the two rules of the tools
// ---------------------------------------------------------------------------------------------------------

// A turn that read twice sends its lines joined with " · " (the turn loop's `distinctLine`).
const CITATION_SEPARATOR = " · ";
// Every line the read tools build starts one of these ways.
// The diary's lines are a tool's too, because a model may read the day beside the workout.
const TOOL_CITATION = /^(?:Based on .+|No (?:sets|workouts|weeks of|entries|weigh-ins)\b.*)$/;

/**
 * Passes when the line under the answer is made of lines a training read tool builds, and one of them is an
 * expected line. With no expected line the case needs none, but a line under the answer still has to be a tool's.
 */
export function citationIsTheTools(citations: readonly (string | RegExp)[]): Grader {
  return (context) => {
    const line = context.turns.at(-1)?.answerMeta?.citation ?? null;
    const parts = (line ?? "").split(CITATION_SEPARATOR).filter((part) => part !== "");
    if (!parts.every((part) => TOOL_CITATION.test(part))) {
      return Promise.resolve(fail("the citation under the answer is not a tool's"));
    }
    const isExpected = (part: string) =>
      citations.some((wanted) =>
        typeof wanted === "string" ? wanted === part : wanted.test(part),
      );
    return Promise.resolve(
      citations.length === 0 || parts.some(isExpected)
        ? pass("the citation is the tool's")
        : fail("the citation under the answer is not the tool's for these figures"),
    );
  };
}

// The names of the markers and fields the training tools give. A marker is put into words and never named.
const MARKER_NAMES =
  /\b(?:needs_goal|first_visit|in_progress|done_today|stall_may_be_longer|weeks_without_progress|limited_to|is_rest_day|no_room|plan_adjusted|plan_day|ready_at|week_start|exercise_id)\b/i;

/** Passes when the answer prints no marker or field name of a tool. */
export function noMarkerNames(): Grader {
  return (context) =>
    Promise.resolve(
      MARKER_NAMES.test(answerOf(context))
        ? fail("the answer prints the name of a marker")
        : pass("the answer prints no marker name"),
    );
}

/** Passes when the answer never calls the rolling 7 days "this week", which a calendar week would be. */
export function neverSaysThisWeek(): Grader {
  return (context) =>
    Promise.resolve(
      /\bthis week\b/i.test(answerOf(context))
        ? fail('the answer calls the last 7 days "this week"')
        : pass('the answer does not say "this week"'),
    );
}

/** Passes when a stall the tool could not count to its start is said with "at least". */
export function saysAtLeast(): Grader {
  return (context) =>
    Promise.resolve(
      /\bat least\b/i.test(answerOf(context))
        ? pass('the answer says "at least"')
        : fail(
            'the stall runs back further than the tool could count and the answer does not say "at least"',
          ),
    );
}

// ---------------------------------------------------------------------------------------------------------
// Figures
// ---------------------------------------------------------------------------------------------------------

const NUMBER_WORDS = [
  "zero",
  "one",
  "two",
  "three",
  "four",
  "five",
  "six",
  "seven",
  "eight",
  "nine",
  "ten",
  "eleven",
  "twelve",
] as const;

// A word is looked for at the start of a word, so "ready" is found in "readiness" and "now" is not found in "know".
// A word with an apostrophe is looked for anywhere, because "didn't" and "n't" have no word start to hold on to.
const hasWord = (answer: string, word: string): boolean => {
  const text = answer.replaceAll("\u2019", "'").toLowerCase();
  const wanted = word.toLowerCase();
  return wanted.includes("'")
    ? text.includes(wanted)
    : new RegExp(`\\b${wanted.replaceAll(/[.*+?^${}()|[\]\\]/g, "\\$&")}`).test(text);
};

async function holdsNumber(
  context: GradeContext,
  { value, tolerance }: ExpectedNumber,
): Promise<boolean> {
  if ((await answerContainsNumber(value, tolerance)(context)).passed) {
    return true;
  }
  const word = Number.isInteger(value) ? NUMBER_WORDS[value] : undefined;
  return word !== undefined && new RegExp(`\\b${word}\\b`, "i").test(answerOf(context));
}

async function holdsEvidence(context: GradeContext, evidence: Evidence): Promise<boolean> {
  const answer = answerOf(context);
  if ((evidence.words ?? []).some((word) => hasWord(answer, word))) {
    return true;
  }
  const outcomes = await Promise.all(
    (evidence.numbers ?? []).map((number) => holdsNumber(context, number)),
  );
  return outcomes.some(Boolean);
}

const describeEvidence = ({ numbers = [], words = [] }: Evidence): string =>
  [...numbers.map(({ value }) => String(value)), ...words.map((word) => `"${word}"`)].join(" or ");

/** Passes when some route has all its evidence in the answer. A numbers word for 0 to 12 counts as the number. */
export function answerHoldsARoute(routes: readonly Route[]): Grader {
  return async (context) => {
    const held = await Promise.all(
      routes.map((route) =>
        Promise.all(route.map((evidence) => holdsEvidence(context, evidence))).then((all) =>
          all.every(Boolean),
        ),
      ),
    );
    if (held.some(Boolean)) {
      return pass("the answer holds the figures");
    }
    const wanted = routes
      .map((route) => route.map(describeEvidence).join(" and "))
      .filter((line) => line !== "");
    return fail(`the answer does not hold the figures (wanted ${wanted.join(" or ")})`);
  };
}

/** Passes when the answer holds, for each group, one of its words. */
export function answerSaysOneOfEach(groups: readonly (readonly string[])[]): Grader {
  return (context) => {
    const answer = answerOf(context).replaceAll("&", "and");
    const missing = groups.find((words) => !words.some((word) => hasWord(answer, word)));
    return Promise.resolve(
      missing === undefined
        ? pass("the answer says what it should")
        : fail(`the answer does not say ${missing.map((word) => `"${word}"`).join(" or ")}`),
    );
  };
}

// What an exercise may be called in a reply: its name, the part before a dash or a bracket, and the name without
// the kind of equipment, so "Barbell Curl" is also "curl". Hyphens and runs of spaces count as one space.
const EQUIPMENT_WORDS = new Set([
  "barbell",
  "dumbbell",
  "kettlebell",
  "cable",
  "machine",
  "smith",
  "ez",
  "ez-bar",
  "bar",
  "band",
  "lever",
  "seated",
  "standing",
  "full",
  "medium",
  "grip",
]);
const plain = (text: string): string =>
  text
    .toLowerCase()
    .replaceAll(/[-\u2013]/g, " ")
    .replaceAll(/\s+/g, " ")
    .trim();
const SHORTEST_SPELLING = 4;

function spellingsOf(name: string): string[] {
  const lower = name.toLowerCase();
  const withoutEquipment = plain(lower)
    .split(" ")
    .filter((word) => !EQUIPMENT_WORDS.has(word))
    .join(" ");
  return [
    plain(lower),
    plain(lower.split(" - ")[0] ?? lower),
    plain(lower.split("(")[0] ?? lower),
    withoutEquipment,
  ].filter((spelling) => spelling.length >= SHORTEST_SPELLING);
}

/** Passes when the answer names at least `atLeast` of these exercises, each by any of its spellings. */
export function answerNamesMostOf(names: readonly string[], atLeast: number): Grader {
  return (context) => {
    const answer = plain(answerOf(context).replaceAll("\u2019", "'"));
    const named = names.filter((name) =>
      spellingsOf(name).some((spelling) => answer.includes(spelling)),
    );
    return Promise.resolve(
      named.length >= atLeast
        ? pass("the answer names the exercises")
        : fail(
            `the answer names ${named.length} of the ${names.length} exercises and ${atLeast} were wanted (${names.join(", ")})`,
          ),
    );
  };
}

const MONTH =
  "(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sept?(?:ember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)";
// Dates and clock times are removed before figures are read, so the day of a date is not taken for a count.
const DATES_AND_TIMES = new RegExp(
  `\\d{4}-\\d{2}-\\d{2}|\\b\\d{1,2}:\\d{2}\\b|\\b\\d{1,2}(?:st|nd|rd|th)?\\s+(?:of\\s+)?${MONTH}\\b|\\b${MONTH}\\.?\\s+\\d{1,2}(?:st|nd|rd|th)?\\b|\\b\\d+(?:st|nd|rd|th)\\b|\\b(?:19|20)\\d{2}\\b`,
  "gi",
);

const WEIGHT_UNIT = "(?:kg|kgs|kilos?|kilograms?|lb|lbs|pounds?)";
// A unit that makes a number something other than a load, which a bare number is checked against.
const OTHER_UNIT =
  "(?:sets?|reps?|minutes?|mins?|min|seconds?|secs?|hours?|hrs?|weeks?|days?|%|percent|x|times|exercises?|workouts?|sessions?|muscles?|a week|per week|kcal|calories?|cals?|g|grams?|mg|ml)";
const LOAD_WITH_UNIT = new RegExp(`(\\d[\\d,]*(?:\\.\\d+)?)\\s*${WEIGHT_UNIT}\\b`, "gi");
const SETS = /(\d+(?:\.\d+)?)\s*(?:working |warm-up |warm up |hard |total |extra )?sets?\b/gi;
const SET_RANGE = /(\d+)\s*(?:-|–|to)\s*(\d+)\s*(?:working )?sets?\b/gi;
// Two numbers joined by a dash or "to" and not followed by a unit of anything else are a rep range, with or
// without the word "reps": "8 to 10", "sets of 8-10", "3 x 8-12".
const REP_RANGE = new RegExp(
  `(\\d+)\\s*(?:-|\\u2013|to)\\s*(\\d+)(?!\\d|\\.\\d)(?!\\s*(?:${WEIGHT_UNIT}|(?!reps?\\b)${OTHER_UNIT}))`,
  "gi",
);
// A number the answer states with no unit at all, at a size a load would be.
const BARE_NUMBER = new RegExp(
  `(?<![\\d.,:\\u2013-])(\\d[\\d,]*(?:\\.\\d+)?)(?![\\d,:]|\\.\\d)(?!\\s*(?:${OTHER_UNIT}|${WEIGHT_UNIT}|-|\\u2013|to\\b|\\/))`,
  "gi",
);
const SMALLEST_BARE_LOAD = 20;
// No lift is heavier than this in either unit, so a larger bare number is a calorie count or the like.
const LARGEST_BARE_LOAD = 600;
// A bare number is a load only when it is next to words about lifting: a verb that gives one just before it
// ("try 80", "go for 85", "add 5", "at 75"), or an exercise within a few words ("80 on bench"). Food figures, a
// heat percent or a count of workouts stand beside none of them.
const LOAD_CUE_BEFORE =
  /\b(?:try|trying|go for|going for|aim for|aiming for|aim|add|adding|use|using|lift|lifting|load|weight|heavier|up to|increase to|bump to|jump to|move to|at)\s+(?:about |around |roughly |maybe |just )?$/i;
const EXERCISE_WORDS =
  /\b(?:bench|squat|squats|press|deadlift|deadlifts|row|rows|curl|curls|pulldown|pushdown|lift|lifts|lifting)\b/i;
const CUE_WINDOW = 30;

const near = (values: readonly number[], value: number, tolerance: number): boolean =>
  values.some((candidate) => Math.abs(candidate - value) <= tolerance + 1e-9);

const LOAD_TOLERANCE = 0.05;
const SET_TOLERANCE = 0.05;

/**
 * Passes when every load, set count and rep range in the answer is one a tool could have given. A load is a
 * number with a unit of weight, or a bare number the size of a load that is none of `expectedNumbers`, a set count
 * a number before "sets", and a rep range two numbers joined by a dash or "to" with or without "reps". Everything
 * allowed was worked out by core from the rows for the tools the case uses, so a figure the model made up, worked
 * out itself or remembered from another exercise fails the case.
 */
export function noInventedLoad(
  allowed: AllowedFigures,
  expectedNumbers: readonly number[] = [],
): Grader {
  return (context) => {
    const answer = answerOf(context).replace(DATES_AND_TIMES, " ");
    const invented: string[] = [];
    // A load is said to the whole unit as well as to the decimal it is shown with: 165.3 lb is also 165.
    const isLoad = (value: number) =>
      near(allowed.loads, value, LOAD_TOLERANCE) ||
      (Number.isInteger(value) && allowed.loads.some((load) => Math.round(load) === value));
    const isSetCount = (value: number) => near([0, ...allowed.setCounts], value, SET_TOLERANCE);
    for (const [, digits] of answer.matchAll(LOAD_WITH_UNIT)) {
      const value = Number((digits ?? "").replaceAll(",", ""));
      if (!isLoad(value)) {
        invented.push(`a load of ${value}`);
      }
    }
    for (const [, digits] of answer.matchAll(SETS)) {
      if (!isSetCount(Number(digits))) {
        invented.push(`${digits ?? ""} sets`);
      }
    }
    for (const [, low, high] of answer.matchAll(SET_RANGE)) {
      if (!isSetCount(Number(low)) || !isSetCount(Number(high))) {
        invented.push(`${low ?? ""} to ${high ?? ""} sets`);
      }
    }
    for (const [, low, high] of answer.matchAll(REP_RANGE)) {
      const isGiven = allowed.repRanges.some(
        ([min, max]) => min === Number(low) && max === Number(high),
      );
      if (!isGiven) {
        invented.push(`a rep range of ${low ?? ""} to ${high ?? ""}`);
      }
    }
    for (const match of answer.matchAll(BARE_NUMBER)) {
      const value = Number((match[1] ?? "").replaceAll(",", ""));
      const before = answer.slice(Math.max(0, match.index - CUE_WINDOW), match.index);
      const after = answer.slice(
        match.index + match[0].length,
        match.index + match[0].length + CUE_WINDOW,
      );
      const isAboutLifting =
        LOAD_CUE_BEFORE.test(before) || EXERCISE_WORDS.test(before) || EXERCISE_WORDS.test(after);
      if (
        isAboutLifting &&
        value >= SMALLEST_BARE_LOAD &&
        value <= LARGEST_BARE_LOAD &&
        !isLoad(value) &&
        !isSetCount(value) &&
        !near(expectedNumbers, value, LOAD_TOLERANCE)
      ) {
        invented.push(`a load of ${value} with no unit`);
      }
    }
    return Promise.resolve(
      invented.length === 0
        ? pass("the answer states no load, set count or rep range that no tool gave")
        : fail(`the answer states ${[...new Set(invented)].join(", ")}, which no tool gave`),
    );
  };
}

/** Passes when the workout in progress is still open and holds `setCount` sets, so nothing was written to it. */
export function workoutUntouched(setCount: number): Grader {
  return async (context) => {
    const open = await context.database.readRows({
      table: "workout_sessions",
      where: { ended_at: null, deleted_at: null },
    });
    const id = open[0]?.["id"];
    if (open.length !== 1 || typeof id !== "string") {
      return fail("the workout in progress is not the one open workout it was");
    }
    const sets = await context.database.countRows({
      table: "workout_sets",
      where: { session_id: id, deleted_at: null },
    });
    return sets === setCount
      ? pass("the workout in progress was not changed")
      : fail(`the workout in progress holds ${sets} sets and not the ${setCount} logged`);
  };
}

// ---------------------------------------------------------------------------------------------------------
// What a failure says
// ---------------------------------------------------------------------------------------------------------

export const toolsLine = (calls: readonly ToolCall[]): string =>
  calls.length === 0
    ? "none"
    : calls
        .map(
          ({ name, input, errorCode, outcome }) =>
            `${name}(${JSON.stringify(input).slice(0, 200)})${errorCode === undefined ? "" : ` [${errorCode}]`}${outcome === undefined ? "" : ` [${outcome}]`}`,
        )
        .join(", ");

/**
 * A failing case says what it was asked and which tools it called, with their arguments and how each ended, and
 * never the answer, which is the person's training. The driver keeps no body of a tool result, so how a call
 * ended is the error code or the outcome it stored.
 */
export function withContext(grade: Grader, question: string): Grader {
  return async (context) => {
    const outcome = await grade(context);
    return outcome.passed
      ? outcome
      : {
          ...outcome,
          reason: `${outcome.reason}; question: "${question}"; tools: ${toolsLine(callsOf(context))}`,
        };
  };
}
