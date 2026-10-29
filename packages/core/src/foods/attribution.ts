import type { FoodSource } from "../schemas/food";

type DataSourceAttributionEntry = {
  readonly name: string;
  readonly licence: string;
  readonly text: string;
  readonly url: string;
};

/** Credit lines the apps must show wherever data from these sources is displayed. */
export const DATA_SOURCE_ATTRIBUTION = {
  off: {
    name: "Open Food Facts",
    licence: "Open Database License (ODbL) v1.0",
    text: "Data from Open Food Facts, available under the Open Database Licence.",
    url: "https://world.openfoodfacts.org",
  },
  cofid: {
    name: "McCance and Widdowson's The Composition of Foods Integrated Dataset (CoFID)",
    licence: "Open Government Licence v3.0",
    text: "Contains public sector information licensed under the Open Government Licence v3.0. Source: McCance and Widdowson's The Composition of Foods Integrated Dataset, Public Health England and the Office for Health Improvement and Disparities.",
    url: "https://www.gov.uk/government/publications/composition-of-foods-integrated-dataset-cofid",
  },
  usda: {
    name: "USDA FoodData Central",
    licence: "CC0 1.0 Universal (public domain)",
    text: "Data from USDA FoodData Central, U.S. Department of Agriculture, Agricultural Research Service, released into the public domain under CC0 1.0. Natural portions and some foods come from its SR Legacy release (April 2018).",
    url: "https://fdc.nal.usda.gov",
  },
} as const satisfies Readonly<Record<Exclude<FoodSource, "user">, DataSourceAttributionEntry>>;
