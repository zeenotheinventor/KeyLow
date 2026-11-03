import type { AssistantCard } from "@keylow/core";

// One card for each card board of the approved mobile canvas, with the board's words and invented numbers.
export const FIRST_ACTION_ID = "00000000-0000-4000-8000-0000000000d1";
export const SECOND_ACTION_ID = "00000000-0000-4000-8000-0000000000d2";
const RECIPE_ID = "00000000-0000-4000-8000-0000000000e1";
export const FOOD_ID = "00000000-0000-4000-8000-0000000000f1";

const entryRow = (name: string, amountText: string, time: string, kcalText: string) => ({
  name,
  amountText,
  time,
  kcalText,
  match: null,
  matchedFood: null,
  estimate: false,
});

const importRow = (name: string, matchedFood: string) => ({
  name,
  amountText: null,
  time: null,
  kcalText: null,
  match: "matched" as const,
  matchedFood,
  estimate: false,
});

/** `assistant-card · logged`. */
export const loggedCard: AssistantCard = {
  actionIds: [FIRST_ACTION_ID, SECOND_ACTION_ID],
  kind: "logged",
  title: "Logged 2 eggs and toast at 08:10",
  sub: null,
  rows: [
    entryRow("Egg, boiled", "2 large eggs (100 g)", "08:10", "144 kcal"),
    entryRow("Toast, white bread", "1 slice (30 g)", "08:10", "88 kcal"),
  ],
  totalText: "232 kcal · P 15 g · C 17 g · F 10 g",
  note: null,
  link: null,
  undo: "available",
  undoneSub: "Removed 2 eggs and toast from 08:10",
};

/** `assistant · clarify`, right: the card after the question, each amount as the food's own portion or plain grams, no Estimate. */
export const clarifyLoggedCard: AssistantCard = {
  actionIds: [FIRST_ACTION_ID, SECOND_ACTION_ID],
  kind: "logged",
  title: "Logged chicken and rice at 13:00",
  sub: null,
  rows: [
    entryRow("Chicken breast, grilled", "1 chicken breast (130 g)", "13:00", "192 kcal"),
    entryRow("White rice, boiled", "200 g", "13:00", "276 kcal"),
  ],
  totalText: "468 kcal · P 47 g · C 62 g · F 3.5 g",
  note: "If it was more or less, change it in the diary.",
  link: null,
  undo: "available",
  undoneSub: "Removed chicken and rice from 13:00",
};

/** `assistant-card · undone`. */
export const undoneCard: AssistantCard = { ...loggedCard, undo: "undone" };

/** `assistant-card · undo-unavailable`. */
export const undoUnavailableCard: AssistantCard = {
  ...loggedCard,
  note: "You changed these entries in your diary since, so Undo is off. Edit or delete them in the diary.",
  undo: "unavailable",
};

/** `assistant-card · day-copied`. */
export const dayCopiedCard: AssistantCard = {
  actionIds: [FIRST_ACTION_ID],
  kind: "day_copied",
  title: "Copied 8 entries from yesterday",
  sub: "Saturday 24 October to today · 1,940 kcal",
  rows: [],
  totalText: null,
  note: null,
  link: null,
  undo: "available",
  undoneSub: "Removed 8 copied entries from today",
};

/** `assistant-card · recipe-created`. */
export const recipeCreatedCard: AssistantCard = {
  actionIds: [FIRST_ACTION_ID],
  kind: "recipe_created",
  title: "Added recipe Chicken and rice, 4 servings",
  sub: "Per serving 550 kcal · P 37 g · C 79 g · F 8.6 g",
  rows: [],
  totalText: null,
  note: null,
  link: {
    label: "Open in recipe editor",
    target: { screen: "recipe_editor", recipeId: RECIPE_ID },
  },
  undo: "available",
  undoneSub: "Removed recipe Chicken and rice",
};

/** `assistant-card · food-created`. */
export const foodCreatedCard: AssistantCard = {
  actionIds: [FIRST_ACTION_ID],
  kind: "food_created",
  title: "Added food My protein bar",
  sub: "Yours · 1 bar",
  rows: [
    {
      name: "Per bar",
      amountText: "P 20 g · C 19 g · F 6 g",
      time: null,
      kcalText: "210 kcal",
      match: null,
      matchedFood: null,
      estimate: false,
    },
  ],
  totalText: null,
  note: "Not logged yet. Say when you had it, or log it from search.",
  link: { label: "Open in your foods", target: { screen: "own_food", foodId: FOOD_ID } },
  undo: "available",
  undoneSub: "Removed food My protein bar",
};

/** `assistant-card · targets-changed`. */
export const targetsChangedCard: AssistantCard = {
  actionIds: [FIRST_ACTION_ID],
  kind: "targets_changed",
  title: "Changed your calorie target to 2,000 kcal",
  sub: "Was 2,140 kcal from your programme",
  rows: [],
  totalText: null,
  note: "Your programme has ended, so Ki-Lo stops adjusting your targets each week. Undo puts back 2,140 kcal and your programme.",
  link: null,
  undo: "available",
  undoneSub: "Put back 2,140 kcal and your programme",
};

/** `assistant · confirm`, after a yes. */
export const deletedCard: AssistantCard = {
  actionIds: [FIRST_ACTION_ID],
  kind: "deleted",
  title: "3 entries deleted",
  sub: "Chicken and rice, Greek yoghurt, apple · 13:00",
  rows: [],
  totalText: null,
  note: null,
  link: null,
  undo: "available",
  undoneSub: "Put back 3 entries at 13:00",
};

/** `assistant · recipe-import`: one vague line whose amount the import guessed. */
export const recipeImportCard: AssistantCard = {
  actionIds: [FIRST_ACTION_ID],
  kind: "recipe_created",
  title: "Added recipe Lemon chicken traybake, 4 servings",
  sub: "From example.com/lemon-traybake",
  rows: [
    importRow("800 g chicken thighs, skinless", "Chicken, thigh, skinless, raw · UK CoFID"),
    {
      ...importRow(
        "A splash of milk",
        "Milk, semi-skimmed · 50 ml (a splash, estimated) · UK CoFID",
      ),
      estimate: true,
    },
  ],
  totalText: "Per serving 570 kcal · P 42 g · C 36 g · F 29 g",
  note: null,
  link: {
    label: "Open in recipe editor",
    target: { screen: "recipe_editor", recipeId: RECIPE_ID },
  },
  undo: "available",
  undoneSub: "Removed recipe Lemon chicken traybake",
};

/** `assistant · recipe-unresolved`: the link opens the editor's add-ingredient search on the line's food word. */
export const recipeUnresolvedCard: AssistantCard = {
  ...recipeImportCard,
  link: {
    label: "Choose a food for the wine",
    target: { screen: "recipe_add_ingredient", recipeId: RECIPE_ID, query: "white wine" },
  },
};

/** A copy of a day that links to the diary on the day it copied to. */
export const dayCopiedWithLinkCard: AssistantCard = {
  ...dayCopiedCard,
  link: { label: "Open the day", target: { screen: "diary_day", localDate: "2026-10-25" } },
};

export const RECIPE_FIXTURE_ID = RECIPE_ID;
