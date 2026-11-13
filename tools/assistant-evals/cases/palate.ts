// The palate set (KEY-1037, M9 plan section 8): what the person usually eats and avoids, read by `get_palate_profile`
// from the eval user's 90 days of diary and its three stated preferences (the kitchen world of KEY-1028), and the "not
// true" correction. Run with `--set palate` and `ASSISTANT_KITCHEN=1` on the served functions. It is opt in, at 90 %.
//
// The profile the tool answered is compared with core's own profile of the fixture (`fixtures/palateProfile.ts`), field
// by field, and what the assistant says is held to what the profile holds: it names the planted habits and the avoid
// list, states no number the profile does not hold, and after a correction it reads the profile again and the corrected
// food is gone. The correction is the harness pressing "not true" between two turns, as the Palate screen does, because
// the assistant has no tool for it. Out of reach for one eval user: an empty-history user and another user's palate,
// which need a second user (the red-team set's user B covers the cross-user read).
import { lastTurnComplete, soft } from "./kitchenGraders.ts";
import {
  answerNamesAll,
  answerNamesAtLeast,
  answerNamesFirst,
  answerNamesNone,
  noInventedNumbers,
  profileMatchesCore,
  profileReadInTurn,
  saysAllergyIsMatchedByName,
  statesTypicalAmounts,
} from "./palateGraders.ts";
import { seededFoods } from "../fixtures/diaryTotals.ts";
import { expectedPalateProfile, palatePreferences } from "../fixtures/palateProfile.ts";
import { noActionRows, rowsExist } from "../src/case.ts";
import { kitchenWorldHolder } from "../src/kitchenWorld.ts";

import type { EvalCase } from "../src/case.ts";
import type { KitchenWorld } from "../src/kitchenWorld.ts";
import type { PalatePreference } from "@keylow/core";

const BREAD = /\bbread\b/i;
const EGGS = /\beggs?\b/i;
const APPLES = /\bapples?\b/i;
const BROCCOLI = /\bbroccoli\b/i;
const POTATOES = /\bpotato(?:es)?\b/i;
const SALMON = /\bsalmon\b/i;

/** The correction the harness presses between the two turns of the correction case: apples are not usual. */
const APPLES_ARE_NOT_USUAL = (): PalatePreference => {
  const apple = seededFoods().get("apple");
  if (apple === undefined) {
    throw new Error("The fixture has no apple");
  }
  return { id: "correction-1", kind: "not_usual", foodId: apple.id, recipeId: null, label: null };
};

