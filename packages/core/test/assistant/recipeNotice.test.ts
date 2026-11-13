import { describe, expect, it } from "vitest";

import { assistantRecipeNoticeSchema, recipeNoticeOfToolError } from "../../src/assistant";

describe("assistantRecipeNoticeSchema", () => {
  it.each(["timed_out", "refused"])("should read the code %s", (code) => {
    expect(assistantRecipeNoticeSchema.parse({ code })).toEqual({ code });
  });

  it("should strip a field a later version adds, so an app that is behind still draws the notice", () => {
    expect(assistantRecipeNoticeSchema.parse({ code: "refused", later: 1 })).toEqual({
      code: "refused",
    });
  });

  it("should refuse a code it does not know", () => {
    expect(assistantRecipeNoticeSchema.safeParse({ code: "over_budget" }).success).toBe(false);
  });
});

describe("recipeNoticeOfToolError", () => {
  it.each(["timed_out", "generation_timeout"])(
    "should word the tool error %s as a timeout",
    (error) => {
      expect(recipeNoticeOfToolError(error)).toEqual({ code: "timed_out" });
    },
  );

  it("should word a refused generation as a refusal", () => {
    expect(recipeNoticeOfToolError("generation_refused")).toEqual({ code: "refused" });
  });

  it.each([
    "generation_failed",
    "recipe_mentions_avoided",
    "could_not_match_foods",
    "nothing_matched",
    "could_not_reach_target",
    "recipe_not_found",
  ])("should leave %s to the model's own words", (error) => {
    expect(recipeNoticeOfToolError(error)).toBeNull();
  });
});
