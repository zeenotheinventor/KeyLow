import { z } from "zod";

import { cardEntryOfRow, describeCardName, sharedClockTime } from "./cards";
import { describeLoggedTitle, describeLoggedUndone } from "../copy/assistantEntryCards";
import { describeFoodCreatedTitle, describeFoodsCount } from "../copy/assistantFoodCards";
import {
  describeRecipeArchivedTitle,
  describeRecipeServings,
  describeRecipeUpdatedTitle,
  describeRecipesCount,
} from "../copy/assistantRecipeCards";
import { describeSetUpdatedTitle, describeSetsPutBack } from "../copy/assistantTrainingCards";
import { formatCalories, formatGrams } from "../format/numbers";

import type { AssistantCard, AssistantCardKind } from "./card";
import type { CardEntry } from "./cards";

/*
 * The words a write tool gives to something the app builds from several writes at once: a card that
 * merges consecutive calls of one tool in a turn, and a row of "What the assistant changed". Each write
 * ticket (KEY-688, 693, 694, 697, 698) adds one line for its tool to `changeBuilders` and, when the board
 * words a merge, one line for its kind to `cardMergers`. Until it does, a tool falls back to the plain
 * words here, so a row or a merged card always has a title and never shows an id.
 *
 * A builder gets `row`s as the target table's read returns them, untyped, so it parses each with its own
 * schema and words a row it cannot parse plainly. All the targets of a multi-row action share the one
 * `target_updated_at` the write recorded.
 */

/** Every write tool, with the kind of card it builds. */
export const ASSISTANT_WRITE_TOOL_CARD_KINDS = {
  log_entry: "logged",
  update_entry: "updated",
  delete_entry: "deleted",
  copy_day: "day_copied",
  set_day_complete: "day_completed",
  create_recipe: "recipe_created",
  import_recipe_from_url: "recipe_created",
  update_recipe: "recipe_updated",
  archive_recipe: "recipe_archived",
  create_custom_food: "food_created",
  update_targets: "targets_changed",
  edit_routine: "routine_updated",
  set_active_routine: "routine_active",
  archive_routine: "routine_archived",
  create_routine: "routine_created",
  update_training_goals: "goals_updated",
  // The tool adds an exercise or renames one, and this is the kind of its plain words. The card says which.
  save_custom_exercise: "exercise_created",
  archive_custom_exercise: "exercise_archived",
  update_past_set: "set_updated",
  delete_workout: "workout_deleted",
} as const satisfies Record<string, AssistantCardKind>;

export type AssistantWriteTool = keyof typeof ASSISTANT_WRITE_TOOL_CARD_KINDS;

export const isAssistantWriteTool = (tool: string): tool is AssistantWriteTool =>
  Object.hasOwn(ASSISTANT_WRITE_TOOL_CARD_KINDS, tool);

/**
 * The write tools whose Undo is off in M8 (ADR 0006, Guards): an edit keeps no previous value to go
 * back to. The thread and the changes list both read this one set.
 */
export const ASSISTANT_TOOLS_WITHOUT_UNDO: ReadonlySet<string> = new Set([
  "update_entry",
  "update_recipe",
]);

/**
 * The training write tools whose Undo needs the value the turn stored (`previousValueOf`), or the
 * fingerprint it stored to tell that the person has not changed the row since. Once the conversation is
 * deleted its turns go, the actions keep a null `turn_id`, and Undo on these answers unavailable on every
 * press. The tools left out undo from the row alone: `archive_routine` and `archive_custom_exercise`
 * restore the row, `update_training_goals` reads the goals history and `delete_workout` restores the
 * session, so their Undo still works with no turn.
 */
export const ASSISTANT_TOOLS_NEEDING_STORED_UNDO: ReadonlySet<string> = new Set([
  "edit_routine",
  "set_active_routine",
  "create_routine",
  "update_past_set",
  "save_custom_exercise",
]);

/** The kinds of card those tools build. */
export const ASSISTANT_CARD_KINDS_WITHOUT_UNDO: ReadonlySet<AssistantCardKind> = new Set(
  [...ASSISTANT_TOOLS_WITHOUT_UNDO].flatMap((tool) =>
    isAssistantWriteTool(tool) ? [ASSISTANT_WRITE_TOOL_CARD_KINDS[tool]] : [],
  ),
);

