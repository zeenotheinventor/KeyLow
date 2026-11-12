import { toEdgeErrorKind } from "../errors";

/**
 * The code of a failure and nothing else: the edge error code, or the database's own code, or `failed`
 * for anything that is not a typed answer (no connection, a body that was not what the contract says).
 * A message can quote a health value, so it is never read.
 */
export function checkinFailureCode(failure: unknown): string {
  if (!(failure instanceof Error)) {
    return "failed";
  }

  const kind = toEdgeErrorKind(failure);
  const { cause } = failure;
  if (
    kind === "failed" &&
    typeof cause === "object" &&
    cause !== null &&
    "code" in cause &&
    typeof cause.code === "string" &&
    cause.code !== ""
  ) {
    return cause.code;
  }

  return kind;
}
