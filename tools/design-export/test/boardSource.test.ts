import { describe, expect, it } from "vitest";

import { countFrames, readPageTitle } from "../src/boardSource.ts";

const source = `<!doctype html>
<html lang="en-GB">
<head><title>Find food, idle</title></head>
<body><x-dc>
<dc-import name="FoodSearchScreen" screen-state="idle" theme="dark" hint-size="390px,844px"></dc-import>
<dc-import name="FoodSearchScreen" screen-state="idle" theme="light" hint-size="390px,844px"></dc-import>
</x-dc></body></html>`;

describe("readPageTitle", () => {
  it("should read the title of the board page", () => {
    expect(readPageTitle(source)).toBe("Find food, idle");
  });

  it("should fail on a board with no title", () => {
    expect(() => readPageTitle("<html></html>")).toThrow(/title/);
  });
});

describe("countFrames", () => {
  it("should count the component imports, one per frame", () => {
    expect(countFrames(source)).toBe(2);
  });
});
