// The describe-to-log set (KEY-700): 22 messages in which a person says what they ate. 16 resolve to
// `log_entry` calls, 5 end in one question, and 1 is the milestone's own sentence
// ("two eggs, toast with butter, a flat white"). Each is graded by what the database holds and by the arguments
// of the calls, and never by the wording of the reply, so any good route to a right answer passes.
//
// A food is named by its CoFID code and checked against the database (`entryGraders.ts`), because a seeded
// food's id is made when the seed runs. Several foods are right for one word ("two eggs"), so each item lists
// every one of them (`FOOD_ROUTES`), and the integration test proves the plain `search_foods` surfaces them.
// A food that has a portion is logged as a count of that portion, and one that has none is logged in the grams
// the message gave: a case never expects a guessed weight. No case rests on a meaning-based search (KEY-185,
// Amendment 2 H).
//
// FAIR ROUTES. A case fails only when the answer is wrong. Where a good assistant can reasonably ask once
// instead of logging, the question passes too, and nothing is written: a food that comes in sizes (a banana, an
// apple, an orange, eggs, a croissant, a boiled potato) may be answered with one question about the size, because the person
// said no size and asking is not a guess. A message that names a meal ("for breakfast") may be logged with no
// time or with a morning time. "Some cheese" may be one question or a logged slice.
import { DIARY_READ_TOOLS, onlyReadTools } from "./ask.ts";
import {
  actionRows,
  anyOfRoutes,
  answerSaysAbout,
  askedAboutFoodOrAmount,
  askedAboutSize,
  askedOnce,
  cardOfKind,
  loggedItems,
  loggedRows,
  loggedSomeOfTheItems,
  noGuessedAmounts,
  onlyFoodsOf,
  onlyTheseTools,
  turnEnded,
  undoWrites,
  withContext,
} from "./entryGraders.ts";
import {
  estimatedRows,
  loggedEstimatedAmounts,
  neverQuick,
  sizedWithEstimatePortions,
} from "./mealEstimateGraders.ts";
import { FOOD_ROUTES } from "../fixtures/describeExtras.ts";
import { diaryDateOf } from "../fixtures/diary.ts";
import { clarifyingQuestion, noActionRows } from "../src/case.ts";

import type { ExpectedItem } from "./entryGraders.ts";
import type { EvalCase, Grader } from "../src/case.ts";

/**
 * A message that resolves to entries: every item has its own `log_entry` call. `mayAskAboutSize` for a food
 * that comes in sizes, where one question about the size is as good an answer.
 */
type LogSpec = Readonly<{
  id: string;
  kind: "log";
  message: string;
  items: readonly [ExpectedItem, ...ExpectedItem[]];
  mayAskAboutSize: boolean;
}>;

/**
 * A message too vague to log: one question, nothing written. `asksAboutFoodOrAmount` when no portion fits the
 * food and the question has to be about it. `mayLog` for a message where a natural portion is as good.
 * `mayLogEstimate` (KEY-966) for a message that names a container, where the amount of the default bowl from
 * `estimate_portions`, logged as an estimate, is as good as the question.
 */
type ClarifySpec = Readonly<{
  id: string;
  kind: "clarify";
  message: string;
  asksAboutFoodOrAmount: boolean;
  mayLog: ExpectedItem | null;
  mayLogEstimate: readonly [string, ...string[]] | null;
}>;

/** The milestone's own sentence, whose butter and flat white have no portion: portions only, or one question. */
type BriefSpec = Readonly<{ id: string; kind: "brief"; message: string }>;

/**
 * A message that says a serving and no amount, for a food whose only portion is the estimate Ki-Lo generates
 * (KEY-933). It is logged in that portion, and the reply says "about" beside it. Asking is not a fair route:
 * the person said a serving, which is the one thing that allows the estimate.
 */
type EstimateSpec = Readonly<{
  id: string;
  kind: "estimate";
  message: string;
  item: ExpectedItem;
}>;

export type DescribeSpec = LogSpec | ClarifySpec | BriefSpec | EstimateSpec;

