import { writeFileSync } from "node:fs";

const isFileExistsError = (error: unknown): boolean =>
  error instanceof Error && "code" in error && error.code === "EEXIST";

/**
 * Writes a generated migration to a path that must not hold a file yet. A migration that has been
 * applied is never regenerated, so an existing file is refused rather than overwritten.
 */
export function writeNewMigration(path: string, sql: string): void {
  try {
    // The "wx" flag fails when the file exists, so there is no gap between the check and the write.
    writeFileSync(path, sql, { flag: "wx" });
  } catch (error) {
    if (isFileExistsError(error)) {
      throw new Error(
        "An applied migration is never regenerated: write a new timestamped file instead",
        { cause: error },
      );
    }
    throw error;
  }
}