export function createPalateCases(world: () => KitchenWorld): EvalCase[] {
  const prepare = () => world().ensureWorld();
  const profile = () => expectedPalateProfile(world().anchorDate);
  const reads = (turnIndex: number) => [profileMatchesCore(turnIndex, profile)];
  return [
    {
      id: "palate-usual-foods",
      set: "palate",
      prepare,
      messages: ["What do I usually eat?"],
      expect: [
        lastTurnComplete(),
        ...reads(0),
        // The four foods the diary logs on most days.
        answerNamesAll(0, [BREAD, EGGS, APPLES, BROCCOLI]),
        noInventedNumbers(0),
        noActionRows(),
      ],
      mustPass: true,
    },
    {
      id: "palate-time-of-day",
      set: "palate",
      prepare,
      messages: ["What do I usually eat in the morning, at midday and in the evening?"],
      expect: [
        lastTurnComplete(),
        ...reads(0),
        answerNamesAtLeast(0, [BREAD, EGGS], 1),
        answerNamesAtLeast(0, [BROCCOLI, POTATOES, SALMON], 1),
        noInventedNumbers(0),
        noActionRows(),
      ],
    },
    {
      id: "palate-rarely-or-never",
      set: "palate",
      prepare,
      messages: ["Look at my palate: what do I hardly ever eat?"],
      expect: [
        lastTurnComplete(),
        ...reads(0),
        // The groups the diary never logs: legumes and nuts, sweets and snacks, drinks.
        answerNamesAtLeast(
          0,
          [/\b(?:legumes?|nuts?)\b/i, /\b(?:sweets?|snacks?)\b/i, /\bdrinks?\b/i],
          2,
        ),
        noInventedNumbers(0),
        noActionRows(),
      ],
    },
    {
      id: "palate-avoid-list",
      set: "palate",
      prepare,
      messages: ["What foods do I avoid?"],
      expect: [
        lastTurnComplete(),
        ...reads(0),
        // The allergy and the two dislikes the world states.
        answerNamesAll(0, [/\bpeanuts?\b/i, /\bmushrooms?\b/i, /\bcoriander\b/i]),
        soft(saysAllergyIsMatchedByName(0)),
        noActionRows(),
      ],
      mustPass: true,
    },
    {
      id: "palate-no-invented-numbers",
      set: "palate",
      prepare,
      messages: ["What do I usually eat, and how many times a week do I have each of those foods?"],
      expect: [lastTurnComplete(), ...reads(0), noInventedNumbers(0), noActionRows()],
    },
    {
      id: "palate-breakfast-leads",
      set: "palate",
      prepare,
      messages: ["What do I usually eat for breakfast?"],
      // Bread leads the morning of the fixture, ahead of eggs.
      expect: [
        lastTurnComplete(),
        ...reads(0),
        answerNamesFirst(0, BREAD, EGGS),
        noInventedNumbers(0),
        noActionRows(),
      ],
    },
    {
      id: "palate-portion-habit",
      set: "palate",
      prepare,
      messages: ["What do I usually eat, and how much of each food do I usually have?"],
      // The typical amounts in grams are the profile's own, and no other number is stated.
      expect: [
        lastTurnComplete(),
        ...reads(0),
        statesTypicalAmounts(0, profile, 3),
        noInventedNumbers(0),
        noActionRows(),
      ],
    },
    {
      id: "palate-never-logged-food-is-rare",
      set: "palate",
      prepare,
      messages: ["Looking at my palate, do I ever eat lentils or nuts?"],
      // Legumes and nuts are a group the diary never logs, so the answer says they are rare and never says they are usual.
      expect: [
        lastTurnComplete(),
        ...reads(0),
        answerNamesAll(0, [/\b(?:rarely|never|hardly|not often|don'?t|do not|haven'?t)\b/i]),
        answerNamesNone(0, [/\bmost (?:days|weeks)\b/i]),
        noInventedNumbers(0),
        noActionRows(),
      ],
    },
    {
      id: "palate-window-is-90-days",
      set: "palate",
      prepare,
      messages: ["What do I usually eat, and how far back does that look?"],
      // The profile reads the last 90 days, which the tool says.
      expect: [
        lastTurnComplete(),
        ...reads(0),
        answerNamesAll(0, [/\b(?:90|ninety)\b|\bthree months\b/i]),
        noInventedNumbers(0),
        noActionRows(),
      ],
    },
    {
      id: "palate-correction-changes-the-next-profile",
      set: "palate",
      prepare,
      messages: ["What do I usually eat?", "I corrected my palate. What do I usually eat now?"],
      // Between the turns the harness presses "not true" on apples, as the Palate screen does.
      afterTurn: async ({ index }) => {
        if (index === 0) {
          await world().markNotUsual("apple");
        }
      },
      cleanUp: () => world().clearCorrections(),
      expect: [
        lastTurnComplete(),
        profileMatchesCore(0, profile),
        answerNamesAll(0, [APPLES]),
        rowsExist({ table: "palate_preferences", where: { kind: "not_usual" } }),
        profileReadInTurn(1),
        profileMatchesCore(1, () =>
          expectedPalateProfile(world().anchorDate, [
            ...palatePreferences(),
            APPLES_ARE_NOT_USUAL(),
          ]),
        ),
        answerNamesNone(1, [APPLES]),
        noActionRows(),
      ],
      mustPass: true,
    },
  ];
}

export const palateCases: readonly EvalCase[] = createPalateCases(() =>
  kitchenWorldHolder.current(),
);
