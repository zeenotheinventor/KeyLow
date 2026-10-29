import {
  MAX_SHOPPING_ITEM_GRAMS,
  MAX_SHOPPING_ITEM_NAME_LENGTH,
  MAX_SHOPPING_ITEM_SOURCES,
  MAX_SHOPPING_PORTION_COUNT,
  MAX_SHOPPING_PORTION_LABEL_LENGTH,
} from "./bounds";
import { characterCount } from "../recipes/characterCount";

import type { ShoppingDraft } from "./aggregateIngredients";
import type { ShoppingItem, ShoppingItemWrite, ShoppingSource } from "./schemas";

/** The rows one call of `save_shopping_items` writes: merged open rows, then new ones. */
export type ShoppingListMerge = { upserts: ShoppingItemWrite[] };

const isOpen = (item: Pick<ShoppingItem, "checked_at">): boolean => item.checked_at === null;

/** The position after the last item on the list, so a new item goes at the end. 0 on an empty list. */
export const nextShoppingPosition = (existing: readonly Pick<ShoppingItem, "position">[]): number =>
  existing.reduce((next, item) => Math.max(next, item.position + 1), 0);

const mergedSources = (
  first: readonly ShoppingSource[],
  second: readonly ShoppingSource[],
): ShoppingSource[] =>
  [...first, ...second]
    .filter(
      (source, index, all) =>
        all.findIndex(({ recipeId }) => recipeId === source.recipeId) === index,
    )
    .slice(0, MAX_SHOPPING_ITEM_SOURCES);

// A label too long for the table, or a count too large, keeps the grams and drops the count, as a mixed
// set of portions does.
const portionOf = (
  label: string | null,
  count: number | null,
): Pick<ShoppingItemWrite, "portion_label" | "portion_count"> =>
  label === null ||
  count === null ||
  label.trim() === "" ||
  characterCount(label) > MAX_SHOPPING_PORTION_LABEL_LENGTH ||
  count <= 0 ||
  count > MAX_SHOPPING_PORTION_COUNT
    ? { portion_label: null, portion_count: null }
    : { portion_label: label, portion_count: count };

// The name of a food is at most what a food holds, but a long one is cut to what the list can hold.
const listName = (name: string): string =>
  Array.from(name).slice(0, MAX_SHOPPING_ITEM_NAME_LENGTH).join("");

const newRow = (draft: ShoppingDraft, position: number): ShoppingItemWrite => ({
  id: null,
  food_id: draft.foodId,
  name: listName(draft.name),
  grams: draft.grams,
  ...portionOf(draft.portionLabel, draft.portionCount),
  sources: mergedSources([], draft.sources),
  position,
  checked_at: null,
});

const mergedRow = (row: ShoppingItem, draft: ShoppingDraft): ShoppingItemWrite => {
  const isSamePortion = row.portion_label !== null && row.portion_label === draft.portionLabel;

  return {
    id: row.id,
    food_id: row.food_id,
    name: row.name,
    grams: (row.grams ?? 0) + draft.grams,
    ...(isSamePortion
      ? portionOf(row.portion_label, (row.portion_count ?? 0) + (draft.portionCount ?? 0))
      : { portion_label: null, portion_count: null }),
    sources: mergedSources(row.sources, draft.sources),
    position: row.position,
    checked_at: null,
  };
};

/**
 * What adding drafts does to the list, as the rows to write in one `save_shopping_items` call. A draft
 * merges into the open (unticked) row of the same food: the grams add up, the count adds up only when
 * both used the same portion, the recipes are joined and each is named once, and the row keeps its name
 * and place. A food whose rows are all ticked gets a new open row, so a ticked row is never changed. A
 * typed row has no food, so it never merges. New rows go at the end, in the drafts' order. A merge that
 * would take the grams over `MAX_SHOPPING_ITEM_GRAMS` starts a new row instead. Nothing is rounded.
 */
export function planListMerge(
  existing: readonly ShoppingItem[],
  drafts: readonly ShoppingDraft[],
): ShoppingListMerge {
  const merged: ShoppingItemWrite[] = [];
  const created: ShoppingItemWrite[] = [];
  let position = nextShoppingPosition(existing);

  for (const draft of drafts) {
    const openRow = existing.find(
      (row) =>
        isOpen(row) &&
        row.food_id === draft.foodId &&
        !merged.some(({ id }) => id === row.id) &&
        (row.grams ?? 0) + draft.grams <= MAX_SHOPPING_ITEM_GRAMS,
    );
    if (openRow === undefined) {
      created.push(newRow(draft, position));
      position += 1;
    } else {
      merged.push(mergedRow(openRow, draft));
    }
  }

  return { upserts: [...merged, ...created] };
}

/**
 * A row for an item typed by hand, at the end of the list, or null when the words are blank. The words
 * are trimmed and cut to what the list holds. It has no food, no amount and no recipe.
 */
export function planTypedItem(
  existing: readonly Pick<ShoppingItem, "position">[],
  typed: string,
): ShoppingItemWrite | null {
  const name = listName(typed.trim());

  return name === ""
    ? null
    : {
        id: null,
        food_id: null,
        name,
        grams: null,
        portion_label: null,
        portion_count: null,
        sources: [],
        position: nextShoppingPosition(existing),
        checked_at: null,
      };
}

/** The list as the screen draws it: what is still to buy, then what is ticked, each in list order. */
export function groupShoppingList<Item extends Pick<ShoppingItem, "position" | "checked_at">>(
  items: readonly Item[],
): { toBuy: Item[]; ticked: Item[] } {
  const ordered = [...items].sort((first, second) => first.position - second.position);

  return {
    toBuy: ordered.filter(isOpen),
    ticked: ordered.filter((item) => !isOpen(item)),
  };
}
