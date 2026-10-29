import { describeCount } from "./counts";
import { formatGroupedGrams } from "../format/groupedGrams";
import { formatScaledCount } from "../format/scaledCount";

/**
 * The shopping list's words, on the list page, in the dialog or screen that adds a recipe to it, and on
 * the recipe screens that lead to it. The servings stepper's words are `RECIPE_EDITOR.servings` and
 * `RECIPE_VIEW.fewerServings` and `.moreServings`, and the offline banner's title is `OFFLINE_BANNER.title`.
 */
export const SHOPPING_LIST = {
  title: "Shopping list",
  /** The button on a recipe that adds its ingredients to the list. */
  addToList: "Add to shopping list",
  /** Under Add to shopping list in the recipe view's More menu on the phone. */
  addToListCaption: "Puts its ingredients on your list",
  /** The list page's button that opens the recipe picker. */
  addRecipe: "Add a recipe",
  /** The picker's heading. */
  chooseRecipe: "Choose a recipe",
  toBuy: "To buy",
  ticked: "Ticked",
  clearTicked: "Clear ticked items",
  /** The field that adds an item typed by hand, as its label and its placeholder. */
  addItemPlaceholder: "Add an item",
  /** The button beside that field. */
  addItem: "Add",
  /** The heading over the staples the add dialog leaves out. */
  leftOut: "Store cupboard items left out",
  /** The box beside a staple that adds it all the same. */
  addAnyway: "Add anyway",
  remove: "Remove",
  /** Before the recipes an item came from, as `describeShoppingSources` writes them. */
  fromRecipes: "From",
  /** The toast once a recipe's ingredients are on the list. */
  added: "Added to your shopping list",
  /** When every ingredient of the recipe is a staple, so nothing is to buy unless one is added anyway. */
  onlyStaples: "Every ingredient is a store cupboard item.",
  /** The back link from the list to the recipe library. */
  backToRecipes: "Recipes",
  cancel: "Cancel",
  loadingLabel: "Loading your shopping list",
  addFailed: "Not added. Check your connection and try again.",
  changeFailed: "Not changed. Check your connection and try again.",
  offlineBody: "Your shopping list needs a connection to change.",
};

/** The list page when nothing is on it. */
export const SHOPPING_LIST_EMPTY = {
  title: "Your shopping list is empty",
  body: "Add the ingredients of a recipe, or type an item to buy.",
};

/** The recipe picker when there is no recipe to add. */
export const SHOPPING_LIST_NO_RECIPES = {
  title: "No recipes yet",
  body: "Add a recipe first, then its ingredients can go on your list.",
};

/** The question before the ticked items are cleared. */
export const SHOPPING_LIST_CLEAR_DIALOG = {
  title: "Clear ticked items?",
  body: "The items you ticked leave your list.",
  confirmLabel: "Clear ticked items",
  cancelLabel: "Keep them",
};

/** Under the left out heading: "1 store cupboard item left out", "3 store cupboard items left out". */
export const describeLeftOutCount = (count: number): string =>
  `${describeCount(count, "store cupboard item", "store cupboard items")} left out`;

/** The name of an item's remove button: "Remove Onions". */
export const describeRemoveItem = (name: string): string => `${SHOPPING_LIST.remove} ${name}`;

/** The recipes an item came from: "From Chilli", "From Chilli and Curry", "From Chilli, Curry and Pie". */
export const describeShoppingSources = (names: readonly string[]): string => {
  const last = names[names.length - 1] ?? "";
  const joined = names.length < 2 ? last : `${names.slice(0, -1).join(", ")} and ${last}`;

  return `${SHOPPING_LIST.fromRecipes} ${joined}`;
};

/** What `describeShoppingAmount` reads of an item. */
export type ShoppingAmount = {
  grams: number | null;
  portion_label: string | null;
  portion_count: number | null;
};

/**
 * How much of an item to buy: "450 g", "1 medium · 150 g" for one portion and "2.5 × 1 medium · 375 g" for
 * more, or the count alone when there are no grams. A count keeps two decimals and grams take a thousands
 * separator, as the recipe view writes them. Null for an item typed by hand, which has no amount.
 */
export const describeShoppingAmount = (item: ShoppingAmount): string | null => {
  const grams = item.grams === null ? null : `${formatGroupedGrams(item.grams)} g`;
  if (item.portion_label === null || item.portion_count === null) {
    return grams;
  }
  const count = formatScaledCount(item.portion_count);
  const portion = count === "1" ? item.portion_label : `${count} × ${item.portion_label}`;

  return grams === null ? portion : `${portion} · ${grams}`;
};

/** The name of a staple's Add anyway box, which says which staple: "Add Salt anyway". */
export const describeAddAnyway = (name: string): string => `Add ${name} anyway`;

/**
 * The line under an item: its amount, then the recipes it came from, such as "2 × 1 medium · 300 g · From
 * Chilli and Curry". Either part is left out when the item has none, and an item typed by hand has no
 * line at all (null).
 */
export const describeShoppingItemCaption = (
  item: ShoppingAmount & { sources: readonly { name: string }[] },
): string | null => {
  const parts = [
    describeShoppingAmount(item),
    item.sources.length === 0
      ? null
      : describeShoppingSources(item.sources.map(({ name }) => name)),
  ].filter((part) => part !== null);

  return parts.length === 0 ? null : parts.join(" · ");
};
