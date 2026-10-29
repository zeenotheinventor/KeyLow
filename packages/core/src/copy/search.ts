export type SearchGroupKey = "recipes" | "yours" | "common" | "branded" | "live";

type SearchGroupHeading = {
  title: string;
  /** The plain source name that sits beside the title. */
  caption: string;
  /** The accessible name of the group's list. */
  label: string;
};

/** The groups of the search sheet, in the fixed order the sheet draws them. */
export const SEARCH_GROUP_HEADINGS: Readonly<Record<SearchGroupKey, SearchGroupHeading>> = {
  recipes: {
    title: "Your recipes",
    caption: "Per serving",
    label: "Your recipes, values per serving",
  },
  yours: { title: "Your foods", caption: "Yours", label: "Your foods" },
  common: { title: "Common foods", caption: "UK CoFID and USDA", label: "Common foods" },
  branded: {
    title: "Branded foods",
    caption: "Open Food Facts",
    label: "Branded foods from Open Food Facts",
  },
  live: {
    title: "From Open Food Facts",
    caption: "Live results",
    label: "Open Food Facts results",
  },
};

export const describeSeeMore = (hiddenCount: number): string => `See ${hiddenCount} more`;

/** The name of the control that empties a search field once it holds text. */
export const SEARCH_CLEAR_LABEL = "Clear search";

export const SEARCH_IDLE = {
  title: "Search for a food",
  body: "Type at least 2 characters to search your foods, UK CoFID, USDA and Open Food Facts.",
  /** The quiet line the web page shows in place of the title and body. */
  hint: "Type at least 2 characters to search",
};

export const SEARCH_STATUS = {
  searchingYourFoods: "Searching your foods",
  searchingOpenFoodFacts: "Searching Open Food Facts",
  addingProduct: "Adding to your foods",
  loadingMoreOfYourFoods: "Loading more of your foods",
};

export const SEARCH_EMPTY = {
  title: "No foods found",
  body: "Try other words, or create the food yourself.",
  action: "Create a food",
};

export const YOUR_FOODS_EMPTY = {
  title: "No foods yet",
  body: "Foods you create or copy appear here.",
  action: "Create a food",
};

/** The web page's failed local search. The mobile sheet words it differently, see `SEARCH_FAILED_MOBILE`. */
export const SEARCH_FAILED_WEB = {
  title: "Search failed",
  body: "Your foods could not be searched. Check your connection and try again.",
};

export const SEARCH_FAILED_MOBILE = {
  title: "Your foods could not be searched",
  body: "Check your connection and try again.",
};

/** The title of the notice shown when Open Food Facts is rate limited. The body is `describeRateLimit`. */
export const OPEN_FOOD_FACTS_BUSY = "Open Food Facts is busy";

export const OPEN_FOOD_FACTS_SEARCH_FAILED = {
  title: "Open Food Facts could not be searched right now",
  body: "Your own results still work. Change your search to try again.",
};

export const ADD_PRODUCT_FAILED = {
  title: "This product could not be added",
  body: "Check your connection and try again.",
};

/** The title of the failed add notice when Open Food Facts no longer has the product. It has no body. */
export const ADD_PRODUCT_NOT_FOUND = "Open Food Facts no longer has this product.";
