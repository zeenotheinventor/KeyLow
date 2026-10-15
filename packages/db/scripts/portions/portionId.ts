import { createHash } from "node:crypto";

/**
 * The namespace of every portion id. It is fixed for good: changing it would give every portion a new id
 * and orphan the diary entries that link to the old ones (ADR 0003 Amendment 2).
 */
const PORTION_ID_NAMESPACE = "7c0f3a1e-5b2d-4e8a-9c46-2d1f8b6a4e90";

const bytesOfUuid = (uuid: string): Buffer => Buffer.from(uuid.replaceAll("-", ""), "hex");

/**
 * The id of a portion, a version 5 UUID (RFC 9562) over the food code and the label. The same food code
 * and label always give the same id, so loading the file again updates rows in place, and a corrected
 * weight keeps its id. A new label is a new portion.
 */
export function portionId(foodCode: string, label: string): string {
  const digest = createHash("sha1")
    .update(bytesOfUuid(PORTION_ID_NAMESPACE))
    .update(`${foodCode}|${label}`, "utf8")
    .digest();

  digest[6] = ((digest[6] ?? 0) & 0x0f) | 0x50;
  digest[8] = ((digest[8] ?? 0) & 0x3f) | 0x80;

  const hex = digest.subarray(0, 16).toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}
