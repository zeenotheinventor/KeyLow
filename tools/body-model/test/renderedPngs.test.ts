import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const rendersFolder = join(import.meta.dirname, "../renders/bases");
const textChunkTypes = ["tEXt", "iTXt", "zTXt"];
const pngSignatureLength = 8;

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

describe("committed renders", () => {
  const files = readdirSync(rendersFolder).filter((name) => name.endsWith(".png"));

  it("holds the eight renders and the contact sheet", () => {
    expect(files).toHaveLength(9);
  });

  it.each(files)("%s carries no text metadata and no local path", (name) => {
    const png = readFileSync(join(rendersFolder, name));

    expect(chunkTypes(png).filter((type) => textChunkTypes.includes(type))).toEqual([]);
    expect(png.includes("/Users/")).toBe(false);
  });
});
