// A plan item's `nutrients` and `snapshot` are JSON columns. What core builds leaves a figure it does not know as
// `undefined`, which JSON has no value for, so a plan written by the harness drops those keys, as the stored column does.
export type Json = string | number | boolean | null | Json[] | { [key: string]: Json };

function jsonOf(value: unknown): Json {
  if (value === null || typeof value === "string" || typeof value === "number") {
    return value;
  }
  if (typeof value === "boolean") {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map(jsonOf);
  }
  if (typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).flatMap(([key, member]) =>
        member === undefined ? [] : [[key, jsonOf(member)]],
      ),
    );
  }
  throw new RangeError("A plan column holds a value that is not JSON");
}

/** The object as the column stores it. Throws a `RangeError` that names no value for anything JSON cannot hold. */
export function jsonObjectOf(value: object): Record<string, Json> {
  const json = jsonOf(value);
  if (typeof json === "object" && json !== null && !Array.isArray(json)) {
    return json;
  }
  throw new RangeError("A plan column must be an object");
}
