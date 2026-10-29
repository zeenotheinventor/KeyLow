import { uuidV5 } from "../uuidV5";

/**
 * The namespace of every portion id. It is fixed for good: changing it would give every portion a new id
 * and orphan the diary entries that link to the old ones (ADR 0003 Amendment 2).
 */
const PORTION_ID_NAMESPACE = "7c0f3a1e-5b2d-4e8a-9c46-2d1f8b6a4e90";

/**
 * The id of a portion, a version 5 UUID (RFC 9562) over the food code and the label. The same food code
 * and label always give the same id, so loading the file again updates rows in place, and a corrected
 * weight keeps its id. A new label is a new portion.
 */
export function portionId(foodCode: string, label: string): string {
  return uuidV5(PORTION_ID_NAMESPACE, `${foodCode}|${label}`);
}
