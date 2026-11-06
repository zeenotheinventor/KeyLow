import { describe, expect, it } from "vitest";

import { programCheckInDate } from "../../src/program";

describe("programCheckInDate", () => {
  it("should be the next check-in's date when there is one", () => {
    expect(programCheckInDate({ nextCheckinDate: "2026-11-06", startedOn: "2026-10-07" })).toBe(
      "2026-11-06",
    );
  });

  it("should be the start's date when no check-in is set", () => {
    expect(programCheckInDate({ nextCheckinDate: null, startedOn: "2026-10-07" })).toBe(
      "2026-10-07",
    );
  });

  it("should keep a next check-in date that is already past", () => {
    expect(programCheckInDate({ nextCheckinDate: "2026-10-16", startedOn: "2026-10-07" })).toBe(
      "2026-10-16",
    );
  });
});
