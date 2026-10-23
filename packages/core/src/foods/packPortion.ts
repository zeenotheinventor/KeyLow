import { readPackSize } from "./packSize";

import type { OffPortionInput } from "./offRules";
import type { NutrientBasis } from "../schemas/food";

const GENERIC_NOUN = "pack";
// One item of a multipack, when nothing says what the item is: "pack" would read as the whole multipack.
const GENERIC_MULTIPACK_NOUN = "item";

// OFF packaging tags that name a shape, and the noun for each. The tags are in the OFF packaging taxonomy
// https://static.openfoodfacts.org/data/taxonomies/packaging.json (the shapes also sit in
// packaging_shapes.json beside it), checked on 2026-10-23. The tags are third-party text, so this is a
// Map and an odd tag such as "constructor" is not a noun. Not listed because the taxonomy has no such
// tag: tub, carton, sachet, pouch.
const PACKAGING_NOUNS: ReadonlyMap<string, string> = new Map([
  ["en:can", "can"],
  ["en:food-can", "can"], // child of en:can
  ["en:drink-can", "can"], // child of en:can
  ["en:bottle", "bottle"],
  ["en:jar", "jar"],
  ["en:pot", "pot"],
  ["en:tray", "tray"],
  ["en:tube", "tube"],
  ["en:box", "box"],
  ["en:bag", "bag"],
]);

// On a multipack the packaging tags often describe the outer pack (a box or a bag of cans, a tray of pots),
// not the item that is offered, so these nouns are ignored there.
const OUTER_PACK_NOUNS: ReadonlySet<string> = new Set(["box", "bag", "tray"]);
const MULTIPACK_ITEM_NOUNS: ReadonlyMap<string, string> = new Map(
  [...PACKAGING_NOUNS].filter(([, noun]) => !OUTER_PACK_NOUNS.has(noun)),
);

// OFF categories whose meaning is the shape of the food itself, whatever it is wrapped in (a bar in a bag
// is still a bar), so they are checked before the packaging. From
// https://static.openfoodfacts.org/data/taxonomies/categories.json, checked on 2026-10-23. OFF stores
// every ancestor of a category in `categories_tags`, so each row also matches all of its descendants,
// and only categories whose descendants keep the shape are listed:
//   en:bars and en:chocolate-bars: cereal, nut, protein, candy, chocolate and frozen bars (en:ice-cream-bars is not under them).
//   en:sliced-breads: sliced loaves. en:breads is not listed, its 156 descendants include rolls, naans, crumbs and croutons.
const FOOD_SHAPE_NOUNS: ReadonlyMap<string, string> = new Map([
  ["en:bars", "bar"],
  ["en:chocolate-bars", "bar"],
  ["en:sliced-breads", "loaf"],
]);

// Categories whose meaning is the pack, used only when the packaging names nothing. Same taxonomy, same
// descendant rule:
//   en:yogurts: yogurts in pots. Its drinking yogurts are drinks, see NEVER_NAMED_FROM_A_CATEGORY.
//   en:canned-foods: canned legumes, fish, vegetables and meals. Its tomato pastes, strained tomatoes and
//   semi-preserved foods, and the legume pickles under en:canned-legumes, are not cans.
const PACK_CATEGORY_NOUNS: ReadonlyMap<string, string> = new Map([
  ["en:yogurts", "pot"],
  ["en:canned-foods", "can"],
]);

// A product in any of these is never named from a pack category: a bottle cannot be told from a can for a
// drink (every drink is under en:beverages, drinking yogurts included), and the rest come in tubes,
// cartons, jars and tins although they sit under en:canned-foods (en:pickles through en:legume-pickles).
const NEVER_NAMED_FROM_A_CATEGORY: ReadonlySet<string> = new Set([
  "en:beverages",
  "en:tomato-pastes",
  "en:strained-tomatoes",
  "en:semi-preserved-foods",
  "en:pickles",
]);
// The one noun the tags agree on, or undefined when they name none or name two different ones.
function singleNoun(
  tags: readonly string[],
  nouns: ReadonlyMap<string, string>,
): string | undefined {
  const found = new Set<string>();
  for (const tag of tags) {
    const noun = nouns.get(tag);
    if (noun !== undefined) {
      found.add(noun);
    }
  }
  const [noun] = found;
  return found.size === 1 ? noun : undefined;
}

function nameThePack(
  packagingTags: readonly string[],
  categoriesTags: readonly string[],
  isMultipack: boolean,
): string {
  const foodShape = singleNoun(categoriesTags, FOOD_SHAPE_NOUNS);
  if (foodShape !== undefined) {
    return foodShape;
  }
  const fromPackaging = singleNoun(
    packagingTags,
    isMultipack ? MULTIPACK_ITEM_NOUNS : PACKAGING_NOUNS,
  );
  if (fromPackaging !== undefined) {
    return fromPackaging;
  }
  const fromCategory = categoriesTags.some((tag) => NEVER_NAMED_FROM_A_CATEGORY.has(tag))
    ? undefined
    : singleNoun(categoriesTags, PACK_CATEGORY_NOUNS);
  return fromCategory ?? (isMultipack ? GENERIC_MULTIPACK_NOUN : GENERIC_NOUN);
}

/**
 * The pack as a portion ("1 can", "1 bar", "1 pack", "1 item" for a multipack), or null when the quantity is not a pack size
 * `readPackSize` reads. A multipack gives one item, never the whole multipack. The label is the words
 * only, with no digit but the leading 1, because the picker shows the size beside it and
 * `parseServingLabel` must not read a density from it. It is never the default.
 */
export function packPortion(input: {
  quantity: string | undefined;
  basis: NutrientBasis;
  packagingTags: readonly string[] | undefined;
  categoriesTags: readonly string[] | undefined;
}): OffPortionInput | null {
  const size = readPackSize(input.quantity, input.basis);
  if (size === null) {
    return null;
  }
  return {
    label: `1 ${nameThePack(input.packagingTags ?? [], input.categoriesTags ?? [], size.itemCount > 1)}`,
    grams: size.unit === "g" ? size.itemAmount : null,
    ml: size.unit === "ml" ? size.itemAmount : null,
    isDefault: false,
  };
}
