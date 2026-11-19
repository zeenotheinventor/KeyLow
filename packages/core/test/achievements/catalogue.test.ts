import { describe, expect, it } from "vitest";

import { ACHIEVEMENTS, ACHIEVEMENT_CATEGORIES } from "../../src/achievements";
import { ACHIEVEMENT_COPY } from "../../src/copy/achievements";

// Typed out from the tier column of docs/design/achievements/catalogue.md, not read from the catalogue.
const TIER_OF_NUMBER: readonly (readonly [number, string])[] = [
  [1, "bronze"],
  [2, "bronze"],
  [3, "bronze"],
  [4, "bronze"],
  [5, "bronze"],
  [6, "bronze"],
  [7, "bronze"],
  [8, "bronze"],
  [9, "bronze"],
  [10, "bronze"],
  [11, "bronze"],
  [12, "bronze"],
  [13, "bronze"],
  [14, "bronze"],
  [15, "silver"],
  [16, "silver"],
  [17, "gold"],
  [18, "gold"],
  [19, "platinum"],
  [20, "platinum"],
  [21, "silver"],
  [22, "gold"],
  [23, "platinum"],
  [24, "bronze"],
  [25, "bronze"],
  [26, "silver"],
  [27, "silver"],
  [28, "gold"],
  [29, "gold"],
  [30, "gold"],
  [31, "platinum"],
  [32, "platinum"],
  [33, "platinum"],
  [34, "bronze"],
  [35, "bronze"],
  [36, "silver"],
  [37, "silver"],
  [38, "bronze"],
  [39, "silver"],
  [40, "gold"],
  [41, "platinum"],
  [42, "bronze"],
  [43, "silver"],
  [44, "gold"],
  [45, "platinum"],
  [46, "silver"],
  [47, "gold"],
  [48, "silver"],
  [49, "silver"],
  [50, "bronze"],
  [51, "silver"],
  [52, "gold"],
  [53, "platinum"],
  [54, "silver"],
  [55, "bronze"],
  [56, "bronze"],
  [57, "silver"],
  [58, "gold"],
  [59, "bronze"],
  [60, "silver"],
  [61, "gold"],
  [62, "bronze"],
  [63, "silver"],
  [64, "bronze"],
  [65, "silver"],
  [66, "gold"],
  [67, "bronze"],
  [68, "silver"],
  [69, "bronze"],
  [70, "bronze"],
  [71, "bronze"],
  [72, "silver"],
  [73, "silver"],
  [74, "gold"],
  [75, "platinum"],
  [76, "platinum"],
  [77, "bronze"],
  [78, "gold"],
  [79, "platinum"],
  [80, "silver"],
  [81, "gold"],
  [82, "platinum"],
  [83, "silver"],
  [84, "bronze"],
  [85, "silver"],
  [86, "silver"],
  [87, "gold"],
  [88, "platinum"],
  [89, "platinum"],
  [90, "silver"],
  [91, "silver"],
  [92, "bronze"],
  [93, "silver"],
  [94, "gold"],
  [95, "platinum"],
  [96, "silver"],
  [97, "silver"],
  [98, "gold"],
  [99, "bronze"],
  [100, "bronze"],
  [101, "silver"],
  [102, "gold"],
  [103, "platinum"],
  [104, "bronze"],
  [105, "silver"],
  [106, "gold"],
  [107, "silver"],
  [108, "silver"],
  [109, "gold"],
  [110, "bronze"],
  [111, "bronze"],
  [112, "silver"],
  [113, "gold"],
  [114, "gold"],
  [115, "bronze"],
  [116, "bronze"],
  [117, "bronze"],
  [118, "silver"],
  [119, "bronze"],
  [120, "bronze"],
  [121, "silver"],
  [122, "bronze"],
  [123, "bronze"],
  [124, "bronze"],
  [125, "bronze"],
  [126, "gold"],
  [127, "bronze"],
  [128, "gold"],
  [129, "gold"],
  [130, "platinum"],
];

