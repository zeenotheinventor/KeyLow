import type { FoodSource } from "../schemas/food";

export type FoodSearchGroupKey = "yours" | "common" | "branded";

export type FoodSearchGroup<Row> = {
  key: FoodSearchGroupKey;
  /** The first rows of the group, in rank order, up to its limit. */
  visibleRows: Row[];
  /** How many more rows the group holds, for "See N more". Zero when every row is visible. */
  hiddenCount: number;
};

export type FoodSearchGroupLimits = Readonly<Record<FoodSearchGroupKey, number>>;

/** The limits the search sheet draws: three of Your foods, five of each shared group. */
export const FOOD_SEARCH_GROUP_LIMITS: FoodSearchGroupLimits = {
  yours: 3,
  common: 5,
  branded: 5,
};

const groupKeyBySource: Readonly<Record<FoodSource, FoodSearchGroupKey>> = {
  user: "yours",
  cofid: "common",
  usda: "common",
  off: "branded",
};

const groupOrder: readonly FoodSearchGroupKey[] = ["yours", "common", "branded"];

const isValidLimit = (limit: number): boolean => Number.isInteger(limit) && limit >= 0;

/**
 * Splits the rows `useFoodSearch` returns into Your foods (`user`), Common foods (`cofid` and `usda`) and
 * Branded foods (`off`, the Open Food Facts products already saved locally). The rank order is
 * kept inside each group, a group with no rows is left out, and each group carries the rows to
 * show and the count behind "See N more".
 *
 * This is a client-side slice of what the RPC returned. `search_foods` returns at most 25 rows by
 * default (50 at most), so the hidden count only covers those rows. The true number of matching
 * foods is not available.
 *
 * `limit` is one number for every group, or a limit per group. Throws a `RangeError` for a limit
 * that is not a whole number of at least 0.
 */
export const groupFoodSearchResults = <Row extends { source: FoodSource }>(
  local: readonly Row[],
  { limit }: { limit: number | FoodSearchGroupLimits },
): FoodSearchGroup<Row>[] => {
  const limitFor = (key: FoodSearchGroupKey): number => {
    const groupLimit = typeof limit === "number" ? limit : limit[key];
    if (!isValidLimit(groupLimit)) {
      throw new RangeError(`Limit must be a whole number of at least 0, received ${groupLimit}`);
    }
    return groupLimit;
  };

  return groupOrder.flatMap((key) => {
    const rows = local.filter((row) => groupKeyBySource[row.source] === key);
    if (rows.length === 0) {
      return [];
    }
    const visibleRows = rows.slice(0, limitFor(key));
    return [{ key, visibleRows, hiddenCount: rows.length - visibleRows.length }];
  });
};

/** How many rows the mobile search asks for: the most `search_foods` returns. */
export const FOOD_SEARCH_FETCH_LIMIT = 50;

/** How many rows the mobile search shows at first, and how many more each scroll to the end reveals. */
export const FOOD_SEARCH_REVEAL_BATCH = 15;

/**
 * Limits the rows of groups that hold all of their rows to one running budget in display order: Your
 * foods first, then Common foods, then Branded foods. Only the last group that gets any budget is cut,
 * a group with no budget is left out, and `hiddenCount` is corrected to what each group holds back. So
 * revealing more only ever appends rows at the bottom. Throws a `RangeError` for a count that is not a
 * whole number of at least 1.
 */
export const revealFoodSearchGroups = <Row>(
  groups: readonly FoodSearchGroup<Row>[],
  visibleCount: number,
): FoodSearchGroup<Row>[] => {
  if (!Number.isInteger(visibleCount) || visibleCount < 1) {
    throw new RangeError(`Count must be a whole number of at least 1, received ${visibleCount}`);
  }

  let budget = visibleCount;
  return groups.flatMap((group) => {
    if (budget === 0) {
      return [];
    }
    const visibleRows = group.visibleRows.slice(0, budget);
    budget -= visibleRows.length;
    return [
      { key: group.key, visibleRows, hiddenCount: group.visibleRows.length - visibleRows.length },
    ];
  });
};
