import { WIDGET_GALLERY } from "@keylow/core/copy";

import { DASHBOARD_WIDGET_PROVIDERS, dashboardKindOf } from "./widgetProviders";

describe("the dashboard widget providers", () => {
  it("should list the six concept A widgets in the order of the picker copy", () => {
    expect(DASHBOARD_WIDGET_PROVIDERS.map((provider) => provider.kind)).toEqual(
      Object.keys(WIDGET_GALLERY),
    );
  });

  it("should give each provider its own receiver name", () => {
    const names = DASHBOARD_WIDGET_PROVIDERS.map((provider) => provider.name);

    expect(names).toEqual([
      "TodayRing",
      "TodayMacros",
      "ThisWeek",
      "BodyHeat",
      "TodayGlance",
      "BodyMap",
    ]);
    expect(new Set(names).size).toBe(6);
  });

  it("should find the kind a receiver draws", () => {
    expect(dashboardKindOf("TodayGlance")).toBe("today_glance");
  });

  it("should know nothing of a receiver that is not one of the six", () => {
    expect(dashboardKindOf("LogGrid")).toBeUndefined();
  });
});
