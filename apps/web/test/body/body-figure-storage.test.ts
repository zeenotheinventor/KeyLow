import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { readBodyFigure, writeBodyFigure } from "@/lib/bodyFigure/bodyFigureStorage";

describe("the stored body figure", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("reading", () => {
    it("should be Male, not yet chosen, when nothing is stored", () => {
      expect(readBodyFigure()).toStrictEqual({ figure: "male", hasChosen: false });
    });

    it("should be the figure stored, chosen", () => {
      window.localStorage.setItem("bodyMap.figure", "female");

      expect(readBodyFigure()).toStrictEqual({ figure: "female", hasChosen: true });
    });

    it("should be Male, not yet chosen, when what is stored is not a figure", () => {
      window.localStorage.setItem("bodyMap.figure", "robot");

      expect(readBodyFigure()).toStrictEqual({ figure: "male", hasChosen: false });
    });

    it("should be Male, chosen, when storage cannot be read, so a question that cannot be saved is never asked", () => {
      vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
        throw new DOMException("blocked", "SecurityError");
      });

      expect(readBodyFigure()).toStrictEqual({ figure: "male", hasChosen: true });
    });
  });

  describe("writing", () => {
    it("should store the figure under bodyMap.figure", () => {
      writeBodyFigure("female");

      expect(window.localStorage.getItem("bodyMap.figure")).toBe("female");
    });

    it("should not raise when the figure cannot be saved", () => {
      vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
        throw new DOMException("full", "QuotaExceededError");
      });

      expect(() => {
        writeBodyFigure("female");
      }).not.toThrow();
    });
  });
});
