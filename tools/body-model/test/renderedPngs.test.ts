import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const rendersRoot = join(import.meta.dirname, "../renders");
const textChunkTypes = ["tEXt", "iTXt", "zTXt"];
const pngSignatureLength = 8;
const largestMusclePictureBytes = 400_000;

/** The chunk types of a PNG, in file order. Each chunk is a 4 byte length, a 4 byte type, the data and a 4 byte CRC. */
function chunkTypes(png: Buffer): string[] {
  const types: string[] = [];
  let offset = pngSignatureLength;
  while (offset < png.length) {
    types.push(png.toString("latin1", offset + 4, offset + 8));
    offset += 12 + png.readUInt32BE(offset);
  }
  return types;
}

function pngFiles(folderName: string): string[] {
  return readdirSync(join(rendersRoot, folderName)).filter((name) => name.endsWith(".png"));
}

describe.each([
  ["bases", 9],
  ["muscles", 9],
])("committed renders in renders/%s", (folderName, expectedCount) => {
  const files = pngFiles(folderName);

  it(`holds ${expectedCount} pictures`, () => {
    expect(files).toHaveLength(expectedCount);
  });

  it.each(files)("%s carries no text metadata and no local path", (name) => {
    const png = readFileSync(join(rendersRoot, folderName, name));

    expect(chunkTypes(png).filter((type) => textChunkTypes.includes(type))).toEqual([]);
    expect(png.includes("/Users/")).toBe(false);
  });
});

describe("committed renders in renders/muscles", () => {
  it.each(pngFiles("muscles"))("%s is under 400 KB", (name) => {
    const { size } = statSync(join(rendersRoot, "muscles", name));

    expect(size).toBeLessThan(largestMusclePictureBytes);
  });
});
