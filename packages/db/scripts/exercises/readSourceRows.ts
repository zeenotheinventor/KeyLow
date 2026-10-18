import type { Json } from "../../src/types.gen";

// JSON.parse is typed `any`. Everything it returns is JSON, so the walk below never refuses a parsed
// file. It only lets the compiler see what the parse already guarantees.
function isJson(value: unknown): value is Json {
  if (value === null || ["string", "number", "boolean"].includes(typeof value)) {
    return true;
  }
  if (Array.isArray(value)) {
    return value.every(isJson);
  }
  return typeof value === "object" && Object.values(value).every(isJson);
}

/**
 * The entries of free-exercise-db's file as they are, keyed by id. They become `raw` in
 * `exercise_source_data`, so nothing is parsed out of them or dropped: "the source row as fetched".
 */
export function readSourceRows(json: string): Map<string, Json> {
  const parsed: unknown = JSON.parse(json);
  if (!Array.isArray(parsed)) {
    throw new Error("The source file is not a JSON list");
  }

  const rows = new Map<string, Json>();
  parsed.forEach((entry, index) => {
    if (!isJson(entry)) {
      throw new Error(`entry ${index} is not JSON`);
    }
    const id =
      typeof entry === "object" && entry !== null && !Array.isArray(entry)
        ? entry["id"]
        : undefined;
    if (typeof id !== "string" || id === "") {
      throw new Error(`entry ${index} has no id`);
    }
    if (rows.has(id)) {
      throw new Error("two entries have the same id");
    }
    rows.set(id, entry);
  });
  return rows;
}
