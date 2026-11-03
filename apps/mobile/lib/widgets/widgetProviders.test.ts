import { WIDGET_GALLERY } from "@keylow/core/copy";

import { WIDGET_PROVIDERS, widgetKindOf } from "./widgetProviders";

describe("the widget providers", () => {
  it("should list the eleven widgets in the order of the picker copy", () => {
    expect(WIDGET_PROVIDERS.map((provider) => provider.kind)).toEqual(Object.keys(WIDGET_GALLERY));
  });

  it("should give each provider its own receiver name", () => {
    const names = WIDGET_PROVIDERS.map((provider) => provider.name);

    expect(names).toEqual([
      "TodayRing",
      "TodayMacros",
      "ThisWeek",
      "BodyHeat",
      "TodayGlance",
      "BodyMap",
      "LogGrid",
      "TodayLogging",
      "LogAgain",
      "WeighIn",
      "Training",
    ]);
    expect(new Set(names).size).toBe(11);
  });

  it("should find the kind a receiver draws", () => {
    expect(widgetKindOf("TodayGlance")).toBe("today_glance");
    expect(widgetKindOf("Training")).toBe("training");
  });

  it("should know nothing of a receiver that is not one of the eleven", () => {
    expect(widgetKindOf("Unknown")).toBeUndefined();
  });
});
