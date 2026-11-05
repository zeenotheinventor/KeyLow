// The write set (KEY-700): 29 cases for the assistant's writes. 20 check one tool each (update_entry,
// delete_entry, copy_day, set_day_complete, create_recipe, archive_recipe, create_custom_food and
// update_targets, with the four that ask first answered both ways), 7 press Undo, 1 sends the same message twice
// and 1 logs yesterday's lunch again.
//
// A write is graded by the database and by the arguments, and never by the wording of the reply: the call, the
// `assistant_actions` rows the turn left, and the rows the write changed.
//
// ISOLATION. The eval user's rows are shared with the other sets, and a write changes them. What keeps a case
// from changing what another case or the ask set reads:
//   1. A case that needs an entry makes it itself, in an earlier turn, on a scratch day of its own
//      (`scratchDayOf`). Those days are in the past, before the diary's first day and before every day an ask
//      question names, and a fair model that is asked about them can query them. It never edits or deletes a
//      diary entry.
//   2. A recipe or a food a case archives or removes is one the case made, under a name of its own.
//   3. A case that logs for today (the same-message case, yesterday's lunch) or for a diary day (the describe
//      case "yesterday at 8am") presses Undo for its turns afterwards (`cleanUp`). The ask set reads today and
//      expects it empty, and the copy cases and the lunch case count yesterday's entries.
//   4. A case that changes the targets puts the run's targets back afterwards (`cleanUp`), because Undo cannot
//      for the eval user: it has no programme, so the old numbers are kept nowhere.
// WHAT DEPENDS ON WHAT. The cases may run in any order as long as every `cleanUp` succeeds. A `cleanUp` that
// fails ends its case as an error and throws, so the failure is seen, but the rows it could not remove stay: a
// describe case left on yesterday would make the copy cases and the lunch case count the wrong entries, an
// entry left on today would fail two ask questions, and targets left changed would fail the ask questions
// about what is left and the days at target. A cleanUp error is therefore the first thing to read in a run.
import {
  confirmArchiveButtons,
  confirmCopyButtons,
  confirmDeleteButtons,
  confirmTargetsButtons,
  describeMacrosAdjustedNote,
  scaleMacroTargets,
} from "@keylow/core";

import { READ_TOOLS } from "./ask.ts";
import {
  actionRows,
  anyOfRoutes,
  askedOnce,
  calledWith,
  cardOfKind,
  confirmationEndsWith,
  confirmationLacks,
  inputsOf,
  isRecord,
  loggedItems,
  loggedRows,
  noActionRowsInTurn,
  oneRowPerToolPerMessage,
  noQuestionsAsked,
  onlyTheseTools,
  readBeforeFirstLog,
  rowCount,
  turnEnded,
  undoOnTurn,
  undoWrites,
  withContext,
} from "./entryGraders.ts";
import { ASK_TARGETS } from "../fixtures/askExtras.ts";
import { FOOD_ROUTES, lunchOfDay } from "../fixtures/describeExtras.ts";
import { diaryDateOf } from "../fixtures/diary.ts";
import { dayEntries } from "../fixtures/diaryTotals.ts";
import { noActionRows } from "../src/case.ts";

import type { ExpectedItem } from "./entryGraders.ts";
import type { EvalCase, Grader } from "../src/case.ts";
import type { EvalDatabase } from "../src/types.ts";
import type { AssistantCardKind } from "@keylow/core";

const ALL_TOOLS: ReadonlySet<string> = new Set([
  ...READ_TOOLS,
  "log_entry",
  "update_entry",
  "delete_entry",
  "copy_day",
  "set_day_complete",
  "create_recipe",
  "archive_recipe",
  "create_custom_food",
  "update_targets",
]);

// A scratch day is before the diary's first day (42 days back) and before the oldest day an ask question names
// (the ask set goes back 72 days, to "30 days before the diary"), at 80 to 94 days back. The recipe-import set
// plants 200 or more days back, so the two do not meet.
const FIRST_SCRATCH_DAY_BACK = 80;

/** The `k`th scratch day (1, 2, ...) of a run whose today is `anchorDate`: 79 + k days before today. */
export const scratchDayOf = (anchorDate: string, k: number): string =>
  diaryDateOf(anchorDate, DIARY_LENGTH - (FIRST_SCRATCH_DAY_BACK - 1 + k));

