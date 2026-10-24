import { describe, expect, it } from "vitest";

import { toDayInputs } from "../../src/engine";

describe("toDayInputs", () => {
  it("should join a total and a complete log row on the date", () => {
    expect(
      toDayInputs(
        [{ local_date: "2026-04-02", kcal: 2200 }],
        [{ local_date: "2026-04-02", is_complete: true }],
      ),
    ).toStrictEqual([{ localDate: "2026-04-02", intakeKcal: 2200, isComplete: true }]);
  });

  it("should not count a day with a total and no log row as complete", () => {
    expect(toDayInputs([{ local_date: "2026-04-02", kcal: 2200 }], [])).toStrictEqual([
      { localDate: "2026-04-02", intakeKcal: 2200, isComplete: false },
    ]);
  });

  it("should keep a total that the log row does not mark complete as not complete", () => {
    expect(
      toDayInputs(
        [{ local_date: "2026-04-02", kcal: 2200 }],
        [{ local_date: "2026-04-02", is_complete: false }],
      ),
    ).toStrictEqual([{ localDate: "2026-04-02", intakeKcal: 2200, isComplete: false }]);
  });

  it("should carry a null total as a null intake", () => {
    expect(
      toDayInputs(
        [{ local_date: "2026-04-02", kcal: null }],
        [{ local_date: "2026-04-02", is_complete: true }],
      ),
    ).toStrictEqual([{ localDate: "2026-04-02", intakeKcal: null, isComplete: true }]);
  });

  it("should give a log row with no total a null intake", () => {
    expect(toDayInputs([], [{ local_date: "2026-04-03", is_complete: true }])).toStrictEqual([
      { localDate: "2026-04-03", intakeKcal: null, isComplete: true },
    ]);
  });

  it("should list the days in date order whatever order the rows came in", () => {
    expect(
      toDayInputs(
        [
          { local_date: "2026-04-04", kcal: 1900 },
          { local_date: "2026-04-02", kcal: 2200 },
        ],
        [{ local_date: "2026-04-03", is_complete: false }],
      ),
    ).toStrictEqual([
      { localDate: "2026-04-02", intakeKcal: 2200, isComplete: false },
      { localDate: "2026-04-03", intakeKcal: null, isComplete: false },
      { localDate: "2026-04-04", intakeKcal: 1900, isComplete: false },
    ]);
  });

  it("should let the later total win when a date has two", () => {
    expect(
      toDayInputs(
        [
          { local_date: "2026-04-02", kcal: 2000 },
          { local_date: "2026-04-02", kcal: 2200 },
        ],
        [],
      ),
    ).toStrictEqual([{ localDate: "2026-04-02", intakeKcal: 2200, isComplete: false }]);
  });

  it("should let the later log row win when a date has two", () => {
    expect(
      toDayInputs(
        [{ local_date: "2026-04-02", kcal: 2200 }],
        [
          { local_date: "2026-04-02", is_complete: false },
          { local_date: "2026-04-02", is_complete: true },
        ],
      ),
    ).toStrictEqual([{ localDate: "2026-04-02", intakeKcal: 2200, isComplete: true }]);
  });

  it("should return no days for no rows", () => {
    expect(toDayInputs([], [])).toStrictEqual([]);
  });
});
