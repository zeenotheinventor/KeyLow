/** The identity columns of the normalised CSV, in order. They are the first seven columns of every sheet. */
export const IDENTITY_COLUMNS = [
  "food_code",
  "food_name",
  "description",
  "food_group",
  "previous_code",
  "main_data_references",
  "footnote",
] as const;

export type SheetDefinition = {
  /** The sheet's name in the workbook. */
  workbookName: string;
  /** Prefix of its columns in the normalised CSV. */
  slug: string;
};

// Sheet 1.1 holds notes and the list of tables, so it carries no data. Sheet names are as published,
// brackets and spacing included.
export const COFID_SHEETS: readonly SheetDefinition[] = [
  { workbookName: "1.2 Factors", slug: "factors" },
  { workbookName: "1.3 Proximates", slug: "proximates" },
  { workbookName: "1.4 Inorganics", slug: "inorganics" },
  { workbookName: "1.5 Vitamins", slug: "vitamins" },
  { workbookName: "1.6 Vitamin Fractions", slug: "vitamin_fractions" },
  { workbookName: "1.7 (SFA per 100gFA)", slug: "sfa_fa" },
  { workbookName: "1.8 (SFA per 100gFood)", slug: "sfa_food" },
  { workbookName: "1.9 (MUFA per 100FA)", slug: "mufa_fa" },
  { workbookName: "1.10 (MUFA per 100gFood)", slug: "mufa_food" },
  { workbookName: "1.11 (PUFA per 100gFA)", slug: "pufa_fa" },
  { workbookName: "1.12 (PUFA per 100gFood)", slug: "pufa_food" },
  { workbookName: "1.13 Phytosterols", slug: "phytosterols" },
  { workbookName: "1.14 Organic Acids", slug: "organic_acids" },
];

/** The sheet whose name, group and references identify a food. The other sheets repeat them. */
export const IDENTITY_SHEET_SLUG = "proximates";

/** The sheet of factors (edible proportion, specific gravity and so on). These are not nutrient amounts. */
export const FACTORS_SHEET_SLUG = "factors";

/**
 * The CSV column for a header: the sheet's slug, then the header lower-cased with every run of
 * characters other than letters and digits collapsed to one underscore. The micro sign becomes u.
 */
export function columnName(sheetSlug: string, header: string): string {
  const snakeCase = header
    .replaceAll("µ", "u")
    .toLowerCase()
    .replaceAll(/[^a-z0-9]+/g, "_")
    .replaceAll(/^_+|_+$/g, "");
  return `${sheetSlug}_${snakeCase}`;
}
