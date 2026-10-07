import { createHash } from "node:crypto";

export const sha256Hex = (content: string | Uint8Array): string =>
  createHash("sha256").update(content).digest("hex");

/** One line in the format `shasum -a 256 -c` reads. */
export const formatChecksumFile = (sha256: string, fileName: string): string =>
  `${sha256}  ${fileName}\n`;

export function parseChecksumFile(text: string): string {
  const [sha256] = text.trim().split(/\s+/);
  if (sha256 === undefined || !/^[0-9a-f]{64}$/.test(sha256)) {
    throw new Error("The checksum file does not start with a sha256 hash");
  }
  return sha256;
}
