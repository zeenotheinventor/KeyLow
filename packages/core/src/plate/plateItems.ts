import { parsePlateQuantity } from "./plateValues";

import type { PlateFoodUnit, PlateItem } from "./types";

// Two portions are the same when they share an id. A portion replaced since a Recent entry was logged has no
// id, so it is told by its label and size, and may merge with a row that has an id.
function isSamePortion(
  first: Extract<PlateFoodUnit, { kind: "portion" }>,
  second: Extract<PlateFoodUnit, { kind: "portion" }>,
): boolean {
  if (first.portionId !== null && second.portionId !== null) {
    return first.portionId === second.portionId;
  }

  return (
    first.label === second.label &&
    first.size.amount === second.size.amount &&
    first.size.unit === second.size.unit
  );
}

function isSameFoodUnit(first: PlateFoodUnit, second: PlateFoodUnit): boolean {
  if (first.kind === "portion" && second.kind === "portion") {
    return isSamePortion(first, second);
  }

  return first.kind === second.kind;
}

// The same dish: the same food or recipe, counted in the same unit.
function isSameDish(first: PlateItem, second: PlateItem): boolean {
  if (first.kind === "food" && second.kind === "food") {
    return first.foodId === second.foodId && isSameFoodUnit(first.unit, second.unit);
  }
  if (first.kind === "recipe" && second.kind === "recipe") {
    return first.recipe.id === second.recipe.id && first.unit === second.unit;
  }

  return false;
}

// Sums of two typed amounts, without the stray digits floating point adds ("0.30000000000000004").
const sumOf = (first: number, second: number): number => Math.round((first + second) * 1e6) / 1e6;

/**
 * Puts an item on the plate. The same food or recipe in the same unit adds its quantity to the row that is
 * already there, in place ("1 pot" and "1 pot" are "2 pots"), and a row whose amount is not valid takes the
 * added quantity as it is. Anything else is a new row at the end.
 */
export function addToPlate(items: readonly PlateItem[], added: PlateItem): PlateItem[] {
  const existing = items.find((item) => isSameDish(item, added));
  if (existing === undefined) {
    return [...items, added];
  }
  const quantity = sumOf(existing.quantity, added.quantity);

  return items.map((item) =>
    item === existing ? { ...item, quantity, quantityText: String(quantity) } : item,
  );
}

/** Sets what a row's amount field holds. The row reads the text as the picker does, and is not valid while the text is not an amount. */
export const setPlateQuantity = (
  items: readonly PlateItem[],
  key: string,
  text: string,
): PlateItem[] =>
  items.map((item) =>
    item.key === key ? { ...item, quantityText: text, quantity: parsePlateQuantity(text) } : item,
  );

/** Swaps a row for another item in place, keeping the row's key. It never merges: a unit change through the picker is a change of that row. */
export const replacePlateItem = (
  items: readonly PlateItem[],
  key: string,
  replacement: PlateItem,
): PlateItem[] => items.map((item) => (item.key === key ? { ...replacement, key } : item));

export const removePlateItem = (items: readonly PlateItem[], key: string): PlateItem[] =>
  items.filter((item) => item.key !== key);

/** Empties the plate and hands back what was on it, so Undo can `restorePlate` it. */
export const clearPlate = (
  items: readonly PlateItem[],
): { items: PlateItem[]; cleared: readonly PlateItem[] } => ({ items: [], cleared: items });

/** Puts a cleared plate back, in its order. A food added since is kept after it, and merged if it is the same dish. */
export const restorePlate = (
  items: readonly PlateItem[],
  cleared: readonly PlateItem[],
): PlateItem[] => items.reduce<PlateItem[]>((plate, item) => addToPlate(plate, item), [...cleared]);