const DIARY_LENGTH = 42;

const sayDay = (date: string): string =>
  new Date(`${date}T00:00:00Z`).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });

const entriesOn = (localDate: string, expected: number): Grader =>
  rowCount(
    { table: "food_log_entries", where: { local_date: localDate, deleted_at: null } },
    expected,
  );

const recipeIs = (name: string, isArchived: boolean, expected: number): Grader =>
  rowCount({ table: "recipes", where: { name, is_archived: isArchived } }, expected);

/** Passes when a gram ingredient line is one of the food route's foods, as the database holds it. */
async function isGramLine(
  line: unknown,
  [codes, grams]: readonly [readonly string[], number],
  database: EvalDatabase,
): Promise<boolean> {
  if (!isRecord(line) || line["unit"] !== "g" || line["amount"] !== grams) {
    return false;
  }
  const foodId = line["food_id"];
  if (typeof foodId !== "string") {
    return false;
  }
  const counts = await Promise.all(
    codes.map((code) =>
      database.countRows({
        table: "foods",
        where: { id: foodId, source: "cofid", source_ref: code },
      }),
    ),
  );
  return counts.some((count) => count > 0);
}

/** Passes when the recipe call has the name, the servings and one gram ingredient for each food route. */
function recipeCreated(
  name: string,
  servings: number,
  ingredients: readonly (readonly [readonly string[], number])[],
): Grader {
  return async ({ turns, database }) => {
    for (const input of inputsOf(turns, "create_recipe")) {
      const lines = isRecord(input) ? input["ingredients"] : undefined;
      if (
        !isRecord(input) ||
        input["name"] !== name ||
        input["servings"] !== servings ||
        !Array.isArray(lines) ||
        lines.length !== ingredients.length
      ) {
        continue;
      }
      const lineList: readonly unknown[] = lines;
      const found = await Promise.all(
        ingredients.map(async (ingredient) => {
          const matches = await Promise.all(
            lineList.map((line) => isGramLine(line, ingredient, database)),
          );
          return matches.some(Boolean);
        }),
      );
      if (found.every(Boolean)) {
        return { passed: true, reason: "create_recipe was called with the recipe" };
      }
    }
    return {
      passed: false,
      reason: `create_recipe was not called with ${name} and its ingredients`,
    };
  };
}

// The card the app draws for each write, by case: the turn (counted from 0) and the kind. A card is the app's
// own proof that the write is the one the person asked for, so a right-looking write with the wrong card fails.
const CARDS_OF_THE_WRITE: Readonly<
  Record<string, readonly (readonly [turnIndex: number, kind: AssistantCardKind])[]>
> = {
  "write-update-entry-count": [
    [0, "logged"],
    [1, "updated"],
  ],
  "write-update-entry-grams": [
    [0, "logged"],
    [1, "updated"],
  ],
  "write-update-entry-time": [
    [0, "logged"],
    [1, "updated"],
  ],
  "write-delete-one-entry": [
    [0, "logged"],
    [1, "deleted"],
  ],
  "write-delete-several-entries-after-a-yes": [
    [0, "logged"],
    [2, "deleted"],
  ],
  "write-delete-several-entries-after-a-no": [[0, "logged"]],
  "write-copy-day-onto-an-empty-day": [[0, "day_copied"]],
  "write-copy-day-after-a-yes": [
    [0, "logged"],
    [2, "day_copied"],
  ],
  "write-copy-day-after-a-no": [[0, "logged"]],
  "write-complete-a-day": [
    [0, "logged"],
    [1, "day_completed"],
  ],
  "write-reopen-a-day": [
    [0, "logged"],
    [1, "day_completed"],
    [2, "day_completed"],
  ],
  "write-create-a-recipe": [[0, "recipe_created"]],
  "write-archive-a-recipe-after-a-yes": [
    [0, "recipe_created"],
    [2, "recipe_archived"],
  ],
  "write-archive-a-recipe-after-a-no": [[0, "recipe_created"]],
  "write-create-a-food-per-portion": [[0, "food_created"]],
  "write-create-a-food-per-100-g": [[0, "food_created"]],
  "write-set-calories-after-a-yes": [[1, "targets_changed"]],
  "write-set-calories-after-a-no": [],
  "write-set-all-the-targets-after-a-yes": [[1, "targets_changed"]],
  "write-set-calories-and-some-macros-asks": [],
  "undo-a-logged-entry": [[0, "logged"]],
  "undo-a-deleted-entry": [
    [0, "logged"],
    [1, "deleted"],
  ],
  "undo-a-copied-day": [[0, "day_copied"]],
  "undo-a-completed-day": [
    [0, "logged"],
    [1, "day_completed"],
  ],
  "undo-a-created-recipe": [[0, "recipe_created"]],
  "undo-an-archived-recipe": [
    [0, "recipe_created"],
    [2, "recipe_archived"],
  ],
  "undo-a-created-food": [[0, "food_created"]],
  "never-repeated-the-same-message-twice": [[0, "logged"]],
  "log-yesterdays-lunch-again": [[0, "logged"]],
};

