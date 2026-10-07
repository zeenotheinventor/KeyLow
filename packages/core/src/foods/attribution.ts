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
} as const satisfies Readonly<Record<Exclude<FoodSource, "user">, DataSourceAttributionEntry>>;
