import { describe, expect, it } from "vitest";

import { rankedIdsOfReply } from "../../src/plans";

const offers = [
  { code: "r1", id: "recipe-one" },
  { code: "f1", id: "food-one" },
  { code: "f2", id: "food-two" },
];

describe("rankedIdsOfReply", () => {
  it("should turn the codes into ids, in the order the model gave them", () => {
    expect(rankedIdsOfReply({ ranking: ["f2", "r1"] }, offers)).toEqual(["food-two", "recipe-one"]);
  });

  it("should drop a code nobody offered and a repeat", () => {
    expect(rankedIdsOfReply({ ranking: ["x9", "f1", "f1", "r1"] }, offers)).toEqual([
      "food-one",
      "recipe-one",
    ]);
  });

  it("should accept an empty ranking", () => {
    expect(rankedIdsOfReply({ ranking: [] }, offers)).toEqual([]);
  });

  it("should read an answer that is not a ranking as no answer", () => {
    expect(rankedIdsOfReply({ ranking: "r1" }, offers)).toBeNull();
    expect(rankedIdsOfReply({ ranking: ["r1"], kcal: 500 }, offers)).toBeNull();
    expect(rankedIdsOfReply(null, offers)).toBeNull();
  });
});
