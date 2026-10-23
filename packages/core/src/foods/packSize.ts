import type { NutrientBasis } from "../schemas/food";

export type PackSize = {
  itemCount: number;
  itemAmount: number;
  unit: "g" | "ml";
};

// Heuristic, retune here. Below 5 g or ml is not a pack, and above 2000 g or ml (retail packs top out near
// 2 kg or 2 l) is a catering pack, so neither gets a portion.
const PACK_MIN = 5;
const PACK_MAX = 2000;

const MAX_ITEM_COUNT = 100;

type UnitReading = { unit: PackSize["unit"]; basis: NutrientBasis; factor: number };

const GRAMS: UnitReading = { unit: "g", basis: "per_100g", factor: 1 };
const KILOGRAMS: UnitReading = { unit: "g", basis: "per_100g", factor: 1000 };
const MILLILITRES: UnitReading = { unit: "ml", basis: "per_100ml", factor: 1 };
const CENTILITRES: UnitReading = { unit: "ml", basis: "per_100ml", factor: 10 };
const LITRES: UnitReading = { unit: "ml", basis: "per_100ml", factor: 1000 };

const UNITS: Readonly<Record<string, UnitReading>> = {
  g: GRAMS,
  gram: GRAMS,
  grams: GRAMS,
  kg: KILOGRAMS,
  kilogram: KILOGRAMS,
  kilograms: KILOGRAMS,
  ml: MILLILITRES,
  millilitre: MILLILITRES,
  millilitres: MILLILITRES,
  cl: CENTILITRES,
  l: LITRES,
  litre: LITRES,
  litres: LITRES,
  liter: LITRES,
  liters: LITRES,
};

// OFF quantities are free text with no length limit, so a very long one is never a pack size.
const MAX_QUANTITY_LENGTH = 64;

// The whole quantity must be one measure, or a count and one measure, with only the net wording or the
// estimated sign around it. Anything else (a drained weight, a second measure, an unknown unit) does not
// match, so it reads as null rather than a guess.
const NET_WORDING = "net(?:\\s+weight)?\\s*:?";
const UNIT_NAMES = Object.keys(UNITS).join("|");
const PACK_QUANTITY = new RegExp(
  `^(?:${NET_WORDING}\\s*)?(?:(\\d+)\\s*[x×]\\s*)?(\\d+(?:[.,]\\d+)?)\\s*(${UNIT_NAMES})(?:\\s*(?:${NET_WORDING}|[e℮]))?$`,
);

// A separator followed by exactly three digits is a thousands separator in much of Europe ("5,000 g" is
// 5 kg), so on g, ml and cl it is ambiguous with a decimal and is not read. On kg and l it is a decimal.
const THOUSANDS_SEPARATOR = /[.,]\d{3}$/;

/**
 * Reads an Open Food Facts quantity ("400 g", "6 x 25 g", "1,5 kg", "75 cl") into a count of items and the
 * size of each, in grams or millilitres. A multipack reads as its count and one item.
 * It returns null whenever it is unsure: a drained or second measure, a unit that does not match the
 * basis (ml on a per 100 g food), a unit it does not read (oz, lb, pieces), a count that is not a whole
 * number from 1 to 100, or an item outside PACK_MIN to PACK_MAX.
 */
export function readPackSize(quantity: string | undefined, basis: NutrientBasis): PackSize | null {
  if (quantity === undefined || quantity.length > MAX_QUANTITY_LENGTH) {
    return null;
  }
  const match = PACK_QUANTITY.exec(quantity.trim().toLowerCase());
  if (match === null) {
    return null;
  }
  const [, countText, amountText = "", unitText = ""] = match;
  const unit = UNITS[unitText];
  if (unit === undefined || unit.basis !== basis) {
    return null;
  }
  if (unit.factor < 1000 && THOUSANDS_SEPARATOR.test(amountText)) {
    return null;
  }
  const itemCount = countText === undefined ? 1 : Number(countText);
  // Rounded so a converted decimal such as 0.33 l reads as exactly 330 ml, not 330.00000000000006.
  const itemAmount = Math.round(Number(amountText.replace(",", ".")) * unit.factor * 1000) / 1000;
  if (
    itemCount < 1 ||
    itemCount > MAX_ITEM_COUNT ||
    itemAmount < PACK_MIN ||
    itemAmount > PACK_MAX
  ) {
    return null;
  }
  return { itemCount, itemAmount, unit: unit.unit };
}
