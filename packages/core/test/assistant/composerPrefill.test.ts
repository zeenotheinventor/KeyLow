import { describe, expect, it } from "vitest";

import { composerTextForPrefill, composerTextOnClose } from "../../src/assistant";

describe("composerTextForPrefill", () => {
  it("should fill an empty composer", () => {
    expect(composerTextForPrefill("", "Replan Wed 18 Nov: ")).toBe("Replan Wed 18 Nov: ");
    expect(composerTextForPrefill("  ", "Replan Wed 18 Nov: ")).toBe("Replan Wed 18 Nov: ");
  });

  it("should never overwrite what the person typed", () => {
    expect(composerTextForPrefill("what is in my diary", "Replan Wed 18 Nov: ")).toBe(
      "what is in my diary",
    );
  });
});

describe("composerTextOnClose", () => {
  it("should clear a prefill the person left untouched", () => {
    expect(composerTextOnClose("Replan Wed 18 Nov: ", "Replan Wed 18 Nov: ")).toBe("");
  });

  it("should keep anything the person changed", () => {
    expect(composerTextOnClose("Replan Wed 18 Nov: no fish", "Replan Wed 18 Nov: ")).toBe(
      "Replan Wed 18 Nov: no fish",
    );
  });

  it("should leave the composer alone when the sheet was opened with no prefill", () => {
    expect(composerTextOnClose("typed words", undefined)).toBe("typed words");
  });
});