const idsOf = (category: string) =>
  ACHIEVEMENTS.filter((entry) => entry.category === category).map((entry) => entry.id);

describe("the catalogue", () => {
  it("holds 130 achievements numbered 1 to 130 in order", () => {
    expect(ACHIEVEMENTS).toHaveLength(130);
    expect(ACHIEVEMENTS.map((entry) => entry.number)).toEqual(
      Array.from({ length: 130 }, (_, index) => index + 1),
    );
  });

  it("has 13 categories with the counts of the spec headings", () => {
    expect(ACHIEVEMENT_CATEGORIES).toHaveLength(13);
    expect(ACHIEVEMENT_CATEGORIES.map((category) => idsOf(category).length)).toEqual([
      12, 11, 14, 12, 9, 10, 15, 8, 8, 10, 6, 7, 8,
    ]);
  });

  it("keeps each category's achievements together, in category order", () => {
    const categoryAtEachNumber = ACHIEVEMENTS.map((entry) => entry.category);
    expect(categoryAtEachNumber).toEqual(
      ACHIEVEMENT_CATEGORIES.flatMap((category) =>
        categoryAtEachNumber.filter((c) => c === category),
      ),
    );
  });

  it("has unique ids and unique names", () => {
    expect(new Set(ACHIEVEMENTS.map((entry) => entry.id)).size).toBe(130);
    expect(new Set(Object.values(ACHIEVEMENT_COPY).map((words) => words.name)).size).toBe(130);
  });

  it("makes each id the kebab case of the name", () => {
    for (const { id } of ACHIEVEMENTS) {
      const kebab = ACHIEVEMENT_COPY[id].name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "");
      expect(id).toBe(kebab);
    }
  });

  it("pins stable ids that are never renumbered", () => {
    const byNumber = (number: number) => ACHIEVEMENTS[number - 1]?.id;
    expect(byNumber(1)).toBe("first-bite");
    expect(byNumber(9)).toBe("hello-ki-lo");
    expect(byNumber(24)).toBe("hat-trick");
    expect(byNumber(107)).toBe("body-reader");
    expect(byNumber(109)).toBe("composition-collector");
    expect(byNumber(130)).toBe("completionist");
  });

  it("hides exactly numbers 123 to 128, and leaves Collector and Completionist visible", () => {
    const hiddenNumbers = ACHIEVEMENTS.filter((entry) => entry.hidden).map((entry) => entry.number);
    expect(hiddenNumbers).toEqual([123, 124, 125, 126, 127, 128]);
  });

  it("gives every achievement the tier of the spec", () => {
    expect(TIER_OF_NUMBER).toHaveLength(130);
    expect(ACHIEVEMENTS.map((entry) => [entry.number, entry.tier])).toEqual(TIER_OF_NUMBER);
  });

  it("gives the tiers of the spec to a few named achievements", () => {
    const tierOf = (id: string) => ACHIEVEMENTS.find((entry) => entry.id === id)?.tier;
    expect(tierOf("hat-trick")).toBe("bronze");
    expect(tierOf("centurion")).toBe("silver");
    expect(tierOf("diarist")).toBe("gold");
    expect(tierOf("encyclopaedia")).toBe("platinum");
    expect(tierOf("leap-of-faith")).toBe("gold");
  });

  it("pins the thresholds of a few named achievements", () => {
    const targetOf = (id: string) => ACHIEVEMENTS.find((entry) => entry.id === id)?.target;
    expect(targetOf("jotter")).toBe(10);
    expect(targetOf("grand-log")).toBe(1000);
    expect(targetOf("full-body")).toBe(6);
    expect(targetOf("graduate")).toBe(12);
    expect(targetOf("signed-up")).toBe(4);
    expect(targetOf("megalifter")).toBe(1000000);
    expect(targetOf("collector")).toBe(50);
    expect(targetOf("completionist")).toBe(100);
  });

  it("gives every achievement a positive whole threshold", () => {
    for (const { target } of ACHIEVEMENTS) {
      expect(Number.isInteger(target) && target > 0).toBe(true);
    }
  });
});