/**
 * A row a write changed, as the person's own read of the target table returns it. `row` is null when it
 * no longer exists, and then a builder words the change plainly.
 */
export type AssistantChangeTarget = { id: string; row: Readonly<Record<string, unknown>> | null };

/**
 * What a row of the changes list is worded from: the tool, how many of its writes the row groups, and
 * the target rows those writes left behind.
 */
export type AssistantChangeInput = {
  tool: string;
  actionCount: number;
  targets: readonly AssistantChangeTarget[];
};

/** `detail` is the part of the row's second line after the time ("2 entries"), or null. */
export type AssistantChangeWords = { title: string; detail: string | null };

type AssistantChangeBuilder = (input: AssistantChangeInput) => AssistantChangeWords;

type AssistantCardMerger = (cards: readonly AssistantCard[]) => AssistantCard;

const entries = (count: number): string => (count === 1 ? "1 entry" : `${count} entries`);

// The entries a change's rows hold. The rows come from `readLoggedEntries`, which adds `clock_time`, so
// the zone given here is only for a row without it.
const entriesOfTargets = (targets: readonly AssistantChangeTarget[]): CardEntry[] =>
  targets.flatMap(({ row }) => {
    const entry = row === null ? null : cardEntryOfRow(row, "UTC");
    return entry === null ? [] : [entry];
  });

// "Logged 2 eggs and toast at 08:10" with "2 entries" under it, as the changes board words a log. A
// change whose rows are gone or unreadable falls back to the plain words.
const describeLoggedEntries: AssistantChangeBuilder = ({ actionCount, targets }) => {
  const logged = entriesOfTargets(targets);
  if (logged.length === 0) {
    return { title: plainTitles.logged(actionCount), detail: null };
  }
  return {
    title: describeLoggedTitle(logged.map(describeCardName), sharedClockTime(logged)),
    detail: logged.length >= 2 ? entries(logged.length) : null,
  };
};

const loggedTitlePattern = /^Logged (.+?)(?: at (\d{2}:\d{2}))?$/;
const totalPartPattern = /^(?:(\d[\d,]*) kcal|([PCF]) (\d+(?:\.\d)?) g)$/;

// Adds up the figures printed in the totals of the cards. Each card printed rounded figures, so the sum
// of grams can differ by a gram from the sum of the unrounded entries.
function sumOfTotals(cards: readonly AssistantCard[]): string | null {
  const sums = { kcal: 0, P: 0, C: 0, F: 0 };
  const seen = new Set<string>();
  for (const card of cards) {
    if (card.totalText === null) {
      return null;
    }
    for (const part of card.totalText.split(" · ")) {
      const match = totalPartPattern.exec(part);
      if (match === null) {
        return null;
      }
      const [, kcal, letter, grams] = match;
      if (kcal !== undefined) {
        sums.kcal += Number(kcal.replaceAll(",", ""));
        seen.add("kcal");
      } else if (letter === "P" || letter === "C" || letter === "F") {
        sums[letter] += Number(grams);
        seen.add(letter);
      }
    }
  }
  const parts = [
    seen.has("kcal") ? `${formatCalories(sums.kcal)} kcal` : null,
    ...(["P", "C", "F"] as const).map((letter) =>
      seen.has(letter) ? `${letter} ${formatGrams(sums[letter])} g` : null,
    ),
  ].filter((part): part is string => part !== null);
  return parts.length === 0 ? null : parts.join(" · ");
}

// Two `log_entry` calls in one turn are one card: "Logged 2 eggs and toast at 08:10". Each call's card is
// worded by `buildLoggedCard`, so its title is taken apart again here.
function mergeLoggedCards(cards: readonly AssistantCard[]): AssistantCard {
  const [first] = cards;
  const parts = cards.map((card) => loggedTitlePattern.exec(card.title));
  const names = parts.map((part) => part?.[1]);
  if (first === undefined || names.some((name) => name === undefined)) {
    return plainMerge(cards);
  }
  const times = new Set(parts.map((part) => part?.[2] ?? null));
  const [onlyTime] = [...times];
  const clockTime = times.size === 1 && onlyTime !== undefined ? onlyTime : null;
  const joined = names.filter((name): name is string => name !== undefined);
  return {
    ...first,
    actionIds: cards.flatMap((card) => card.actionIds),
    title: describeLoggedTitle(joined, clockTime),
    rows: cards.flatMap((card) => card.rows),
    totalText: sumOfTotals(cards),
    undoneSub: describeLoggedUndone(joined, clockTime),
  };
}

