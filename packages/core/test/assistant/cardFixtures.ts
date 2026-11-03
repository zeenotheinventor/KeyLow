import type { AssistantCard, AssistantCardRow } from "../../src/assistant";

// One card per card board, with the board's words. `boardStrings` lists every string the board shows
// for that card, so a test can check the parsed card carries all of them.
const firstActionId = "00000000-0000-4000-8000-0000000000d1";
const actionIds = [firstActionId, "00000000-0000-4000-8000-0000000000d2"];
const recipeId = "00000000-0000-4000-8000-0000000000e1";

const recipeRow = (name: string, matchedFood: string): AssistantCardRow => ({
  name,
  amountText: null,
  time: null,
  kcalText: null,
  match: "matched",
  matchedFood,
  estimate: false,
});

const recipeMatchedRows = [
  recipeRow("800 g chicken thighs, skinless", "Chicken, thigh, skinless, raw · UK CoFID"),
  recipeRow("750 g new potatoes", "Potatoes, new, raw · UK CoFID"),
  recipeRow("2 tbsp olive oil", "Olive oil · UK CoFID"),
  recipeRow("1 lemon", "Lemon, whole · UK CoFID"),
  recipeRow("4 garlic cloves", "Garlic, raw · UK CoFID"),
];

/** `assistant-card · logged`: the 2 eggs and toast at 08:10. */
export const loggedCard: AssistantCard = {
  actionIds,
  kind: "logged",
  title: "Logged 2 eggs and toast at 08:10",
  sub: null,
  rows: [
    {
      name: "Egg, boiled",
      amountText: "2 large eggs (100 g)",
      time: "08:10",
      kcalText: "144 kcal",
      match: null,
      matchedFood: null,
      estimate: false,
    },
    {
      name: "Toast, white bread",
      amountText: "1 slice (30 g)",
      time: "08:10",
      kcalText: "88 kcal",
      match: null,
      matchedFood: null,
      estimate: false,
    },
  ],
  totalText: "232 kcal · P 15 g · C 17 g · F 10 g",
  note: null,
  link: null,
  undo: "available",
  undoneSub: "Removed 2 eggs and toast from 08:10",
};

/** `assistant · clarify`, right: logged after the reply "1 chicken breast, 200 g rice". */
export const clarifyLoggedCard: AssistantCard = {
  actionIds,
  kind: "logged",
  title: "Logged chicken and rice at 13:00",
  sub: null,
  rows: [
    {
      name: "Chicken breast, grilled",
      amountText: "1 chicken breast (130 g)",
      time: "13:00",
      kcalText: "192 kcal",
      match: null,
      matchedFood: null,
      estimate: false,
    },
    {
      name: "White rice, boiled",
      amountText: "200 g",
      time: "13:00",
      kcalText: "276 kcal",
      match: null,
      matchedFood: null,
      estimate: false,
    },
  ],
  totalText: "468 kcal · P 47 g · C 62 g · F 3.5 g",
  note: "If it was more or less, change it in the diary.",
  link: null,
  undo: "available",
  undoneSub: "Removed chicken and rice from 13:00",
};

/** `assistant · recipe-import`: one vague line whose amount the import guessed, marked Estimate. */
export const recipeImportCard: AssistantCard = {
  actionIds: [firstActionId],
  kind: "recipe_created",
  title: "Added recipe Lemon chicken traybake, 4 servings",
  sub: "From example.com/lemon-traybake",
  rows: [
    ...recipeMatchedRows,
    {
      ...recipeRow(
        "A splash of milk",
        "Milk, semi-skimmed · 50 ml (a splash, estimated) · UK CoFID",
      ),
      estimate: true,
    },
  ],
  totalText: "Per serving 570 kcal · P 42 g · C 36 g · F 29 g",
  note: null,
  link: { label: "Open in recipe editor", target: { screen: "recipe_editor", recipeId } },
  undo: "available",
  undoneSub: "Removed recipe Lemon chicken traybake",
};

/** `assistant · recipe-unresolved`: one line that matched no food, left out of the numbers. */
export const recipeUnresolvedCard: AssistantCard = {
  ...recipeImportCard,
  rows: [
    ...recipeMatchedRows,
    {
      name: "A splash of white wine",
      amountText: null,
      time: null,
      kcalText: null,
      match: "unresolved",
      matchedFood: "Not counted. Choose a food in the recipe editor.",
      estimate: false,
    },
  ],
  totalText: "Per serving 564 kcal · P 42 g · C 35 g · F 29 g",
  link: {
    label: "Choose a food for the wine",
    target: { screen: "recipe_add_ingredient", recipeId, query: "white wine" },
  },
};

