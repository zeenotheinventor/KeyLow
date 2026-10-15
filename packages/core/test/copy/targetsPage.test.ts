import { describe, expect, it } from "vitest";

import { TARGETS_PAGE } from "../../src/copy";

describe("the Targets page's words", () => {
  it("should name the breadcrumb's first step and the way out of the form", () => {
    expect(TARGETS_PAGE).toEqual({ more: "More", cancel: "Cancel", saving: "Saving" });
  });
});
