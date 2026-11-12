import { describe, expect, it } from "vitest";

import { isConfirmAnswer } from "../../src/assistant";

describe("isConfirmAnswer", () => {
  it("should accept the exact words of the confirm button", () => {
    expect(isConfirmAnswer("Delete 2 entries", "Delete 2 entries")).toBe(true);
  });

  it("should ignore case and spaces around the words", () => {
    expect(isConfirmAnswer("  delete 2 ENTRIES \n", "Delete 2 entries")).toBe(true);
  });

  it("should refuse a typed yes", () => {
    expect(isConfirmAnswer("yes please", "Delete 2 entries")).toBe(false);
  });

  it("should refuse the cancel button's words", () => {
    expect(isConfirmAnswer("Keep them", "Delete 2 entries")).toBe(false);
  });

  it("should refuse a longer sentence that holds the confirm words", () => {
    expect(isConfirmAnswer("Please Delete 2 entries now", "Delete 2 entries")).toBe(false);
  });

  it("should refuse the words of a button with another count", () => {
    expect(isConfirmAnswer("Delete 3 entries", "Delete 2 entries")).toBe(false);
  });

  it("should refuse an empty message", () => {
    expect(isConfirmAnswer("", "Delete 2 entries")).toBe(false);
    expect(isConfirmAnswer("   ", "Delete 2 entries")).toBe(false);
  });

  it("should refuse when there is no stored label", () => {
    expect(isConfirmAnswer("Delete 2 entries", null)).toBe(false);
  });

  it("should refuse when there are no words", () => {
    expect(isConfirmAnswer(null, "Delete 2 entries")).toBe(false);
  });

  it("should refuse when there is neither", () => {
    expect(isConfirmAnswer(null, null)).toBe(false);
  });

  it("should refuse an empty label, which an empty message would otherwise match", () => {
    expect(isConfirmAnswer("", "")).toBe(false);
  });
});