const WRITE_AND_READ_TOOLS: ReadonlySet<string> = new Set([...DIARY_READ_TOOLS, "log_entry"]);
const ESTIMATE_TOOLS: ReadonlySet<string> = new Set([...WRITE_AND_READ_TOOLS, "estimate_portions"]);

/** Every case of the set, as plain data. `anchorDate` is today in a run. */
export function describeSpecs(anchorDate: string): readonly DescribeSpec[] {
  const yesterday = diaryDateOf(anchorDate, 41);
  const log = (
    id: string,
    message: string,
    items: LogSpec["items"],
    mayAskAboutSize = false,
  ): LogSpec => ({ id, kind: "log", message, items, mayAskAboutSize });
  const clarify = (
    id: string,
    message: string,
    options: {
      asksAboutFoodOrAmount?: boolean;
      mayLog?: ExpectedItem;
      mayLogEstimate?: readonly [string, ...string[]];
    } = {},
  ): ClarifySpec => ({
    id,
    kind: "clarify",
    message,
    asksAboutFoodOrAmount: options.asksAboutFoodOrAmount ?? false,
    mayLog: options.mayLog ?? null,
    mayLogEstimate: options.mayLogEstimate ?? null,
  });

  return [
    // Natural amounts: the food's own portions.
    log(
      "describe-two-eggs",
      "I had two eggs.",
      [{ codes: FOOD_ROUTES.egg, amount: { count: 2 } }],
      true,
    ),
    log(
      "describe-a-banana",
      "I ate a banana.",
      [{ codes: FOOD_ROUTES.banana, amount: { count: 1 } }],
      true,
    ),
    log(
      "describe-eggs-toast-and-banana",
      "I had two eggs, a slice of toast and a banana for breakfast.",
      [
        { codes: FOOD_ROUTES.egg, amount: { count: 2 }, time: "morning" },
        { codes: FOOD_ROUTES.toast, amount: { count: 1 }, time: "morning" },
        { codes: FOOD_ROUTES.banana, amount: { count: 1 }, time: "morning" },
      ],
      true,
    ),
    log(
      "describe-an-apple-at-three",
      "I had an apple at 3pm.",
      [{ codes: FOOD_ROUTES.apple, amount: { count: 1 }, time: "15:00" }],
      true,
    ),
    log("describe-two-slices-of-toast", "I had two slices of wholemeal toast.", [
      { codes: FOOD_ROUTES.wholemealToast, amount: { count: 2 } },
    ]),
    log(
      "describe-a-croissant",
      "I ate a croissant.",
      [{ codes: FOOD_ROUTES.croissant, amount: { count: 1 } }],
      true,
    ),
    log("describe-a-medium-bagel", "I had a medium bagel.", [
      { codes: FOOD_ROUTES.bagel, amount: { count: 1 } },
    ]),
    log(
      "describe-an-orange-and-a-kiwi",
      "I ate an orange and a kiwi.",
      [
        { codes: FOOD_ROUTES.orange, amount: { count: 1 } },
        { codes: FOOD_ROUTES.kiwi, amount: { count: 1 } },
      ],
      true,
    ),
    log(
      "describe-a-boiled-potato",
      "I had a boiled potato.",
      [{ codes: FOOD_ROUTES.boiledPotato, amount: { count: 1 } }],
      true,
    ),
    log("describe-three-slices-of-cheddar", "I had three slices of cheddar.", [
      { codes: FOOD_ROUTES.cheddar, amount: { count: 3 } },
    ]),

    // Plain grams, where the message gave them (and the food has no portion, or the person chose grams).
    // "Without skin" is in the words because the seed has the breast with skin and without, and "which one?"
    // is a fair question for a message that says neither. This case and the rice, broccoli and oats cases log
    // in grams with no question to ask.
    log("describe-chicken-in-grams", "I ate 150 g of grilled chicken breast without skin.", [
      { codes: FOOD_ROUTES.chickenBreastWithoutSkin, amount: { grams: 150 } },
    ]),
    log("describe-rice-in-grams", "I had 200 g of boiled white rice.", [
      { codes: FOOD_ROUTES.whiteRice, amount: { grams: 200 } },
    ]),
    log("describe-broccoli-in-grams", "I had 100 g of boiled broccoli.", [
      { codes: FOOD_ROUTES.boiledBroccoli, amount: { grams: 100 } },
    ]),
    log("describe-oats-in-grams", "I had 30 g of porridge oats.", [
      { codes: FOOD_ROUTES.porridgeOats, amount: { grams: 30 } },
    ]),

    // The day and the time of the message.
    log(
      "describe-yesterday-at-eight",
      "Yesterday at 8am I had two boiled eggs.",
      [{ codes: FOOD_ROUTES.boiledEgg, amount: { count: 2 }, time: "08:00", date: yesterday }],
      true,
    ),
    log(
      "describe-lunch-at-half-past-twelve",
      "At 12:30 I ate an apple and 150 g of grilled chicken breast without skin.",
      [
        { codes: FOOD_ROUTES.apple, amount: { count: 1 }, time: "12:30" },
        { codes: FOOD_ROUTES.chickenBreastWithoutSkin, amount: { grams: 150 }, time: "12:30" },
      ],
      true,
    ),

    // Too vague to log: one question, nothing written.
    clarify("describe-some-chicken-and-rice", "I had some chicken and rice."),
    clarify("describe-some-rice", "I had some rice.", { asksAboutFoodOrAmount: true }),
    // No serving said and no amount: every food now has a portion, and one that is only an estimate must not
    // be logged on the person's behalf. The chicken has the estimate and no portion of its own.
    clarify("describe-some-chicken", "I had some chicken.", { asksAboutFoodOrAmount: true }),
    // A bowl is a container `estimate_portions` knows, so the default bowl of it, logged as an estimate, is as good as asking.
    clarify("describe-a-bowl-of-pasta", "I had a bowl of pasta.", {
      asksAboutFoodOrAmount: true,
      mayLogEstimate: FOOD_ROUTES.boiledPasta,
    }),
    clarify("describe-some-cheese", "I had some cheese.", {
      mayLog: { codes: FOOD_ROUTES.cheeseSlice, amount: { portion: true } },
    }),
    // The amount is clear but the matches differ in calories: the breast with skin, without skin, and meat and
    // skin are three foods in the seed, so "which one?" is the right answer and logging the first is a guess.
    clarify("describe-chicken-breast-skin-unsaid", "I had 150 g of grilled chicken breast."),

    // A serving said, and the food's only portion is Ki-Lo's estimate: it is logged and written with "about".
    {
      id: "describe-a-serving-of-chicken",
      kind: "estimate",
      message: "I had a serving of grilled chicken breast without skin.",
      item: { codes: FOOD_ROUTES.chickenBreastWithoutSkin, amount: { portion: true } },
    },

    // The milestone's own sentence. Butter and a flat white have no portion in the seed, so a weight for
    // either would be a guess: the assistant logs portions of the real foods, or asks once.
    {
      id: "describe-eggs-toast-butter-and-a-flat-white",
      kind: "brief",
      message: "I had two eggs, toast with butter and a flat white.",
    },
  ];
}

