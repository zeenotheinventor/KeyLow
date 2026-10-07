const isPlainObject = (value: object): boolean => {
  const prototype: unknown = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
};

function refuseNul(text: string): void {
  if (text.includes("\0")) {
    throw new Error("Cannot write a NUL character, PostgreSQL cannot store it in text or jsonb");
  }
}

const quote = (text: string): string => {
  refuseNul(text);
  return `'${text.replaceAll("'", "''")}'`;
};

const refuseNonFinite = (value: number): void => {
  if (!Number.isFinite(value)) {
    throw new Error(`Cannot write ${value} as a SQL literal, a number must be finite`);
  }
};

/**
 * Stops JSON.stringify from quietly changing a value: it turns a non-finite number and an undefined
 * array element into null, so a bad value would be stored as a different one. Throwing instead lets
 * the writer stop. An undefined object property is dropped, which is the same as the key being absent.
 */
function refuseUnwritableJson(this: unknown, _key: string, value: unknown): unknown {
  if (typeof value === "number") {
    refuseNonFinite(value);
  } else if (typeof value === "string") {
    refuseNul(value);
  } else if (value === undefined && Array.isArray(this)) {
    throw new Error("Cannot write undefined inside an array as a SQL literal");
  }
  return value;
}

/**
 * Writes a value as a PostgreSQL literal. Text is single quoted with its quotes doubled, and a
 * backslash stays a backslash because `standard_conforming_strings` is on. The seed files set it
 * on themselves, and it is the default since PostgreSQL 9.1. A number is unquoted and `null` is
 * `null`. An object or an array becomes a jsonb literal: the JSON text is quoted the same way and cast
 * with `::jsonb`. Anything else has no SQL form here and is refused, as are a non-finite number, an
 * undefined array element and a NUL character, wherever they sit, so a bad value stops the writer.
 */
export function sqlLiteral(value: unknown): string {
  if (value === null) {
    return "null";
  }
  if (typeof value === "string") {
    return quote(value);
  }
  if (typeof value === "number") {
    refuseNonFinite(value);
    return String(value);
  }
  if (typeof value === "object" && (Array.isArray(value) || isPlainObject(value))) {
    return `${quote(JSON.stringify(value, refuseUnwritableJson))}::jsonb`;
  }
  const kind = typeof value === "object" ? value.constructor.name : typeof value;
  throw new Error(`Cannot write a ${kind} as a SQL literal`);
}
