import { describe, expect, it } from "vitest";

import { DASHBOARD_BODY_CHARTS, dashboardBodyChartOf } from "../../src/training";

describe("DASHBOARD_BODY_CHARTS", () => {
  it("should list Heat first, because Heat is the default", () => {
    expect(DASHBOARD_BODY_CHARTS).toStrictEqual(["heat", "volume"]);
  });
});

describe("dashboardBodyChartOf", () => {
  it.each(["heat", "volume"])("should give %s back as the chart it names", (chart) => {
    expect(dashboardBodyChartOf(chart)).toBe(chart);
  });

  it.each([null, undefined, "", "gap", "Heat", "3d", 1])(
    "should give nothing for %s, which is not a chart",
    (value) => {
      expect(dashboardBodyChartOf(value)).toBeUndefined();
    },
  );
});