// "Copied 8 entries". The board adds "from yesterday", but a copy's rows are on the day it was copied onto
// and the action holds no source day, so the words stop at the count. A copy whose rows are gone is plain.
const describeCopiedEntries: AssistantChangeBuilder = ({ actionCount, targets }) => {
  const copied = targets.filter(({ row }) => row !== null).length;
  return {
    title: copied === 0 ? plainTitles.day_copied(actionCount) : `Copied ${entries(copied)}`,
    detail: null,
  };
};

// The part of a `recipes` row the words read. A row that has no name is worded plainly.
const recipeRowSchema = z.looseObject({ name: z.string().min(1), servings: z.number().positive() });

// "Added recipe Pasta bake" with "4 servings" under it, as the changes board words a created recipe. A row
// that groups several recipes counts them, and a change whose rows are gone or unreadable is plain.
const describeRecipeChange =
  (
    kind: "recipe_created" | "recipe_archived" | "recipe_updated",
    title: (name: string) => string,
  ): AssistantChangeBuilder =>
  ({ actionCount, targets }) => {
    const recipes = targets.flatMap(({ row }) => {
      const recipe = recipeRowSchema.safeParse(row);
      return recipe.success ? [recipe.data] : [];
    });
    const [only] = recipes;
    if (only === undefined || recipes.length !== targets.length) {
      return { title: plainTitles[kind](actionCount), detail: null };
    }
    if (recipes.length > 1) {
      return { title: plainTitles[kind](recipes.length), detail: null };
    }
    return {
      title: title(only.name),
      detail: kind === "recipe_created" ? describeRecipeServings(only.servings) : null,
    };
  };

// The part of a `foods` row the words read.
const foodRowSchema = z.looseObject({ name: z.string().min(1) });

// "Added food My protein bar", as the changes board words a created food. Several foods in one row are
// counted, and a food that is gone (deleted since) or unreadable is worded plainly.
const describeFoodChange: AssistantChangeBuilder = ({ actionCount, targets }) => {
  const foods = targets.flatMap(({ row }) => {
    const food = foodRowSchema.safeParse(row);
    return food.success ? [food.data] : [];
  });
  const [only] = foods;
  if (only === undefined || foods.length !== targets.length) {
    return { title: plainTitles.food_created(actionCount), detail: null };
  }
  return {
    title:
      foods.length > 1
        ? plainTitles.food_created(foods.length)
        : describeFoodCreatedTitle(only.name),
    detail: null,
  };
};

// A write ticket adds its tool here, with the board's words for its rows.
const changeBuilders: Readonly<Partial<Record<AssistantWriteTool, AssistantChangeBuilder>>> = {
  log_entry: describeLoggedEntries,
  copy_day: describeCopiedEntries,
  create_recipe: describeRecipeChange("recipe_created", (name) => `Added recipe ${name}`),
  import_recipe_from_url: describeRecipeChange("recipe_created", (name) => `Added recipe ${name}`),
  update_recipe: describeRecipeChange("recipe_updated", describeRecipeUpdatedTitle),
  archive_recipe: describeRecipeChange("recipe_archived", describeRecipeArchivedTitle),
  create_custom_food: describeFoodChange,
};

// "Added 2 recipes" with a line for Undo that keeps the count. No link, because the recipes are several,
// and an edit keeps the note that says its Undo is off.
function mergeRecipeCards(cards: readonly AssistantCard[]): AssistantCard {
  const merged = plainMerge(cards);
  const recipes = describeRecipesCount(merged.actionIds.length);
  switch (merged.kind) {
    case "recipe_created":
      return { ...merged, undoneSub: `Archived ${recipes}` };
    case "recipe_archived":
      return { ...merged, undoneSub: `Restored ${recipes}` };
    case "recipe_updated":
      return { ...merged, note: cards[0]?.note ?? null };
    default:
      return merged;
  }
}

// A write ticket adds its kind here when the board words several calls as one card.
const cardMergers: Readonly<Partial<Record<AssistantCardKind, AssistantCardMerger>>> = {
  logged: mergeLoggedCards,
  recipe_created: mergeRecipeCards,
  recipe_updated: mergeRecipeCards,
  recipe_archived: mergeRecipeCards,
  set_updated: mergeSetUpdatedCards,
};