const onlyQuestion = (): Grader[] => [
  clarifyingQuestion(),
  askedOnce(),
  noActionRows(),
  onlyReadTools(),
];

const logged = (items: readonly ExpectedItem[], today: string): Grader[] => [
  loggedItems(items, today),
  loggedRows(items, today),
  actionRows("log_entry", items.length),
  cardOfKind(0, "logged"),
  turnEnded(0, "complete"),
  onlyTheseTools(WRITE_AND_READ_TOOLS),
];

// The route where a named container is sized by `estimate_portions` with no size nobody gave (the default bowl), and
// the amount it answered is logged as an estimate.
const loggedAsEstimate = (codes: readonly [string, ...string[]], today: string): Grader[] => {
  const items = [{ codes }];
  return [
    sizedWithEstimatePortions(items, { names: ["bowl"], diameterCm: null }),
    loggedEstimatedAmounts(items, today),
    estimatedRows(items, today),
    neverQuick(),
    actionRows("log_entry", 1),
    cardOfKind(0, "logged"),
    turnEnded(0, "complete"),
    onlyTheseTools(ESTIMATE_TOOLS),
  ];
};

// The route where the assistant logs what is clear and asks about the rest: some of the items logged rightly,
// nothing else, and one question about a food or an amount. Nothing is guessed, so it is as good as logging all.
const loggedThenAsked = (items: readonly ExpectedItem[], today: string): Grader[] => [
  loggedSomeOfTheItems(items, today),
  cardOfKind(0, "logged"),
  clarifyingQuestion(),
  askedOnce(),
  askedAboutFoodOrAmount(),
  onlyTheseTools(WRITE_AND_READ_TOOLS),
];

