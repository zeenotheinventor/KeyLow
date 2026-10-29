import { parseCsv } from "../cofid/csv";

export type CuratedPortion = { label: string; sequenceNumber: string };

export type CuratedFood = {
  fdcId: string;
  /** The Ki-Lo name, in CoFID's shape and UK words. */
  name: string;
  /** The SR `food_portion` row chosen as the natural portion, or null for none. */
  portion: CuratedPortion | null;
  wave: string;
  srDescription: string;
  gapNote: string;
};

const COLUMNS = [
  "fdc_id",
  "name",
  "portion_label",
  "portion_seq_num",
  "wave",
  "sr_description",
  "gap_note",
] as const;

/** The US wording of SR descriptions that Ki-Lo names must not keep. Matched whole, ignoring case. */
const US_TERMS = [
  "broilers",
  "fryers",
  "all classes",
  "retail parts",
  "from whole bird",
  "domesticated",
  "ground",
  "broiled",
  "crumbles",
  "cooked,",
  "with added solution",
] as const;

const escapeForRegExp = (text: string): string => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// A term is matched as whole words: no letter before it, and none after it when it ends in a letter.
const US_TERM_PATTERNS = US_TERMS.map((term) => ({
  term,
  pattern: new RegExp(
    `(?<![a-z])${escapeForRegExp(term)}${/[a-z]$/.test(term) ? "(?![a-z])" : ""}`,
    "i",
  ),
}));

const collapseWhitespace = (text: string): string => text.replace(/\s+/g, " ");

function checkName(fdcId: string, name: string): void {
  const found = US_TERM_PATTERNS.find(({ pattern }) => pattern.test(collapseWhitespace(name)));
  if (found !== undefined) {
    throw new Error(
      `FDC ${fdcId}: the name ${JSON.stringify(name)} still holds the US term ${JSON.stringify(found.term)}`,
    );
  }
}

/** Reads the curated list. A row with a US word in its name, a half-given portion or a repeated id fails. */
export function parseCuratedList(csv: string): CuratedFood[] {
  const [header = [], ...rows] = parseCsv(csv);
  const missing = COLUMNS.filter((column) => !header.includes(column));
  if (missing.length > 0) {
    throw new Error(`The curated list has no column ${missing.join(", ")}`);
  }

  const seenIds = new Set<string>();
  const fdcIdByName = new Map<string, string>();
  return rows.map((row, rowIndex) => {
    const cell = (column: (typeof COLUMNS)[number]): string =>
      (row[header.indexOf(column)] ?? "").trim();

    const fdcId = cell("fdc_id");
    if (fdcId === "") {
      throw new Error(`Row ${rowIndex + 1} of the curated list has no fdc_id`);
    }
    if (seenIds.has(fdcId)) {
      throw new Error(`FDC ${fdcId} is in the curated list twice`);
    }
    seenIds.add(fdcId);

    const name = cell("name");
    if (name === "") {
      throw new Error(`FDC ${fdcId} has no name`);
    }
    checkName(fdcId, name);
    const nameKey = collapseWhitespace(name).toLowerCase();
    const firstFdcId = fdcIdByName.get(nameKey);
    if (firstFdcId !== undefined) {
      throw new Error(
        `FDC ${fdcId} has the same name as FDC ${firstFdcId}: ${JSON.stringify(name)}`,
      );
    }
    fdcIdByName.set(nameKey, fdcId);

    const label = cell("portion_label");
    const sequenceNumber = cell("portion_seq_num");
    if ((label === "") !== (sequenceNumber === "")) {
      throw new Error(`FDC ${fdcId}: give both portion_label and portion_seq_num, or neither`);
    }

    return {
      fdcId,
      name,
      portion: label === "" ? null : { label, sequenceNumber },
      wave: cell("wave"),
      srDescription: cell("sr_description"),
      gapNote: cell("gap_note"),
    };
  });
}