const dayCount = dayEntries(41).length;

/** The cases of the set for a run whose today is `anchorDate`. */
export function writeCasesOf(anchorDate: string): readonly EvalCase[] {
  const yesterday = diaryDateOf(anchorDate, 41);
  let nextScratchDay = 0;
  const scratchDay = (): string => {
    nextScratchDay += 1;
    return scratchDayOf(anchorDate, nextScratchDay);
  };

  const make = (
    id: string,
    messages: EvalCase["messages"],
    expect: readonly Grader[],
    extras: Pick<EvalCase, "afterTurn" | "cleanUp"> = {},
  ): EvalCase => ({
    id,
    set: "writes",
    messages,
    expect: [
      ...expect,
      ...(CARDS_OF_THE_WRITE[id] ?? []).map(([turnIndex, kind]) => cardOfKind(turnIndex, kind)),
      onlyTheseTools(ALL_TOOLS),
    ].map((grade) => withContext(grade, messages)),
    ...extras,
  });

  // The words of a turn that makes the entry a later turn changes.
  const logEggs = (day: string) => `Log two large eggs on ${sayDay(day)} at 08:00.`;
  const logBanana = (day: string) => `Log a banana on ${sayDay(day)} at 09:00.`;
  const makeRecipe = (name: string) =>
    `Make a recipe called ${name} for 1 serving: 50 g porridge oats and 200 g semi-skimmed milk.`;
  const recipeIngredients = [
    [FOOD_ROUTES.porridgeOats, 50],
    [FOOD_ROUTES.semiSkimmedMilk, 200],
  ] as const;

  const copyOnto = (day: string) => `Copy everything I ate yesterday onto ${sayDay(day)}.`;
  const copyCalled = (day: string) =>
    calledWith(
      "copy_day",
      (input) =>
        input["from"] === yesterday && input["to"] === day && input["entry_count"] === dayCount,
      `yesterday's ${dayCount} entries onto ${day}`,
    );

  const scaled = scaleMacroTargets(ASK_TARGETS, 2000);
  const adjusted = scaled.outcome === "scaled" ? scaled.macros : null;
  if (adjusted === null) {
    throw new Error("The ask targets cannot be scaled to 2,000 kcal");
  }
  const restoreTargetsAfter: Pick<EvalCase, "cleanUp"> = {
    // Not Undo first: for the eval user the targets action answers unavailable, and a strict cleanUp would fail.
    cleanUp: async (_turns, environment) => {
      await environment.restoreTargets();
    },
  };
  const targetsAre = (
    kcal: number,
    protein: number | null,
    carbs: number | null,
    fat: number | null,
  ): Grader =>
    rowCount(
      {
        table: "profiles",
        where: {
          target_kcal: kcal,
          target_protein_g: protein,
          target_carbs_g: carbs,
          target_fat_g: fat,
        },
      },
      1,
    );
  const unchangedTargets = targetsAre(
    ASK_TARGETS.kcal,
    ASK_TARGETS.protein_g,
    ASK_TARGETS.carbs_g,
    ASK_TARGETS.fat_g,
  );
  const changeCalories = confirmTargetsButtons(ASK_TARGETS.kcal);

  const updateDay = [scratchDay(), scratchDay(), scratchDay()] as const;
  const deleteDays = [scratchDay(), scratchDay(), scratchDay()] as const;
  const copyDays = [scratchDay(), scratchDay(), scratchDay()] as const;
  const completeDays = [scratchDay(), scratchDay()] as const;
  const undoDays = [scratchDay(), scratchDay(), scratchDay(), scratchDay()] as const;

  const bananaOnce: ExpectedItem = { codes: FOOD_ROUTES.banana, amount: { count: 1 } };

  const cases: EvalCase[] = [
    // update_entry: a count, grams and a time, each on an entry the case logged.
    make(
      "write-update-entry-count",
      [logEggs(updateDay[0]), "Change that to three eggs."],
      [
        actionRows("log_entry", 1, [0]),
        calledWith(
          "update_entry",
          (input) => input["amount"] === 3 && (input["time"] ?? null) === null,
          "amount 3",
        ),
        actionRows("update_entry", 1, [1]),
        entriesOn(updateDay[0], 1),
        rowCount(
          {
            table: "food_log_entries",
            where: { local_date: updateDay[0], quantity: 3, deleted_at: null },
          },
          1,
        ),
        turnEnded(1, "complete"),
      ],
    ),
    make(
      "write-update-entry-grams",
      [
        `Log 150 g of grilled chicken breast on ${sayDay(updateDay[1])} at 12:00.`,
        "Change that to 200 g.",
      ],
      [
        actionRows("log_entry", 1, [0]),
        calledWith(
          "update_entry",
          (input) => input["amount"] === 200 && (input["time"] ?? null) === null,
          "amount 200",
        ),
        actionRows("update_entry", 1, [1]),
        rowCount(
          {
            table: "food_log_entries",
            where: { local_date: updateDay[1], quantity: 200, deleted_at: null },
          },
          1,
        ),
      ],
    ),
    make(
      "write-update-entry-time",
      [logBanana(updateDay[2]), "Move that to 11:30."],
      [
        actionRows("log_entry", 1, [0]),
        calledWith(
          "update_entry",
          (input) => input["time"] === "11:30" && (input["amount"] ?? null) === null,
          "time 11:30",
        ),
        actionRows("update_entry", 1, [1]),
        entriesOn(updateDay[2], 1),
      ],
    ),

    // delete_entry: one entry deletes at once, several wait for a yes.
    make(
      "write-delete-one-entry",
      [logBanana(deleteDays[0]), "Delete that banana."],
      [
        calledWith(
          "delete_entry",
          (input) => Array.isArray(input["ids"]) && input["ids"].length === 1,
          "one id",
        ),
        actionRows("delete_entry", 1, [1]),
        entriesOn(deleteDays[0], 0),
        turnEnded(1, "complete"),
      ],
    ),
    make(
      "write-delete-several-entries-after-a-yes",
      [
        `Log two large eggs and a banana on ${sayDay(deleteDays[1])} at 09:00.`,
        `Delete everything I logged on ${sayDay(deleteDays[1])} in one go.`,
        confirmDeleteButtons(2).confirmLabel,
      ],
      [
        actionRows("log_entry", 2, [0]),
        turnEnded(1, "confirm"),
        noActionRowsInTurn(1),
        calledWith(
          "delete_entry",
          (input) => Array.isArray(input["ids"]) && input["ids"].length === 2,
          "two ids",
        ),
        actionRows("delete_entry", 1, [2]),
        entriesOn(deleteDays[1], 0),
      ],
    ),
    make(
      "write-delete-several-entries-after-a-no",
      [
        `Log two large eggs and a banana on ${sayDay(deleteDays[2])} at 09:00.`,
        `Delete everything I logged on ${sayDay(deleteDays[2])} in one go.`,
        confirmDeleteButtons(2).cancelLabel,
      ],
      [
        actionRows("log_entry", 2, [0]),
        turnEnded(1, "confirm"),
        noActionRowsInTurn(1),
        actionRows("delete_entry", 0),
        entriesOn(deleteDays[2], 2),
      ],
    ),

    // copy_day: onto an empty day at once, onto a day with entries after a yes.
    make(
      "write-copy-day-onto-an-empty-day",
      [copyOnto(copyDays[0])],
      [
        copyCalled(copyDays[0]),
        actionRows("copy_day", 1),
        entriesOn(copyDays[0], dayCount),
        turnEnded(0, "complete"),
      ],
    ),
    make(
      "write-copy-day-after-a-yes",
      [logBanana(copyDays[1]), copyOnto(copyDays[1]), confirmCopyButtons(dayCount).confirmLabel],
      [
        turnEnded(1, "confirm"),
        noActionRowsInTurn(1),
        copyCalled(copyDays[1]),
        actionRows("copy_day", 1, [2]),
        entriesOn(copyDays[1], dayCount + 1),
      ],
    ),
    make(
      "write-copy-day-after-a-no",
      [logBanana(copyDays[2]), copyOnto(copyDays[2]), confirmCopyButtons(dayCount).cancelLabel],
      [
        turnEnded(1, "confirm"),
        noActionRowsInTurn(1),
        actionRows("copy_day", 0),
        entriesOn(copyDays[2], 1),
      ],
    ),

    // set_day_complete: complete, then not complete.
    make(
      "write-complete-a-day",
      [logBanana(completeDays[0]), `Mark ${sayDay(completeDays[0])} as complete.`],
      [
        calledWith(
          "set_day_complete",
          (input) => input["local_date"] === completeDays[0] && input["complete"] === true,
          "the day complete",
        ),
        actionRows("set_day_complete", 1),
        rowCount(
          { table: "day_logs", where: { local_date: completeDays[0], is_complete: true } },
          1,
        ),
      ],
    ),
    make(
      "write-reopen-a-day",
      [
        logBanana(completeDays[1]),
        `Mark ${sayDay(completeDays[1])} as complete.`,
        `Mark ${sayDay(completeDays[1])} as not complete after all.`,
      ],
      [
        calledWith(
          "set_day_complete",
          (input) => input["local_date"] === completeDays[1] && input["complete"] === false,
          "the day not complete",
        ),
        actionRows("set_day_complete", 2),
        rowCount(
          { table: "day_logs", where: { local_date: completeDays[1], is_complete: false } },
          1,
        ),
      ],
    ),

    // create_recipe and archive_recipe.
    make(
      "write-create-a-recipe",
      [makeRecipe("Scratch oat bowl")],
      [
        recipeCreated("Scratch oat bowl", 1, recipeIngredients),
        actionRows("create_recipe", 1),
        recipeIs("Scratch oat bowl", false, 1),
      ],
    ),
    make(
      "write-archive-a-recipe-after-a-yes",
      [
        makeRecipe("Scratch oat pot"),
        "Archive my Scratch oat pot recipe.",
        confirmArchiveButtons().confirmLabel,
      ],
      [
        actionRows("create_recipe", 1, [0]),
        turnEnded(1, "confirm"),
        noActionRowsInTurn(1),
        actionRows("archive_recipe", 1, [2]),
        recipeIs("Scratch oat pot", true, 1),
      ],
    ),
    make(
      "write-archive-a-recipe-after-a-no",
      [
        makeRecipe("Scratch oat tub"),
        "Archive my Scratch oat tub recipe.",
        confirmArchiveButtons().cancelLabel,
      ],
      [
        actionRows("create_recipe", 1, [0]),
        turnEnded(1, "confirm"),
        noActionRowsInTurn(1),
        actionRows("archive_recipe", 0),
        recipeIs("Scratch oat tub", false, 1),
      ],
    ),

    // create_custom_food: a label per bar, and a label per 100 g.
    make(
      "write-create-a-food-per-portion",
      [
        "Save a food called Scratch protein bar: 210 kcal, 20 g protein, 19 g carbs and 6 g fat per bar. One bar weighs 60 g.",
      ],
      [
        calledWith(
          "create_custom_food",
          (input) =>
            input["name"] === "Scratch protein bar" &&
            input["per"] === "per_portion" &&
            input["portion_grams"] === 60 &&
            typeof input["portion_label"] === "string" &&
            /bar/i.test(input["portion_label"]) &&
            input["kcal"] === 210 &&
            input["protein_g"] === 20 &&
            input["carbs_g"] === 19 &&
            input["fat_g"] === 6,
          "the label's figures per bar",
        ),
        actionRows("create_custom_food", 1),
        rowCount({ table: "foods", where: { name: "Scratch protein bar", deleted_at: null } }, 1),
      ],
    ),
    make(
      "write-create-a-food-per-100-g",
      [
        "Save a food called Scratch granola: per 100 g it has 450 kcal, 10 g protein, 60 g carbs and 18 g fat.",
      ],
      [
        calledWith(
          "create_custom_food",
          (input) =>
            input["name"] === "Scratch granola" &&
            input["per"] === "per_100g" &&
            (input["portion_label"] ?? null) === null &&
            (input["portion_grams"] ?? null) === null &&
            input["kcal"] === 450 &&
            input["protein_g"] === 10 &&
            input["carbs_g"] === 60 &&
            input["fat_g"] === 18,
          "the label's figures per 100 g",
        ),
        actionRows("create_custom_food", 1),
        rowCount({ table: "foods", where: { name: "Scratch granola", deleted_at: null } }, 1),
      ],
    ),

    // update_targets: calories only (macros null, none asked for, the macros line ends the question), all
    // three macros, and a partial set that is asked about and never guessed.
    make(
      "write-set-calories-after-a-yes",
      ["Set my calories to 2,000.", changeCalories.confirmLabel],
      [
        turnEnded(0, "confirm"),
        noActionRowsInTurn(0),
        calledWith(
          "update_targets",
          (input) =>
            input["kcal"] === 2000 &&
            input["macros"] === null &&
            input["current_kcal"] === ASK_TARGETS.kcal,
          "2000 kcal, macros null and the current calories",
        ),
        noQuestionsAsked(),
        confirmationEndsWith(0, describeMacrosAdjustedNote(adjusted)),
        actionRows("update_targets", 1, [1]),
        targetsAre(2000, adjusted.protein_g, adjusted.carbs_g, adjusted.fat_g),
      ],
      restoreTargetsAfter,
    ),
    make(
      "write-set-calories-after-a-no",
      ["Set my calories to 2,000.", changeCalories.cancelLabel],
      [
        turnEnded(0, "confirm"),
        noActionRowsInTurn(0),
        noQuestionsAsked(),
        confirmationEndsWith(0, describeMacrosAdjustedNote(adjusted)),
        actionRows("update_targets", 0),
        unchangedTargets,
      ],
      restoreTargetsAfter,
    ),
    make(
      "write-set-all-the-targets-after-a-yes",
      [
        "Set my targets to 1,800 calories, 140 g protein, 180 g carbs and 57 g fat.",
        changeCalories.confirmLabel,
      ],
      [
        turnEnded(0, "confirm"),
        noActionRowsInTurn(0),
        calledWith(
          "update_targets",
          (input) => {
            const { macros } = input;
            return (
              input["kcal"] === 1800 &&
              input["current_kcal"] === ASK_TARGETS.kcal &&
              typeof macros === "object" &&
              macros !== null &&
              "protein_g" in macros &&
              macros.protein_g === 140 &&
              "carbs_g" in macros &&
              macros.carbs_g === 180 &&
              "fat_g" in macros &&
              macros.fat_g === 57
            );
          },
          "all three macros as the user gave them",
        ),
        confirmationLacks(0, "adjusted proportionally"),
        actionRows("update_targets", 1, [1]),
        targetsAre(1800, 140, 180, 57),
      ],
      restoreTargetsAfter,
    ),
    make(
      "write-set-calories-and-some-macros-asks",
      ["Set my calories to 1,800 and my protein to 140 g."],
      [turnEnded(0, "clarify"), askedOnce(), noActionRows(), unchangedTargets],
      restoreTargetsAfter,
    ),
  ];

  // Undo: one press undoes what the turn wrote, and a second finds it already undone.
  const undoOne = undoOnTurn(0, 1);
  const undoDelete = undoOnTurn(1, 1);
  const undoCopy = undoOnTurn(0, 1);
  const undoComplete = undoOnTurn(1, 1);
  const undoCreate = undoOnTurn(0, 1);
  const undoArchive = undoOnTurn(2, 1);
  const undoFood = undoOnTurn(0, 1);
  const undoCases: EvalCase[] = [
    make(
      "undo-a-logged-entry",
      [logEggs(undoDays[0])],
      [actionRows("log_entry", 1), undoOne.undone, entriesOn(undoDays[0], 0)],
      { afterTurn: undoOne.afterTurn },
    ),
    make(
      "undo-a-deleted-entry",
      [logBanana(undoDays[1]), "Delete that banana."],
      [actionRows("delete_entry", 1), undoDelete.undone, entriesOn(undoDays[1], 1)],
      { afterTurn: undoDelete.afterTurn },
    ),
    make(
      "undo-a-copied-day",
      [copyOnto(undoDays[2])],
      [actionRows("copy_day", 1), undoCopy.undone, entriesOn(undoDays[2], 0)],
      { afterTurn: undoCopy.afterTurn },
    ),
    make(
      "undo-a-completed-day",
      [logBanana(undoDays[3]), `Mark ${sayDay(undoDays[3])} as complete.`],
      [
        actionRows("set_day_complete", 1),
        undoComplete.undone,
        rowCount({ table: "day_logs", where: { local_date: undoDays[3], is_complete: true } }, 0),
      ],
      { afterTurn: undoComplete.afterTurn },
    ),
    make(
      "undo-a-created-recipe",
      [makeRecipe("Scratch oat jar")],
      [
        actionRows("create_recipe", 1),
        undoCreate.undone,
        recipeIs("Scratch oat jar", false, 0),
        recipeIs("Scratch oat jar", true, 1),
      ],
      { afterTurn: undoCreate.afterTurn },
    ),
    make(
      "undo-an-archived-recipe",
      [
        makeRecipe("Scratch oat cup"),
        "Archive my Scratch oat cup recipe.",
        confirmArchiveButtons().confirmLabel,
      ],
      [actionRows("archive_recipe", 1), undoArchive.undone, recipeIs("Scratch oat cup", false, 1)],
      { afterTurn: undoArchive.afterTurn },
    ),
    make(
      "undo-a-created-food",
      [
        "Save a food called Scratch jam: per 100 g it has 250 kcal, 0 g protein, 62 g carbs and 0 g fat.",
      ],
      [
        actionRows("create_custom_food", 1),
        undoFood.undone,
        rowCount({ table: "foods", where: { name: "Scratch jam", deleted_at: null } }, 0),
      ],
      { afterTurn: undoFood.afterTurn },
    ),
  ];

  // The same message twice is two turns. A second log is right, and so is one question ("again?"), but the
  // second turn must never replay the first's write: each turn leaves at most its own row for the tool, and no
  // target of the first turn is written again.
  const bananaLogged = [
    loggedItems([bananaOnce], anchorDate, [0]),
    loggedRows([bananaOnce], anchorDate, [0]),
  ];
  const repeated = make(
    "never-repeated-the-same-message-twice",
    ["I had a banana.", "I had a banana."],
    [
      distinctTurns(),
      oneRowPerToolPerMessage(),
      actionRows("log_entry", 1, [0]),
      anyOfRoutes([
        [
          loggedItems([bananaOnce, bananaOnce], anchorDate),
          loggedRows([bananaOnce, bananaOnce], anchorDate),
          actionRows("log_entry", 1, [1]),
          cardOfKind(1, "logged"),
        ],
        [...bananaLogged, turnEnded(1, "clarify"), askedOnce(), noActionRowsInTurn(1)],
      ]),
    ],
    { cleanUp: undoWrites },
  );

  // "Log yesterday's lunch again" reads yesterday first, logs what the diary holds, and Undo takes it out. The
  // reply is not graded: the prompt tells the model the reply never repeats the card's details, so a count in
  // the words would be asking for what the prompt forbids. The foods are exactly the fixture's: `get_entries`
  // gives the full CoFID name of each entry, so a search finds the same food, and "again" means the same food.
  const lunchItems = lunchOfDay(41).map(({ code, grams }): ExpectedItem => ({
    codes: [code],
    amount: { grams },
    time: "any",
  }));
  const undoLunch = undoOnTurn(0, lunchItems.length);
  const again = make(
    "log-yesterdays-lunch-again",
    ["Log yesterday's lunch again."],
    [
      readBeforeFirstLog(yesterday),
      loggedItems(lunchItems, anchorDate),
      loggedRows(lunchItems, anchorDate),
      actionRows("log_entry", lunchItems.length),
      undoLunch.undone,
    ],
    // The case presses Undo itself, and the cleanUp finds it already undone or fails loudly.
    { afterTurn: undoLunch.afterTurn, cleanUp: undoWrites },
  );

  return [...cases, ...undoCases, repeated, again];
}

/** Passes when the turns of the case are different turns, so the second did not replay the first. */
function distinctTurns(): Grader {
  return ({ turns }) => {
    const ids = new Set(turns.map(({ turnId }) => turnId));
    return Promise.resolve(
      ids.size === turns.length
        ? { passed: true, reason: "every message was its own turn" }
        : { passed: false, reason: "two messages shared one turn" },
    );
  };
}

/** The set for a run now: the eval user's today is the UTC date, as the ask set takes it. */
export const writeCases: readonly EvalCase[] = writeCasesOf(new Date().toISOString().slice(0, 10));