function gradersOf(spec: DescribeSpec, anchorDate: string): Grader[] {
  const graders: Grader[] = (() => {
    switch (spec.kind) {
      case "log": {
        const routes: Grader[][] = [logged(spec.items, anchorDate)];
        if (spec.mayAskAboutSize) {
          routes.push([...onlyQuestion(), askedAboutSize()]);
        }
        if (spec.items.length > 1) {
          routes.push(loggedThenAsked(spec.items, anchorDate));
        }
        const [only] = routes;
        return routes.length === 1 && only !== undefined ? only : [anyOfRoutes(routes)];
      }
      case "clarify": {
        const asking = [
          ...onlyQuestion(),
          ...(spec.asksAboutFoodOrAmount ? [askedAboutFoodOrAmount()] : []),
        ];
        const routes: Grader[][] = [asking];
        if (spec.mayLog !== null) {
          routes.push(logged([spec.mayLog], anchorDate));
        }
        if (spec.mayLogEstimate !== null) {
          routes.push(loggedAsEstimate(spec.mayLogEstimate, anchorDate));
        }
        return routes.length === 1 ? asking : [anyOfRoutes(routes)];
      }
      case "estimate":
        return [...logged([spec.item], anchorDate), answerSaysAbout()];
      case "brief": {
        // Two eggs and the toast have portions, and the message gave no count for the toast. Butter and a flat
        // white have none, so a weight for either is a guess. A question must be about the food or the amount,
        // and logging must not drop the toast in silence: the toast is logged, or asked about after the eggs.
        const eggs: ExpectedItem = { codes: FOOD_ROUTES.egg, amount: { count: 2 } };
        const toast: ExpectedItem = { codes: FOOD_ROUTES.toast, amount: { portion: true } };
        return [
          anyOfRoutes([
            [...onlyQuestion(), askedAboutFoodOrAmount()],
            [
              loggedItems([eggs, toast], anchorDate),
              loggedRows([eggs, toast], anchorDate),
              noGuessedAmounts(),
              onlyFoodsOf([...FOOD_ROUTES.egg, ...FOOD_ROUTES.toast]),
              onlyTheseTools(WRITE_AND_READ_TOOLS),
            ],
            loggedThenAsked([eggs, toast], anchorDate),
          ]),
        ];
      }
    }
  })();
  return graders.map((grade) => withContext(grade, [spec.message]));
}

/** The cases of the set for a run whose today is `anchorDate`. */
export function describeCasesOf(anchorDate: string): readonly EvalCase[] {
  return describeSpecs(anchorDate).map((spec) => ({
    id: spec.id,
    set: "describe",
    messages: [spec.message],
    expect: gradersOf(spec, anchorDate),
    // The entries are logged for today, which the ask set reads, or for yesterday, which the copy cases count,
    // so they are taken out again. A case that only asks writes nothing, and its Undo is an empty list.
    cleanUp: undoWrites,
  }));
}

/** The set for a run now: the eval user's today is the UTC date, as the ask set takes it. */
export const describeCases: readonly EvalCase[] = describeCasesOf(
  new Date().toISOString().slice(0, 10),
);
