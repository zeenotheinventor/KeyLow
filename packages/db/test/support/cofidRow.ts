import { COFID_COLUMNS } from "../../scripts/cofid/mapRow";

/**
 * A normalised CSV row with every column the mapping reads, all blank, and the overrides on top.
 * Cell texts are literal CoFID cell values such as "Tr", "N", "(0.07)" or "76.7".
 */
export function cofidRow(overrides: Readonly<Record<string, string>> = {}): Record<string, string> {
  const blankRow: Record<string, string> = {
    food_code: "11-1",
    food_name: "Test food",
    description: "",
    food_group: "DG",
    previous_code: "",
    main_data_references: "",
    footnote: "",
  };
  for (const column of Object.values(COFID_COLUMNS)) {
    blankRow[column] = "";
  }
  return { ...blankRow, ...overrides };
}

export { COFID_COLUMNS };
