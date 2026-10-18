import { readFileSync } from "node:fs";

import { parseChecksumFile, sha256Hex } from "../cofid/checksum";

/** Reads a pinned file and refuses it when its sha256 is not the one its `.sha256` file records. */
export function readPinnedFile(path: string): Buffer {
  const bytes = readFileSync(path);
  const actual = sha256Hex(bytes);
  const expected = parseChecksumFile(readFileSync(`${path}.sha256`, "utf8"));
  if (actual !== expected) {
    throw new Error(`${path} has sha256 ${actual}, but its .sha256 file says ${expected}`);
  }
  return bytes;
}
