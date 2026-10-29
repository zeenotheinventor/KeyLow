import { createHash } from "node:crypto";

const bytesOfUuid = (uuid: string): Buffer => Buffer.from(uuid.replaceAll("-", ""), "hex");

/** A version 5 UUID (RFC 9562): the SHA-1 of the namespace bytes and the name, so the same inputs always give the same id. */
export function uuidV5(namespace: string, name: string): string {
  const digest = createHash("sha1").update(bytesOfUuid(namespace)).update(name, "utf8").digest();

  digest[6] = ((digest[6] ?? 0) & 0x0f) | 0x50;
  digest[8] = ((digest[8] ?? 0) & 0x3f) | 0x80;

  const hex = digest.subarray(0, 16).toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}
