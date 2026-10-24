import { describe, expect, it } from "vitest";

import { parseHistory } from "../src/historySchema.ts";
import { ReplayInputError } from "../src/replayInputError.ts";

/** A small valid history, as plain data. Each test breaks one field of it. */
function validHistory() {
  return {
    stats: { sex: "male", birthDate: "1990-01-01", heightCm: 180, activity: "moderate" },
    onboardingWeightKg: 80,
    program: {
      goal: "lose",
      ratePctPerWeek: 0.5,
      proteinGPerKg: 1.6,
      fatFraction: 0.4,
      dowOffsetsKcal: [0, 0, 0, 0, 0, 0, 0],
      startedOn: "2026-04-02",
    },
    weighIns: [
      { localDate: "2026-04-02", weightKg: 80 },
      { localDate: "2026-04-03", weightKg: 79.95 },
    ],
    days: [{ localDate: "2026-04-02", kcal: 2200, isComplete: true }],
  };
}

function textWith(change: (history: ReturnType<typeof validHistory>) => unknown): string {
  return JSON.stringify(change(validHistory()));
}

function messageOf(text: string): string {
  try {
    parseHistory(text);
  } catch (error) {
    if (error instanceof ReplayInputError) {
      return error.message;
    }
    throw error;
  }
  throw new Error("The history was accepted.");
}

