/**
 * Real Open Food Facts product fields, captured from
 * `https://world.openfoodfacts.org/api/v2/product/<barcode>.json` on 2026-10-23. Only the fields the pack
 * portion reads are kept, and `categories_tags` keeps the `en:` tags only (OFF stores every ancestor
 * category in the list, so the lists here are as long as the real ones).
 */
export type CapturedProduct = {
  code: string;
  product_name: string;
  quantity: string;
  packaging_tags: string[];
  categories_tags: string[];
  serving_size?: string;
  serving_quantity?: number;
};

// 5000157024671, fetched 2026-10-23. A tin of beans: the packaging says can, and the serving is half of it.
export const tinOfBeans: CapturedProduct = {
  code: "5000157024671",
  product_name: "Beanz in a rich tomato sauce",
  quantity: "415g",
  packaging_tags: ["en:metal", "en:can", "en:canned", "en:food-can"],
  categories_tags: [
    "en:plant-based-foods-and-beverages",
    "en:plant-based-foods",
    "en:legumes-and-their-products",
    "en:fruits-and-vegetables-based-foods",
    "en:legumes",
    "en:vegetable-based-foods-and-beverages",
    "en:canned-foods",
    "en:vegetables-based-foods",
    "en:canned-plant-based-foods",
    "en:prepared-vegetables",
    "en:baked-beans-in-tomato-sauce",
    "en:canned-legumes",
    "en:canned-common-beans",
  ],
  serving_size: "0.5 can (207 g)",
  serving_quantity: 207,
};

// 5000159461122, fetched 2026-10-23. A chocolate bar whose serving is the whole bar. The packaging
// tags name a material and a wrapper (not a noun in the table), so the bar comes from the categories.
export const chocolateBar: CapturedProduct = {
  code: "5000159461122",
  product_name: "Snickers",
  quantity: "50 G",
  packaging_tags: ["en:plastic", "en:wrapper"],
  categories_tags: [
    "en:snacks",
    "en:sweet-snacks",
    "en:cocoa-and-its-products",
    "en:confectioneries",
    "en:chocolate-candies",
    "en:bars",
    "en:candy-chocolate-bars",
    "en:candy-chocolate-bars-filled-with-caramel-and-peanuts",
  ],
  serving_size: "50 g",
  serving_quantity: 50,
};

// 5000159407236, fetched 2026-10-23. A Mars bar whose packaging says bag: the food is a bar whatever it is
// wrapped in. Its serving is 100 g, not the bar.
export const marsBarInABag: CapturedProduct = {
  code: "5000159407236",
  product_name: "Mars",
  quantity: "51 g",
  packaging_tags: ["en:bag"],
  categories_tags: [
    "en:snacks",
    "en:sweet-snacks",
    "en:biscuits-and-cakes",
    "en:cocoa-and-its-products",
    "en:confectioneries",
    "en:chocolate-candies",
    "en:bars",
    "en:candy-chocolate-bars",
    "en:caramel-chocolate-bars",
    "en:coated-chocolate-bar-without-biscuit",
  ],
  serving_size: "100 g",
  serving_quantity: 100,
};

// 5000159459228, fetched 2026-10-23. A Twix whose packaging says plastic and bag, with a 100 g serving.
export const twixInABag: CapturedProduct = {
  code: "5000159459228",
  product_name: "Twix Twin",
  quantity: "50g",
  packaging_tags: ["en:plastic", "en:bag"],
  categories_tags: [
    "en:snacks",
    "en:sweet-snacks",
    "en:cocoa-and-its-products",
    "en:confectioneries",
    "en:chocolate-candies",
    "en:bars",
    "en:candy-chocolate-bars",
  ],
  serving_size: "100 g",
  serving_quantity: 100,
};

// 5000159461139, fetched 2026-10-23. A box of 32 bars, written "32 * 50 g", which is not read as a
// multipack (only "x" and the multiplication sign are).
export const boxOfChocolateBars: CapturedProduct = {
  code: "5000159461139",
  product_name: "32 Barres Snickers Cacahuètes",
  quantity: "1,6 kg (32 * 50 g e)",
  packaging_tags: ["en:plastic", "en:bag", "en:box", "en:cardboard"],
  categories_tags: [
    "en:snacks",
    "en:sweet-snacks",
    "en:cocoa-and-its-products",
    "en:confectioneries",
    "en:chocolate-candies",
    "en:bars",
    "en:candy-chocolate-bars",
    "en:candy-chocolate-bars-filled-with-caramel-and-peanuts",
  ],
};

// 0060383691219, fetched 2026-10-23. A multipack of six 100 ml pots. The packaging tags name no
// shape and the categories name no pack, so the generic noun is used.
export const multipackOfApplesauce: CapturedProduct = {
  code: "0060383691219",
  product_name: "Organic Unsweetened Apple Sauce",
  quantity: "6 x 100 ml",
  packaging_tags: ["en:plastic", "en:paper", "en:pp-5-polypropylene"],
  categories_tags: [
    "en:plant-based-foods-and-beverages",
    "en:plant-based-foods",
    "en:desserts",
    "en:fruit-based-foods-and-beverages",
    "en:fruits-and-vegetables-based-foods",
    "en:snacks",
    "en:fruit-based-foods",
    "en:fruits",
    "en:apples",
    "en:compotes",
    "en:apple-compotes",
    "en:apple-pulp",
    "en:applesauces",
  ],
  serving_size: "1 container (100 mL)",
  serving_quantity: 100,
};

