import { describe, expect, it } from "vitest";

import * as program from "../../src/program";

describe("the program module", () => {
  it("should export its public surface", () => {
    expect(Object.keys(program).sort()).toEqual([
      "acceptedWeighInDates",
      "buildCheckinSummaryView",
      "buildExpenditureChartView",
      "buildProgramView",
      "buildSettlingChecklistView",
      "changesOf",
      "checkinSummary",
      "checkinWindow",
      "checkinWindowWeeks",
      "chooseGoal",
      "completeDayDates",
      "expenditureBand",
      "expenditureChartWeeks",
      "firstCheckinReadiness",
      "initialDraftOf",
      "programCheckInDate",
      "selectCheckinTargetsRows",
      "settlingProgress",
    ]);
  });
});
