import { parseCsv } from "./csv";
import { mapRow, requireCofidColumns } from "./mapRow";

import type { MappedCofidFood } from "./mapRow";

/**
 * Where an import writes to. The Supabase implementation is in supabaseImportStore.ts. Anything else
 * that needs the same mapped foods, such as a generator of an idempotent SQL seed file, is another
 * implementation of this type.
 */
export type ImportStore = {
  /** Inserts the `import_runs` row and returns its id. */
  startRun(run: { label: string; fileSha256: string }): Promise<string>;
  /** Upserts the foods on `(source, source_ref)` and their source data, which point at the run. */
  writeBatch(runId: string, batch: readonly MappedCofidFood[]): Promise<void>;
  /** Sets `finished_at` and `row_count`. A run with `finished_at` null is therefore an incomplete one. */
  finishRun(runId: string, result: { rowCount: number }): Promise<void>;
  /** Sets `row_count` only, for a run that failed part way. `finished_at` stays null. */
  recordRowCount(runId: string, result: { rowCount: number }): Promise<void>;
};

export type ImportOptions = {
  csv: string;
  fileSha256: string;
  label: string;
  /** Food codes to import. Every other food in the CSV is left alone. */
  subsetCodes?: readonly string[];
  dryRun: boolean;
  batchSize: number;
  log: (message: string) => void;
};

export type ImportSummary = {
  /** Undefined for a dry run, which writes no run. */
  runId: string | undefined;
  /** The foods written, or for a dry run the foods that would be. */
  rowCount: number;
  skippedDuplicateCodes: string[];
};

const MAX_REPORTED_FAILURES = 10;

const describeError = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

function readFoods(csv: string): MappedCofidFood[] {
  const [header, ...records] = parseCsv(csv);
  if (header === undefined) {
    throw new Error("The CSV is empty");
  }
  requireCofidColumns(header);

  const failures: string[] = [];
  const foods: MappedCofidFood[] = [];
  records.forEach((record, index) => {
    // Row 1 is the header.
    const rowNumber = index + 2;
    if (record.length !== header.length) {
      failures.push(
        `CSV row ${rowNumber} has ${record.length} fields for ${header.length} columns`,
      );
      return;
    }
    try {
      foods.push(
        mapRow(Object.fromEntries(header.map((name, column) => [name, record[column] ?? ""]))),
      );
    } catch (error) {
      failures.push(describeError(error));
    }
  });

  if (failures.length > 0) {
    const reported = failures.slice(0, MAX_REPORTED_FAILURES).map((failure) => `  ${failure}`);
    const omitted = failures.length - reported.length;
    const more = omitted > 0 ? `\n  and ${omitted} more` : "";
    throw new Error(
      `${failures.length} of ${records.length} rows could not be mapped, so nothing was written:\n${reported.join("\n")}${more}`,
    );
  }
  return foods;
}

/** Splits off every food whose code appears more than once, because one code cannot name two foods. */
function separateDuplicates(foods: readonly MappedCofidFood[]): {
  unique: MappedCofidFood[];
  duplicateCodes: string[];
} {
  const counts = new Map<string, number>();
  for (const { sourceRef } of foods) {
    counts.set(sourceRef, (counts.get(sourceRef) ?? 0) + 1);
  }
  return {
    unique: foods.filter(({ sourceRef }) => counts.get(sourceRef) === 1),
    duplicateCodes: [...counts].filter(([, count]) => count > 1).map(([code]) => code),
  };
}

function selectSubset(
  foods: readonly MappedCofidFood[],
  subsetCodes: readonly string[] | undefined,
  duplicateCodes: readonly string[],
): MappedCofidFood[] {
  if (subsetCodes === undefined) {
    return [...foods];
  }

  const ambiguous = subsetCodes.filter((code) => duplicateCodes.includes(code));
  if (ambiguous.length > 0) {
    throw new Error(`These codes name more than one food in the CSV: ${ambiguous.join(", ")}`);
  }
  const available = new Set(foods.map(({ sourceRef }) => sourceRef));
  const unknown = subsetCodes.filter((code) => !available.has(code));
  if (unknown.length > 0) {
    throw new Error(`These codes are not in the CSV: ${unknown.join(", ")}`);
  }
  const wanted = new Set(subsetCodes);
  return foods.filter(({ sourceRef }) => wanted.has(sourceRef));
}

/**
 * Imports the normalised CoFID CSV. Every row is mapped and checked before anything is written. The run
 * is recorded first and finished last. When a batch fails, the run keeps the number of foods written but
 * is not finished, so `finished_at` null marks an incomplete run. The failure is then thrown. A dry run maps and counts but writes nothing.
 */
export async function importCofid(
  store: ImportStore,
  options: ImportOptions,
): Promise<ImportSummary> {
  const { csv, fileSha256, label, subsetCodes, dryRun, batchSize, log } = options;
  if (label.trim() === "") {
    throw new Error("The label must not be empty");
  }

  const { unique, duplicateCodes } = separateDuplicates(readFoods(csv));
  if (duplicateCodes.length > 0) {
    log(`Skipped the foods with a code that appears more than once: ${duplicateCodes.join(", ")}`);
  }
  const foods = selectSubset(unique, subsetCodes, duplicateCodes);

  if (dryRun) {
    log(`Dry run: ${foods.length} foods mapped and checked, nothing written`);
    return { runId: undefined, rowCount: foods.length, skippedDuplicateCodes: duplicateCodes };
  }

  const runId = await store.startRun({ label, fileSha256 });
  let written = 0;
  let failure: Error | undefined;

  try {
    for (let start = 0; start < foods.length; start += batchSize) {
      const batch = foods.slice(start, start + batchSize);
      await store.writeBatch(runId, batch);
      written += batch.length;
      log(`Imported ${written} of ${foods.length} foods`);
    }
  } catch (error) {
    failure = error instanceof Error ? error : new Error(String(error));
    log(`Failed after ${written} of ${foods.length} foods: ${describeError(error)}`);
  }

  if (failure === undefined) {
    await store.finishRun(runId, { rowCount: written });
    return { runId, rowCount: written, skippedDuplicateCodes: duplicateCodes };
  }
  // The run keeps what was written and stays unfinished. A failure to record that must not hide the real failure.
  await store.recordRowCount(runId, { rowCount: written }).catch(() => undefined);
  throw failure;
}