// 3228857000166, fetched 2026-10-23. A loaf of sliced bread: the packaging says envelope (not a noun
// in the table), so the loaf comes from the sliced breads category.
export const loafOfSlicedBread: CapturedProduct = {
  code: "3228857000166",
  product_name: "100% mie complet",
  quantity: "500 g",
  packaging_tags: ["en:envelope"],
  categories_tags: [
    "en:plant-based-foods-and-beverages",
    "en:plant-based-foods",
    "en:frozen-foods",
    "en:cereals-and-potatoes",
    "en:cereals-and-their-products",
    "en:breads",
    "en:frozen-breads",
    "en:sliced-breads",
    "en:wholemeal-breads",
    "en:sliced-breads-without-crust",
    "en:wholemeal-sliced-breads",
  ],
  serving_size: "25 g (1 tranche)",
  serving_quantity: 25,
};

// 3033490004743, fetched 2026-10-23. A yogurt pot: the packaging and the categories both say pot.
export const yogurtPot: CapturedProduct = {
  code: "3033490004743",
  product_name: "Skyr",
  quantity: "140 g",
  packaging_tags: [
    "en:pot",
    "en:fresh",
    "fr:opercule-et-pot-plastique-a-jeter",
    "fr:pensez-au-tri",
    "fr:point-vert",
    "fr:pot-en-plastique",
  ],
  categories_tags: [
    "en:dairies",
    "en:fermented-foods",
    "en:desserts",
    "en:fermented-milk-products",
    "en:cheeses",
    "en:dairy-desserts",
    "en:fermented-dairy-desserts",
    "en:yogurts",
    "en:fromages-blancs-petit-suisses-and-skyr",
    "en:plain-fermented-dairy-desserts",
    "en:skyrs",
    "en:plain-skyrs",
  ],
  serving_size: "1 portion (140 g)",
  serving_quantity: 140,
};

// 5000112637922, fetched 2026-10-23. A can of cola: the packaging says can and drink can.
export const canOfCola: CapturedProduct = {
  code: "5000112637922",
  product_name: "Coca Cola",
  quantity: "330 ml",
  packaging_tags: ["en:metal", "en:recyclable-metals", "en:aluminium", "en:can", "en:drink-can"],
  categories_tags: [
    "en:beverages-and-beverages-preparations",
    "en:beverages",
    "en:non-alcoholic-beverages",
    "en:carbonated-drinks",
    "en:soft-drinks",
    "en:sodas",
    "en:colas",
    "en:sweetened-beverages",
  ],
  serving_size: "330 g",
  serving_quantity: 330,
};

// 5449000000996, fetched 2026-10-23. A cola whose packaging is recorded as unknown: a drink is never
// named from its categories, so it is a pack.
export const colaWithUnknownPackaging: CapturedProduct = {
  code: "5449000000996",
  product_name: "Coca-Cola Original",
  quantity: "330 ml",
  packaging_tags: ["en:unknown-packaging"],
  categories_tags: [
    "en:beverages-and-beverages-preparations",
    "en:beverages",
    "en:non-alcoholic-beverages",
    "en:carbonated-drinks",
    "en:soft-drinks",
    "en:sodas",
    "en:colas",
  ],
  serving_size: "1 portion (330 ml)",
  serving_quantity: 330,
};

// 5449000054227, fetched 2026-10-23. A one litre bottle: bottle and bottle or vial are one noun.
export const bottleOfCola: CapturedProduct = {
  code: "5449000054227",
  product_name: "Coca-Cola Original Taste",
  quantity: "1 L",
  packaging_tags: [
    "en:plastic",
    "en:pe-7-polyethylene",
    "en:bottle-or-vial",
    "en:hdpe-2-high-density-polyethylene",
    "en:pet-1-polyethylene-terephthalate",
    "en:bottle",
    "fr:bouchon-en-plastique",
    "it:bottiglia-pet",
    "pt:pet-bottle",
    "pt:pp-lid",
    "pt:stuck",
  ],
  categories_tags: [
    "en:beverages-and-beverages-preparations",
    "en:beverages",
    "en:non-alcoholic-beverages",
    "en:carbonated-drinks",
    "en:soft-drinks",
    "en:sodas",
    "en:colas",
    "en:sweetened-beverages",
  ],
  serving_size: "250 ml",
  serving_quantity: 250,
};

/** The product with its serving taken away, so the pack is the only thing left to offer. */
export function withoutServing(product: CapturedProduct): CapturedProduct {
  return {
    code: product.code,
    product_name: product.product_name,
    quantity: product.quantity,
    packaging_tags: product.packaging_tags,
    categories_tags: product.categories_tags,
  };
}
