import { describe, expect, it } from "vitest";

import {
  TREND_ESTIMATE,
  describeDayCitation,
  describeMuscleCitation,
  describeRangeCitation,
  describeRoutineCitation,
  describeSuggestionCitation,
  describeWeighInCitation,
  describeWorkoutsCitation,
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
  // No board draws this line. The words are the designer's note on the canvas, recorded on KEY-881.
  it("should word the line as the designer's note on the canvas does", () => {
    expect(describeRoutineCitation("Push Pull Legs")).toBe("Based on your routine Push Pull Legs");
  });

  it("should keep the name as the person wrote it", () => {
    expect(describeRoutineCitation("upper/lower, 4 days")).toBe(
      "Based on your routine upper/lower, 4 days",
    );
  });

  it("should take control and direction characters out of the name and collapse its whitespace", () => {
    expect(describeRoutineCitation("Push\n\u202EPull\u0000  Legs")).toBe(
      "Based on your routine Push Pull Legs",
    );
  });

  it("should cut a long name at 60 code points", () => {
    expect(describeRoutineCitation("a".repeat(500))).toBe(
      `Based on your routine ${"a".repeat(60)}`,
    );
  });

  it.each([[""], ["   "], ["\u0000\u202E"]])(
    "should leave the name out when nothing of %j is left",
    (name) => {
      expect(describeRoutineCitation(name)).toBe("Based on your routine");
    },
  );
});

/*
 * The words are the approved mobile boards' `assistant · answer-training` ("Your back had 18 sets in the
 * last 7 days, against a target of 22") and `assistant · answer-suggestion`.
 */
describe("describeMuscleCitation", () => {
  it("should name the sets, the area and the 7 days they were counted over", () => {
    expect(
      describeMuscleCitation({ area: "back", sets: 18, from: "2026-10-08", to: "2026-10-14" }),
    ).toBe("Based on 18 sets for your back, 8 to 14 Oct");
  });

  it("should write the sets as the body map does, to two decimals at most", () => {
    expect(
      describeMuscleCitation({ area: "arms", sets: 5.5, from: "2026-10-08", to: "2026-10-14" }),
    ).toBe("Based on 5.5 sets for your arms, 8 to 14 Oct");
  });

  it("should say one set in the singular", () => {
    expect(
      describeMuscleCitation({ area: "neck", sets: 1, from: "2026-10-08", to: "2026-10-14" }),
    ).toBe("Based on 1 set for your neck, 8 to 14 Oct");
  });

  it("should say so when the area had no sets", () => {
    expect(
      describeMuscleCitation({ area: "back", sets: 0, from: "2026-10-08", to: "2026-10-14" }),
    ).toBe("No sets for your back, 8 to 14 Oct");
  });

  it("should not count sets across all the muscles, which would count a set once for each muscle it works", () => {
    expect(
      describeMuscleCitation({ area: null, sets: 31, from: "2026-10-08", to: "2026-10-14" }),
    ).toBe("Based on your muscles, 8 to 14 Oct");
  });

  it("should say so when no muscle had a set", () => {
    expect(
      describeMuscleCitation({ area: null, sets: 0, from: "2026-10-08", to: "2026-10-14" }),
    ).toBe("No sets, 8 to 14 Oct");
  });
});

describe("describeSuggestionCitation", () => {
  it("should name today", () => {
    expect(describeSuggestionCitation({ localDate: "2026-10-15", today: "2026-10-15" })).toBe(
      "Based on Ki-Lo's suggestion for today",
    );
  });

  it("should name the weekday of another day", () => {
    expect(describeSuggestionCitation({ localDate: "2026-10-15", today: "2026-10-14" })).toBe(
      "Based on Ki-Lo's suggestion for Thursday",
    );
  });
});

describe("describeWorkoutsCitation", () => {
  // The words are the board `assistant · answer-training`: "Based on 2 workouts, 12 to 13 Oct" and "Based on
  // 1 workout, 8 Oct". The line for a range with nothing in it is the ticket's, KEY-891: no board draws it.
  it("should write the answer-training board's line for a range inside one month", () => {
    expect(
      describeWorkoutsCitation({ from: "2026-10-12", to: "2026-10-13", workoutCount: 2 }),
    ).toBe("Based on 2 workouts, 12 to 13 Oct");
  });

  it("should write the answer-training board's line for one workout on one day", () => {
    expect(
      describeWorkoutsCitation({ from: "2026-10-08", to: "2026-10-08", workoutCount: 1 }),
    ).toBe("Based on 1 workout, 8 Oct");
  });

  it("should name both months when the range crosses a month end", () => {
    expect(
      describeWorkoutsCitation({ from: "2026-09-28", to: "2026-10-04", workoutCount: 5 }),
    ).toBe("Based on 5 workouts, 28 Sep to 4 Oct");
  });

  it("should name both years when the range crosses a year end", () => {
    expect(
      describeWorkoutsCitation({ from: "2026-12-28", to: "2027-01-03", workoutCount: 3 }),
    ).toBe("Based on 3 workouts, 28 Dec 2026 to 3 Jan 2027");
  });

  it("should say there were none, and not that the answer is based on 0 workouts", () => {
    expect(
      describeWorkoutsCitation({ from: "2026-10-12", to: "2026-10-13", workoutCount: 0 }),
    ).toBe("No workouts, 12 to 13 Oct");
  });
});

describe("TREND_ESTIMATE", () => {
  it("should be the badge the answer-estimate board prints", () => {
    expect(TREND_ESTIMATE).toBe("Trend weight is an estimate");
  });
});
