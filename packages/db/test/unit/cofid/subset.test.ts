import { describe, expect, it } from "vitest";

import { parseSubsetFile } from "../../../scripts/cofid/subset";

describe("parseSubsetFile", () => {
  it("should read one code per line", () => {
    expect(parseSubsetFile("11-1\n13-145\n")).toEqual(["11-1", "13-145"]);
  });

  it("should ignore blank lines and whitespace around a code", () => {
    expect(parseSubsetFile("\n  11-1  \n\n13-145\n\n")).toEqual(["11-1", "13-145"]);
  });

  it("should ignore comment lines and trailing comments", () => {
    expect(parseSubsetFile("# staples\n11-1 # bread\n#13-145\n")).toEqual(["11-1"]);
  });

  it("should read carriage return line feed endings", () => {
    expect(parseSubsetFile("11-1\r\n13-145\r\n")).toEqual(["11-1", "13-145"]);
  });

  it("should keep a code that is listed twice once", () => {
    expect(parseSubsetFile("11-1\n11-1\n")).toEqual(["11-1"]);
  });

  it("should refuse a line that is not a CoFID food code", () => {
    expect(() => parseSubsetFile("11-1\nbread\n")).toThrow('line 2: "bread"');
  });
});
