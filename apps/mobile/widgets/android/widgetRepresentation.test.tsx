import { colors, lightColors } from "@keylow/tokens";

import { readyModel } from "./test/viewModels";
import { backgroundColours, treeOf } from "./test/widgetTree";
import { widgetRepresentation } from "./widgetRepresentation";

describe("the widget representation", () => {
  it("should hand the launcher a light and a dark drawing of the same widget", () => {
    const representation = widgetRepresentation(readyModel("today_ring"));

    expect(representation).not.toBeNull();
    if (representation === null || !("light" in representation) || representation.dark === null) {
      throw new Error("Expected both drawings");
    }
    expect(backgroundColours(treeOf(representation.dark))[0]).toBe(colors.surface);
    expect(backgroundColours(treeOf(representation.light))[0]).toBe(lightColors["surface-raised"]);
  });

  it("should draw each of the six dashboard kinds", () => {
    for (const kind of [
      "today_ring",
      "today_macros",
      "this_week",
      "body_heat",
      "today_glance",
      "body_map",
    ] as const) {
      expect(widgetRepresentation(readyModel(kind))).not.toBeNull();
    }
  });

  it("should draw nothing for a quick logging kind until its widget exists", () => {
    expect(widgetRepresentation(readyModel("log_grid"))).toBeNull();
  });
});