const setUpdatedTitlePattern = /^Changed a set in (.+)$/;

// Several `update_past_set` calls of one workout are one card: "Changed 3 sets in Legs", the rows joined
// and one Undo over all the action ids. Each call's title is taken apart again for the place, as a log's is.
// Sets of different workouts have no one day or session to name, so they are worded plainly.
function mergeSetUpdatedCards(cards: readonly AssistantCard[]): AssistantCard {
  const merged = plainMerge(cards);
  const count = merged.actionIds.length;
  const [first] = cards;
  const place = first === undefined ? undefined : setUpdatedTitlePattern.exec(first.title)?.[1];
  const isOneWorkout =
    first !== undefined &&
    place !== undefined &&
    cards.every(
      (card) =>
        setUpdatedTitlePattern.exec(card.title)?.[1] === place &&
        card.sub === first.sub &&
        JSON.stringify(card.link) === JSON.stringify(first.link),
    );
  if (!isOneWorkout) {
    return { ...merged, undoneSub: describeSetsPutBack(count, null) };
  }
  return {
    ...merged,
    title: describeSetUpdatedTitle(place, count),
    sub: first.sub,
    changeDetail: first.changeDetail ?? null,
    link: first.link,
    undoneSub: describeSetsPutBack(count, place),
  };
}

const plainTitles: Record<AssistantCardKind, (count: number) => string> = {
  logged: (count) => `Logged ${entries(count)}`,
  updated: (count) => `Updated ${entries(count)}`,
  deleted: (count) => `Deleted ${entries(count)}`,
  day_copied: () => "Copied a day",
  // NOT ON THE CANVAS. The row does not say which way the call went, so it never claims "complete".
  day_completed: () => "Changed whether a day is complete",
  recipe_created: (count) => (count === 1 ? "Added a recipe" : `Added ${count} recipes`),
  recipe_updated: (count) => (count === 1 ? "Updated a recipe" : `Updated ${count} recipes`),
  recipe_archived: (count) => (count === 1 ? "Archived a recipe" : `Archived ${count} recipes`),
  food_created: describeFoodsCount,
  targets_changed: () => "Changed your targets",
  routine_updated: () => "Updated a routine",
  routine_active: () => "Changed your active routine",
  routine_archived: () => "Archived a routine",
  routine_created: () => "Built a routine",
  goals_updated: () => "Updated your training goals",
  exercise_created: () => "Added an exercise",
  exercise_updated: () => "Updated an exercise",
  exercise_archived: () => "Archived an exercise",
  set_updated: (count) => (count === 1 ? "Changed a set" : `Changed ${count} sets`),
  workout_deleted: () => "Deleted a workout",
};

/** The title and detail of one row of "What the assistant changed". */
export function describeAssistantChange(input: AssistantChangeInput): AssistantChangeWords {
  if (!isAssistantWriteTool(input.tool)) {
    return { title: "Made a change", detail: null };
  }
  const build = changeBuilders[input.tool];
  if (build !== undefined) {
    return build(input);
  }
  const kind = ASSISTANT_WRITE_TOOL_CARD_KINDS[input.tool];
  return { title: plainTitles[kind](input.actionCount), detail: null };
}

/**
 * One card from the cards of consecutive results of one tool in a turn, in call order. The action ids are
 * joined and the rows appended. Without the write's own merger the lines that described a single call
 * (the sub, the total, the note, the link and the undone line) are dropped and the title is plain, so a
 * merged card is never worded wrongly.
 */
export function mergeAssistantCards(
  cards: readonly [AssistantCard, ...AssistantCard[]],
): AssistantCard {
  const [first, ...others] = cards;
  if (others.length === 0) {
    return first;
  }
  const merge = cardMergers[first.kind];
  if (merge !== undefined) {
    return merge(cards);
  }
  return plainMerge(cards);
}

function plainMerge(cards: readonly AssistantCard[]): AssistantCard {
  const [first] = cards;
  const actionIds = cards.flatMap((card) => card.actionIds);
  if (first === undefined) {
    throw new Error("There are no cards to merge");
  }
  return {
    ...first,
    actionIds,
    title: plainTitles[first.kind](actionIds.length),
    sub: null,
    rows: cards.flatMap((card) => card.rows),
    days: null,
    changeDetail: null,
    totalText: null,
    note: null,
    link: null,
    undoneSub: null,
  };
}