describe("parseHistory", () => {
  it("should accept a valid history and return its fields", () => {
    const history = parseHistory(JSON.stringify(validHistory()));

    expect(history.stats).toStrictEqual({
      sex: "male",
      birthDate: "1990-01-01",
      heightCm: 180,
      activity: "moderate",
    });
    expect(history.onboardingWeightKg).toBe(80);
    expect(history.program.startedOn).toBe("2026-04-02");
    expect(history.weighIns).toHaveLength(2);
    expect(history.days).toStrictEqual([{ localDate: "2026-04-02", kcal: 2200, isComplete: true }]);
  });

  it("should name the field of a weigh-in with a date that does not exist, and not quote the date", () => {
    const message = messageOf(
      textWith((history) => ({
        ...history,
        weighIns: [history.weighIns[0], { localDate: "2026-13-45", weightKg: 79.9 }],
      })),
    );

    expect(message).toContain("weighIns[1].localDate");
    expect(message).not.toContain("2026-13-45");
  });

  it("should name the field of a date that is not written YYYY-MM-DD", () => {
    const message = messageOf(
      textWith((history) => ({
        ...history,
        program: { ...history.program, startedOn: "2 April" },
      })),
    );

    expect(message).toContain("program.startedOn");
    expect(message).not.toContain("2 April");
  });

  it("should name the birth date field and not quote the birth date", () => {
    const message = messageOf(
      textWith((history) => ({ ...history, stats: { ...history.stats, birthDate: "1990-02-30" } })),
    );

    expect(message).toContain("stats.birthDate");
    expect(message).not.toContain("1990-02-30");
  });

  it("should name the field of a day with a date that does not exist", () => {
    const message = messageOf(
      textWith((history) => ({
        ...history,
        days: [{ localDate: "2026-02-30", kcal: 2200, isComplete: true }],
      })),
    );

    expect(message).toContain("days[0].localDate");
  });

  it("should name the sex field when the sex is not one the engine knows", () => {
    const message = messageOf(
      textWith((history) => ({ ...history, stats: { ...history.stats, sex: "robot" } })),
    );

    expect(message).toContain("stats.sex");
    expect(message).not.toContain("robot");
  });

  it("should name the field of a weight that is not above zero, and not quote it", () => {
    const message = messageOf(textWith((history) => ({ ...history, onboardingWeightKg: -81.5 })));

    expect(message).toContain("onboardingWeightKg");
    expect(message).not.toContain("81.5");
  });

  it("should name the field when a field is missing", () => {
    const message = messageOf(
      textWith((history) => ({ ...history, stats: { ...history.stats, heightCm: undefined } })),
    );

    expect(message).toContain("stats.heightCm");
  });

  it("should name the field when the week offsets are not seven whole numbers", () => {
    const message = messageOf(
      textWith((history) => ({
        ...history,
        program: { ...history.program, dowOffsetsKcal: [0, 0, 0] },
      })),
    );

    expect(message).toContain("program.dowOffsetsKcal");
  });

  it("should name the field when the goal is not lose, maintain or gain", () => {
    const message = messageOf(
      textWith((history) => ({ ...history, program: { ...history.program, goal: "bulk" } })),
    );

    expect(message).toContain("program.goal");
  });

  it("should list every field that is wrong, one a line", () => {
    const message = messageOf(
      textWith((history) => ({
        ...history,
        onboardingWeightKg: -1,
        stats: { ...history.stats, heightCm: -1 },
      })),
    );

    expect(message.split("\n")).toHaveLength(2);
  });

  it("should say the text is not JSON, without quoting it", () => {
    expect(messageOf("{ not json 80.5")).toBe("The history file is not valid JSON.");
  });

  it("should refuse two weigh-ins on one date and name the later entry's field, not the date", () => {
    const message = messageOf(
      textWith((history) => ({
        ...history,
        weighIns: [
          { localDate: "2026-04-02", weightKg: 80 },
          { localDate: "2026-04-03", weightKg: 79.9 },
          { localDate: "2026-04-02", weightKg: 79.8 },
        ],
      })),
    );

    expect(message).toBe("weighIns[2].localDate: appears more than once");
  });

  it("should refuse two days on one date and name the later entry's field, not the date", () => {
    const message = messageOf(
      textWith((history) => ({
        ...history,
        days: [
          { localDate: "2026-04-02", kcal: 2200, isComplete: true },
          { localDate: "2026-04-02", kcal: 2100, isComplete: false },
        ],
      })),
    );

    expect(message).toBe("days[1].localDate: appears more than once");
  });

  it("should accept weigh-ins and days on different dates", () => {
    expect(parseHistory(JSON.stringify(validHistory())).weighIns).toHaveLength(2);
  });

  it("should refuse a birth date after startedOn and name the birth date field, not the date", () => {
    const message = messageOf(
      textWith((history) => ({
        ...history,
        stats: { ...history.stats, birthDate: "2026-04-03" },
      })),
    );

    expect(message).toBe("stats.birthDate: must not be after program.startedOn");
  });

  it("should accept a birth date on startedOn itself", () => {
    const text = textWith((history) => ({
      ...history,
      stats: { ...history.stats, birthDate: "2026-04-02" },
    }));

    expect(parseHistory(text).stats.birthDate).toBe("2026-04-02");
  });

  it("should refuse a day with a negative intake and name the field", () => {
    const message = messageOf(
      textWith((history) => ({
        ...history,
        days: [{ localDate: "2026-04-02", kcal: -5, isComplete: true }],
      })),
    );

    expect(message).toContain("days[0].kcal");
  });

  it("should refuse a fat fraction above 1 and name the field", () => {
    const message = messageOf(
      textWith((history) => ({ ...history, program: { ...history.program, fatFraction: 1.5 } })),
    );

    expect(message).toContain("program.fatFraction");
  });

  it("should refuse a fat fraction below 0 and name the field", () => {
    const message = messageOf(
      textWith((history) => ({ ...history, program: { ...history.program, fatFraction: -0.1 } })),
    );

    expect(message).toContain("program.fatFraction");
  });

  it("should refuse a week offset that is not a whole number and name its field", () => {
    const message = messageOf(
      textWith((history) => ({
        ...history,
        program: { ...history.program, dowOffsetsKcal: [0, 0.5, 0, 0, 0, 0, 0] },
      })),
    );

    expect(message).toContain("program.dowOffsetsKcal[1]");
  });
});
