// Category lists and energy captured from the Open Food Facts product API on 2026-10-23
// (https://world.openfoodfacts.org/api/v2/product/<barcode>.json), so a renamed tag fails here.
// The tests never go to the network.
export const realProducts = {
  // Organic Unsweetened Apple Sauce
  appleSauce: {
    barcode: "0060383691219",
    kcal: 45,
    categoriesTags: [
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
  },
  // Banana chips
  bananaChips: {
    barcode: "4802222046141",
    kcal: 417,
    categoriesTags: [
      "en:plant-based-foods-and-beverages",
      "en:plant-based-foods",
      "en:fruit-based-foods-and-beverages",
      "en:fruits-and-vegetables-based-foods",
      "en:snacks",
      "en:fruit-based-foods",
      "en:salty-snacks",
      "en:appetizers",
      "en:chips-and-fries",
      "en:dried-products",
      "en:crisps",
      "en:dried-plant-based-foods",
      "en:dried-fruits",
      "en:banana-crisps",
    ],
  },
  // CORA PULPE, an orange soft drink
  orangeSoda: {
    barcode: "3257981359215",
    kcal: 42,
    categoriesTags: [
      "en:beverages-and-beverages-preparations",
      "en:plant-based-foods-and-beverages",
      "en:beverages",
      "en:plant-based-foods",
      "en:fruit-based-foods-and-beverages",
      "en:fruits-and-vegetables-based-foods",
      "en:fruit-based-foods",
      "en:fruits",
      "en:non-alcoholic-beverages",
      "en:plant-based-beverages",
      "en:carbonated-drinks",
      "en:fruit-based-beverages",
      "en:soft-drinks",
      "en:citrus",
      "en:sodas",
      "en:fruit-sodas",
      "en:oranges",
      "en:orange-soft-drinks",
      "en:orange-pulp",
      "en:sweetened-beverages",
    ],
  },
  // Oeuf de Caille, a quail egg
  quailEgg: {
    barcode: "3267911000186",
    kcal: 171,
    categoriesTags: [
      "en:eggs-and-their-products",
      "en:farming-products",
      "en:eggs",
      "en:quail-eggs",
    ],
  },
  // 2 Scotch Eggs
  scotchEgg: {
    barcode: "00198707",
    kcal: 247,
    categoriesTags: [
      "en:eggs-and-their-products",
      "en:farming-products",
      "en:eggs",
      "en:scotch-eggs",
    ],
  },
  // Oeuf dur, a hard-boiled egg
  hardBoiledEgg: {
    barcode: "5400208002007",
    kcal: 133,
    categoriesTags: [
      "en:eggs-and-their-products",
      "en:farming-products",
      "en:eggs",
      "en:hard-boiled-egg",
      "en:boiled-eggs",
    ],
  },
  // Kiwi vert
  freshKiwi: {
    barcode: "0461968838034",
    kcal: 42.09,
    categoriesTags: [
      "en:plant-based-foods-and-beverages",
      "en:plant-based-foods",
      "en:fruit-based-foods-and-beverages",
      "en:fruits-and-vegetables-based-foods",
      "en:fruit-based-foods",
      "en:fruits",
      "en:kiwifruits",
    ],
  },
  // Ail blanc 3 tetes, whose energy OFF has as 0
  garlicBulbs: {
    barcode: "3256223378434",
    kcal: 0,
    categoriesTags: [
      "en:plant-based-foods-and-beverages",
      "en:plant-based-foods",
      "en:fruits-and-vegetables-based-foods",
      "en:vegetable-based-foods-and-beverages",
      "en:condiments",
      "en:vegetables-based-foods",
      "en:culinary-plants",
      "en:garlics-and-their-products",
      "en:garlics",
      "en:allium-neapolitanum",
      "en:groceries",
    ],
  },
  // Chopped Garlic, frozen
  frozenChoppedGarlic: {
    barcode: "5054269794380",
    kcal: 106,
    categoriesTags: [
      "en:plant-based-foods-and-beverages",
      "en:plant-based-foods",
      "en:frozen-foods",
      "en:fruits-and-vegetables-based-foods",
      "en:vegetable-based-foods-and-beverages",
      "en:condiments",
      "en:vegetables-based-foods",
      "en:culinary-plants",
      "en:frozen-plant-based-foods",
      "en:garlics-and-their-products",
      "en:frozen-vegetables",
      "en:garlics",
      "en:chopped-garlics",
      "en:frozen-chopped-garlic",
    ],
  },
  // 5 Fairtrade Bananas
  bagOfBananas: {
    barcode: "01768558",
    kcal: 85,
    categoriesTags: [
      "en:plant-based-foods-and-beverages",
      "en:plant-based-foods",
      "en:fruit-based-foods-and-beverages",
      "en:fruits-and-vegetables-based-foods",
      "en:fruit-based-foods",
      "en:fruits",
      "en:tropical-fruits",
      "en:bananas",
    ],
  },
};

// 10 oeufs plein air Label Rouge, a real box of hen eggs: barcode 3282070015314, 140 kcal per 100 g,
// captured from the Open Food Facts product API on 2026-10-23.
export const henEggTags = [
  "en:eggs-and-their-products",
  "en:farming-products",
  "en:eggs",
  "en:chicken-eggs",
  "en:free-range-chicken-eggs",
];
