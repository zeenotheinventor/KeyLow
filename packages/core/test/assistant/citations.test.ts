import { describe, expect, it } from "vitest";

import {
  TREND_ESTIMATE,
  describeDayCitation,
  describeRangeCitation,
  describeRoutineCitation,
  describeWeighInCitation,
} from "../../src/assistant";

/*
 * The words are the approved mobile boards': `assistant · answer` ("Based on 38 entries, 12 to 18 Oct"),
 * `assistant · answer-estimate` ("Based on 24 weigh-ins, 21 Sep to 18 Oct", the badge "Trend weight is an
 * estimate") and `assistant · conversation` ("Based on 4 entries today and your targets").
 */
describe("describeRangeCitation", () => {
  it("should write the answer board's line for a range inside one month", () => {
    expect(describeRangeCitation({ from: "2026-10-12", to: "2026-10-18", entryCount: 38 })).toBe(
      "Based on 38 entries, 12 to 18 Oct",
    );
  });

  it("should name both months when the range crosses a month end", () => {
    expect(describeRangeCitation({ from: "2026-09-28", to: "2026-10-04", entryCount: 21 })).toBe(
      "Based on 21 entries, 28 Sep to 4 Oct",
    );
  });

  it("should name both years when the range crosses a year end", () => {
    expect(describeRangeCitation({ from: "2026-12-28", to: "2027-01-03", entryCount: 9 })).toBe(
      "Based on 9 entries, 28 Dec 2026 to 3 Jan 2027",
    );
  });

  it("should write a single day once", () => {
    expect(describeRangeCitation({ from: "2026-10-12", to: "2026-10-12", entryCount: 3 })).toBe(
      "Based on 3 entries, 12 Oct",
    );
  });

  it("should say entry for exactly one", () => {
    expect(describeRangeCitation({ from: "2026-10-12", to: "2026-10-18", entryCount: 1 })).toBe(
      "Based on 1 entry, 12 to 18 Oct",
    );
  });

  it("should say there are no entries, rather than that the answer is based on none", () => {
    expect(describeRangeCitation({ from: "2026-10-12", to: "2026-10-18", entryCount: 0 })).toBe(
      "No entries, 12 to 18 Oct",
    );
  });
});

describe("describeWeighInCitation", () => {
  it("should write the answer-estimate board's line across a month end", () => {
    expect(describeWeighInCitation({ from: "2026-09-21", to: "2026-10-18", count: 24 })).toBe(
      "Based on 24 weigh-ins, 21 Sep to 18 Oct",
    );
  });

  it("should say weigh-in for exactly one, on a single day", () => {
    expect(describeWeighInCitation({ from: "2026-10-18", to: "2026-10-18", count: 1 })).toBe(
      "Based on 1 weigh-in, 18 Oct",
    );
  });

  it("should say there are no weigh-ins", () => {
    expect(describeWeighInCitation({ from: "2026-09-21", to: "2026-10-18", count: 0 })).toBe(
      "No weigh-ins, 21 Sep to 18 Oct",
    );
  });
});

describe("describeDayCitation", () => {
  const today = "2026-10-25";

  it("should write the conversation board's line for today", () => {
    expect(describeDayCitation({ localDate: today, today, entryCount: 4 })).toBe(
      "Based on 4 entries today and your targets",
    );
  });

  it("should name yesterday as yesterday", () => {
    expect(describeDayCitation({ localDate: "2026-10-24", today, entryCount: 8 })).toBe(
      "Based on 8 entries yesterday and your targets",
    );
  });

  it("should name any other day by its short date", () => {
    expect(describeDayCitation({ localDate: "2026-10-17", today, entryCount: 8 })).toBe(
      "Based on 8 entries on Sat 17 Oct and your targets",
    );
  });

  it("should name tomorrow by its short date, because the board has no word for it", () => {
    expect(describeDayCitation({ localDate: "2026-10-26", today, entryCount: 1 })).toBe(
      "Based on 1 entry on Mon 26 Oct and your targets",
    );
  });

  it.each([
    ["2026-10-25", "No entries today"],
    ["2026-10-24", "No entries yesterday"],
    ["2026-10-17", "No entries on Sat 17 Oct"],
  ])("should say there are no entries for %s", (localDate, expected) => {
    expect(describeDayCitation({ localDate, today, entryCount: 0 })).toBe(expected);
  });
});

describe("describeRoutineCitation", () => {
  it("should name the routine the answer rests on, as the answer-training board does", () => {
    expect(describeRoutineCitation("Push Pull Legs")).toBe("Based on your routine Push Pull Legs");
  });

  it("should keep the name as the person wrote it", () => {
    expect(describeRoutineCitation("upper/lower, 4 days")).toBe(
      "Based on your routine upper/lower, 4 days",
    );
  });
});

describe("TREND_ESTIMATE", () => {
  it("should be the badge the answer-estimate board prints", () => {
    expect(TREND_ESTIMATE).toBe("Trend weight is an estimate");
  });
});
