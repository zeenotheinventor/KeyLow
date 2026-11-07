import { describe, expect, it } from "vitest";

import {
  TREND_ESTIMATE,
  describeDayCitation,
  describeProgressCitation,
  describeRangeCitation,
  describeRoutineCitation,
  describeWeighInCitation,
  describeWorkoutsCitation,
} from "../../src/assistant";
import { exerciseWeeklyTrend } from "../../src/training";

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

describe("describeProgressCitation", () => {
  const trendOf = (trainedMondays: string[], now = "2026-10-20T12:00:00Z") =>
    exerciseWeeklyTrend(
      trainedMondays.map((localDate) => ({
        set_type: "working" as const,
        reps: 8,
        load_kg: 80,
        local_date: localDate,
      })),
      { range: "1y", now, timeZone: "UTC" },
    );

  // `assistant · answer-training`: "Based on 6 weeks of bench press, 7 Sep to 11 Oct".
  it("should word the line as the answer-training board does, to the Sunday that ends the latest week", () => {
    const trend = trendOf(["2026-09-07", "2026-09-14", "2026-09-21", "2026-09-28", "2026-10-05"]);

    expect(describeProgressCitation("Bench press", trend)).toBe(
      "Based on 5 weeks of bench press, 7 Sep to 11 Oct",
    );
  });

  it("should count the weeks trained and not the weeks the dates span", () => {
    const trend = trendOf(["2026-08-31", "2026-09-28", "2026-10-12"]);

    expect(describeProgressCitation("Barbell row", trend)).toBe(
      "Based on 3 weeks of barbell row, 31 Aug to 18 Oct",
    );
  });

  it("should use the singular for one trained week", () => {
    expect(describeProgressCitation("Squat", trendOf(["2026-10-12"]))).toBe(
      "Based on 1 week of squat, 12 to 18 Oct",
    );
  });

  it("should name both years when the weeks cross a year end", () => {
    const trend = trendOf(["2026-12-21", "2026-12-28"], "2027-01-04T12:00:00Z");

    expect(describeProgressCitation("Deadlift", trend)).toBe(
      "Based on 2 weeks of deadlift, 21 Dec 2026 to 3 Jan 2027",
    );
  });

  it("should clean and cut a name the person wrote, like any words shown from outside", () => {
    const trend = trendOf(["2026-10-12"]);

    expect(describeProgressCitation("Cable\n\u202EFLY\u0000  Machine", trend)).toBe(
      "Based on 1 week of cable fly machine, 12 to 18 Oct",
    );
    expect(describeProgressCitation("A".repeat(500), trend)).toBe(
      `Based on 1 week of ${"a".repeat(60)}, 12 to 18 Oct`,
    );
  });

  it.each([[""], ["   "], ["\u0000\u202E"]])(
    "should call it this exercise when nothing of the name %j is left",
    (name) => {
      expect(describeProgressCitation(name, trendOf(["2026-10-12"]))).toBe(
        "Based on 1 week of this exercise, 12 to 18 Oct",
      );
    },
  );

  it("should say there are no weeks when none was trained", () => {
    expect(describeProgressCitation("Bench press", trendOf([]))).toBe("No weeks of bench press");
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
