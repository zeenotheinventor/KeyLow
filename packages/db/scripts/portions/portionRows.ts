import { parseCsv } from "../cofid/csv";

/** One portion the file lists. The columns that only cite the source (fdc_id, fdc_description, source and weight_basis) are not read. */
export type PortionRow = {
  foodCode: string;
  label: string;
  grams: number | null;
  ml: number | null;
  isDefault: boolean;
  position: number;
};

const foodCodePattern = /^\d{2}-\d+$/;
const readColumns = ["food_code", "label", "grams", "ml", "is_default", "position"] as const;

type Cells = Record<(typeof readColumns)[number], string>;

function readCells(header: readonly string[], cells: readonly string[]): Cells {
  const cellOf = (column: string): string => {
    const index = header.indexOf(column);
    return index === -1 ? "" : (cells[index] ?? "").trim();
  };
  return {
    food_code: cellOf("food_code"),
    label: cellOf("label"),
    grams: cellOf("grams"),
    ml: cellOf("ml"),
    is_default: cellOf("is_default"),
    position: cellOf("position"),
  };
}

/** A blank cell is no weight. Anything else must be a number above zero. */
function readWeight(text: string, column: string, rowNumber: number): number | null {
  if (text === "") {
    return null;
  }
  const weight = Number(text);
  if (!Number.isFinite(weight) || weight <= 0) {
    throw new Error(
      `Row ${rowNumber}: ${column} must be a number above 0, not ${JSON.stringify(text)}`,
    );
  }
  return weight;
}

function readRow(cells: Cells, rowNumber: number): PortionRow {
  if (!foodCodePattern.test(cells.food_code)) {
    throw new Error(
      `Row ${rowNumber}: food_code is not a CoFID code: ${JSON.stringify(cells.food_code)}`,
    );
  }
  if (cells.label === "") {
    throw new Error(`Row ${rowNumber}: label is empty`);
  }
  const grams = readWeight(cells.grams, "grams", rowNumber);
  const ml = readWeight(cells.ml, "ml", rowNumber);
  if ((grams === null) === (ml === null)) {
    throw new Error(`Row ${rowNumber}: give exactly one of grams and ml`);
  }
  if (cells.is_default !== "true" && cells.is_default !== "false") {
    throw new Error(
      `Row ${rowNumber}: is_default must be true or false, not ${JSON.stringify(cells.is_default)}`,
    );
  }
  if (!/^\d+$/.test(cells.position)) {
    throw new Error(
      `Row ${rowNumber}: position must be a whole number, not ${JSON.stringify(cells.position)}`,
    );
  }
  return {
    foodCode: cells.food_code,
    label: cells.label,
    grams,
    ml,
    isDefault: cells.is_default === "true",
    position: Number(cells.position),
  };
}

/**
 * Reads the portions file by column name. A file the loader could not write correctly is refused here,
 * before anything is written: a row with both or neither of grams and ml, a food code and label listed
 * twice (the database cannot change one row twice in a statement) and a food with two defaults.
 */
export function parsePortionRows(text: string): PortionRow[] {
  const [header, ...body] = parseCsv(text);
  if (header === undefined) {
    throw new Error("The portions file is empty");
  }
  for (const column of readColumns) {
    if (!header.includes(column)) {
      throw new Error(`The portions file has no ${column} column`);
    }
  }

  const rows = body
    .filter((cells) => cells.some((cell) => cell.trim() !== ""))
    .map((cells, index) => readRow(readCells(header, cells), index + 2));

  const seen = new Set<string>();
  const foodsWithDefault = new Set<string>();
  for (const { foodCode, label, isDefault } of rows) {
    const key = `${foodCode}|${label}`;
    if (seen.has(key)) {
      throw new Error(`Food ${foodCode} lists the label ${JSON.stringify(label)} twice`);
    }
    seen.add(key);
    if (isDefault && foodsWithDefault.has(foodCode)) {
      throw new Error(`Food ${foodCode} has more than one default portion`);
    }
    if (isDefault) {
      foodsWithDefault.add(foodCode);
    }
  }
  return rows;
}
