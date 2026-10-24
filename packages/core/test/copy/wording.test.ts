import { describe, expect, it } from "vitest";

import { capitaliseFirst, lowerFirst } from "../../src/copy/wording";

describe("the copy's wording helpers", () => {
  describe("lowerFirst", () => {
    it("should lower the first letter of a name read in the middle of a sentence", () => {
      expect(lowerFirst("Likely range")).toBe("likely range");
      expect(lowerFirst("Leg press")).toBe("leg press");
    });

    it("should keep a first word that is an acronym, which has a second capital in it", () => {
      expect(lowerFirst("EZ bar curl")).toBe("EZ bar curl");
    });

    it("should give an empty text back", () => {
      expect(lowerFirst("")).toBe("");
    });
  });

  describe("capitaliseFirst", () => {
    it("should raise the first letter and leave the rest as it is", () => {
      expect(capitaliseFirst("in 7 days")).toBe("In 7 days");
      expect(capitaliseFirst("Ki-Lo sets it")).toBe("Ki-Lo sets it");
    });

    it("should give an empty text back", () => {
      expect(capitaliseFirst("")).toBe("");
    });
  });
});
