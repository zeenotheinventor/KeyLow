import { describe, expect, it } from "vitest";

import { ENTRY_NOT_FOUND, ENTRY_SCREEN } from "../../src/copy";

describe("entry screen wording", () => {
  it("should pin the buttons under the form and the title it waits under", () => {
    expect(ENTRY_SCREEN).toEqual({ title: "Entry", saveAction: "Save", deleteAction: "Delete" });
  });

  it("should say the entry is not there in its own words", () => {
    expect(ENTRY_NOT_FOUND).toEqual({
      title: "Entry not found",
      body: "It may have been deleted.",
    });
  });
});