/**
 * `assistant-card · undone`: the logged card after an Undo. The board's title "Undone" is
 * `ASSISTANT_CARD_WORDS.undoneTitle` and the screen draws `undoneSub` under it, so the card keeps its
 * own title and only `undo` changes.
 */
export const undoneCard: AssistantCard = { ...loggedCard, undo: "undone" };

/** `assistant-card · undo-unavailable`: the logged card whose entries were changed in the diary since. */
export const undoUnavailableCard: AssistantCard = {
  ...loggedCard,
  note: "You changed these entries in your diary since, so Undo is off. Edit or delete them in the diary.",
  undo: "unavailable",
};

/**
 * `assistant-card · day-copied`: a copy of a whole day has no rows, the day and its total are the sub.
 * The board never prints `undoneSub`, because it shows only after an Undo, so the line here is the ticket's.
 */
export const dayCopiedCard: AssistantCard = {
  actionIds: [firstActionId],
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

export const cardBoards = [
  {
    board: "assistant-card · logged",
    card: loggedCard,
    boardStrings: [
      "Logged 2 eggs and toast at 08:10",
      "Egg, boiled",
      "2 large eggs (100 g)",
      "08:10",
      "144 kcal",
      "Toast, white bread",
      "1 slice (30 g)",
      "88 kcal",
      "232 kcal · P 15 g · C 17 g · F 10 g",
    ],
  },
  {
    board: "assistant · clarify (logged after the reply)",
    card: clarifyLoggedCard,
    boardStrings: [
      "Logged chicken and rice at 13:00",
      "Chicken breast, grilled",
      "1 chicken breast (130 g)",
      "13:00",
      "192 kcal",
      "White rice, boiled",
      "200 g",
      "276 kcal",
      "468 kcal · P 47 g · C 62 g · F 3.5 g",
      "If it was more or less, change it in the diary.",
    ],
  },
  {
    board: "assistant · recipe-import",
    card: recipeImportCard,
    boardStrings: [
      "Added recipe Lemon chicken traybake, 4 servings",
      "From example.com/lemon-traybake",
      "800 g chicken thighs, skinless",
      "Chicken, thigh, skinless, raw · UK CoFID",
      "750 g new potatoes",
      "Potatoes, new, raw · UK CoFID",
      "2 tbsp olive oil",
      "Olive oil · UK CoFID",
      "1 lemon",
      "Lemon, whole · UK CoFID",
      "4 garlic cloves",
      "Garlic, raw · UK CoFID",
      "A splash of milk",
      "Milk, semi-skimmed · 50 ml (a splash, estimated) · UK CoFID",
      "Per serving 570 kcal · P 42 g · C 36 g · F 29 g",
      "Open in recipe editor",
    ],
  },
  {
    board: "assistant · recipe-unresolved",
    card: recipeUnresolvedCard,
    boardStrings: [
      "Added recipe Lemon chicken traybake, 4 servings",
      "From example.com/lemon-traybake",
      "800 g chicken thighs, skinless",
      "Chicken, thigh, skinless, raw · UK CoFID",
      "4 garlic cloves",
      "Garlic, raw · UK CoFID",
      "A splash of white wine",
      "Not counted. Choose a food in the recipe editor.",
      "Per serving 564 kcal · P 42 g · C 35 g · F 29 g",
      "Choose a food for the wine",
    ],
  },
  {
    board: "assistant-card · undone",
    card: undoneCard,
    boardStrings: ["Removed 2 eggs and toast from 08:10"],
  },
  {
    board: "assistant-card · undo-unavailable",
    card: undoUnavailableCard,
    boardStrings: [
      "Logged 2 eggs and toast at 08:10",
      "Egg, boiled",
      "2 large eggs (100 g)",
      "08:10",
      "144 kcal",
      "Toast, white bread",
      "1 slice (30 g)",
      "88 kcal",
      "232 kcal · P 15 g · C 17 g · F 10 g",
      "You changed these entries in your diary since, so Undo is off. Edit or delete them in the diary.",
    ],
  },
  {
    board: "assistant-card · day-copied",
    card: dayCopiedCard,
    boardStrings: ["Copied 8 entries from yesterday", "Saturday 24 October to today · 1,940 kcal"],
  },
];
