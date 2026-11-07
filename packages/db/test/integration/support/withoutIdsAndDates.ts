const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const dateOrTimestampPattern = /^\d{4}-\d{2}-\d{2}(T[\d:.]+(Z|[+-]\d{2}(:?\d{2})?)?)?$/;

/**
 * The JSON of a value with every id, date and timestamp left out. A test that asserts a stored row holds
 * no figure (`not.toContain("550")`) must not read the digits of a random uuid or a clock reading, which
 * hold any short run of digits now and then. The columns that hold them cannot hold a figure, so nothing
 * a real figure could be stored in is dropped.
 */
export function withoutIdsAndDates(value: unknown): string {
  return JSON.stringify(value, (_key, each: unknown) =>
    typeof each === "string" && (uuidPattern.test(each) || dateOrTimestampPattern.test(each))
      ? undefined
      : each,
  );
}
