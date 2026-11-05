// The describe-to-log set (KEY-700): 20 messages in which a person says what they ate. 16 resolve to
// `log_entry` calls, and 4 are too vague to log and end in one question. Each is graded by what the
// database holds and by the arguments of the calls, and never by the wording of the reply, so any good route
// to a right answer passes.
//
// A food is named by its CoFID code and checked against the database (`entryGraders.ts`), because a seeded
// food's id is made when the seed runs. Several foods are right for one word ("two eggs"), so each item lists
// every one of them (`FOOD_ROUTES`). A food that has a portion is logged as a count of that portion, and one
// that has none is logged in the grams the message gave: a case never expects a guessed weight. No case rests
// on a meaning-based search (KEY-185, Amendment 2 H): every word is one the plain `search_foods` finds.
import { READ_TOOLS, onlyReadTools } from "./ask.ts";
import {
  actionRows,
  askedForGrams,
  askedOnce,
  loggedItems,
  onlyTheseTools,
  turnEnded,
  undoWrites,
  withContext,
} from "./entryGraders.ts";
import { FOOD_ROUTES } from "../fixtures/describeExtras.ts";
import { diaryDateOf } from "../fixtures/diary.ts";
import { clarifyingQuestion, noActionRows } from "../src/case.ts";

import type { ExpectedItem } from "./entryGraders.ts";
import type { EvalCase, Grader } from "../src/case.ts";

/** A message that resolves to entries: every item has its own `log_entry` call. */
type LogSpec = Readonly<{
  id: string;
  kind: "log";
  message: string;
  items: readonly [ExpectedItem, ...ExpectedItem[]];
}>;

/** A message too vague to log: one question, nothing written. `asksForGrams` when no portion fits the food. */
type ClarifySpec = Readonly<{
  id: string;
  kind: "clarify";
  message: string;
  asksForGrams: boolean;
}>;

export type DescribeSpec = LogSpec | ClarifySpec;

const WRITE_AND_READ_TOOLS: ReadonlySet<string> = new Set([...READ_TOOLS, "log_entry"]);

/** Every case of the set, as plain data. `anchorDate` is today in a run. */
export function describeSpecs(anchorDate: string): readonly DescribeSpec[] {
  const yesterday = diaryDateOf(anchorDate, 41);
  const log = (id: string, message: string, items: LogSpec["items"]): LogSpec => ({
    id,
    kind: "log",
    message,
    items,
  });
  const clarify = (id: string, message: string, asksForGrams = false): ClarifySpec => ({
    id,
    kind: "clarify",
    message,
    asksForGrams,
  });

  return [
    // Natural amounts: the food's own portions.
    log("describe-two-eggs", "I had two eggs.", [{ codes: FOOD_ROUTES.egg, amount: { count: 2 } }]),
    log("describe-a-banana", "I ate a banana.", [
      { codes: FOOD_ROUTES.banana, amount: { count: 1 } },
    ]),
    log(
      "describe-eggs-toast-and-banana",
      "I had two eggs, a slice of toast and a banana for breakfast.",
      [
        { codes: FOOD_ROUTES.egg, amount: { count: 2 } },
        { codes: FOOD_ROUTES.toast, amount: { count: 1 } },
        { codes: FOOD_ROUTES.banana, amount: { count: 1 } },
      ],
    ),
    log("describe-an-apple-at-three", "I had an apple at 3pm.", [
      { codes: FOOD_ROUTES.apple, amount: { count: 1 }, time: "15:00" },
    ]),
    log("describe-two-slices-of-toast", "I had two slices of wholemeal toast.", [
      { codes: FOOD_ROUTES.wholemealToast, amount: { count: 2 } },
    ]),
    log("describe-a-croissant", "I ate a croissant.", [
      { codes: FOOD_ROUTES.croissant, amount: { count: 1 } },
    ]),
    log("describe-a-medium-bagel", "I had a medium bagel.", [
      { codes: FOOD_ROUTES.bagel, amount: { count: 1 } },
    ]),
    log("describe-an-orange-and-a-kiwi", "I ate an orange and a kiwi.", [
      { codes: FOOD_ROUTES.orange, amount: { count: 1 } },
      { codes: FOOD_ROUTES.kiwi, amount: { count: 1 } },
    ]),
    log("describe-a-boiled-potato", "I had a boiled potato.", [
      { codes: FOOD_ROUTES.boiledPotato, amount: { count: 1 } },
    ]),
    log("describe-three-slices-of-cheddar", "I had three slices of cheddar.", [
      { codes: FOOD_ROUTES.cheddar, amount: { count: 3 } },
    ]),

    // Plain grams, where the message gave them (and the food has no portion, or the person chose grams).
    log("describe-chicken-in-grams", "I ate 150 g of grilled chicken breast.", [
      { codes: FOOD_ROUTES.chickenBreast, amount: { grams: 150 } },
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
    log("describe-yesterday-at-eight", "Yesterday at 8am I had two boiled eggs.", [
      { codes: FOOD_ROUTES.boiledEgg, amount: { count: 2 }, time: "08:00", date: yesterday },
    ]),
    log(
      "describe-lunch-at-half-past-twelve",
      "At 12:30 I ate an apple and 150 g of grilled chicken breast.",
      [
        { codes: FOOD_ROUTES.apple, amount: { count: 1 }, time: "12:30" },
        { codes: FOOD_ROUTES.chickenBreast, amount: { grams: 150 }, time: "12:30" },
      ],
    ),

    // Too vague to log: one question, nothing written.
    clarify("describe-some-chicken-and-rice", "I had some chicken and rice."),
    clarify("describe-some-rice", "I had some rice.", true),
    clarify("describe-a-bowl-of-pasta", "I had a bowl of pasta.", true),
    clarify("describe-some-cheese", "I had some cheese."),
  ];
}

function gradersOf(spec: DescribeSpec, anchorDate: string): Grader[] {
  const graders: Grader[] =
    spec.kind === "log"
      ? [
          loggedItems(spec.items, anchorDate),
          actionRows("log_entry", spec.items.length),
          turnEnded(0, "complete"),
          onlyTheseTools(WRITE_AND_READ_TOOLS),
        ]
      : [
          clarifyingQuestion(),
          askedOnce(),
          noActionRows(),
          onlyReadTools(),
          ...(spec.asksForGrams ? [askedForGrams()] : []),
        ];
  return graders.map((grade) => withContext(grade, [spec.message]));
}

/** The cases of the set for a run whose today is `anchorDate`. */
export function describeCasesOf(anchorDate: string): readonly EvalCase[] {
  return describeSpecs(anchorDate).map((spec) => ({
    id: spec.id,
    set: "describe",
    messages: [spec.message],
    expect: gradersOf(spec, anchorDate),
    // The entries are logged for today, which the ask set reads, so they are taken out again.
    ...(spec.kind === "log" ? { cleanUp: undoWrites } : {}),
  }));
}

/** The set for a run now: the eval user's today is the UTC date, as the ask set takes it. */
export const describeCases: readonly EvalCase[] = describeCasesOf(
  new Date().toISOString().slice(0, 10),
);
