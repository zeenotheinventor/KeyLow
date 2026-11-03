import { WIDGET_KINDS } from "@keylow/core/widgets";
import { colors, lightColors } from "@keylow/tokens";

import { readyModel, readySource, sessionSnapshot } from "./test/viewModels";
import { backgroundColours, treeOf } from "./test/widgetTree";
import { widgetRepresentation } from "./widgetRepresentation";

describe("the widget representation", () => {
  it("should hand the launcher a light and a dark drawing of the same widget", () => {
    const representation = widgetRepresentation(readyModel("today_ring"));

    if (!("light" in representation) || representation.dark === null) {
      throw new Error("Expected both drawings");
    }
    expect(backgroundColours(treeOf(representation.dark))[0]).toBe(colors.surface);
    expect(backgroundColours(treeOf(representation.light))[0]).toBe(lightColors["surface-raised"]);
  });

  it("should draw each of the eleven kinds", () => {
    for (const kind of WIDGET_KINDS) {
      expect(widgetRepresentation(readyModel(kind, readySource(sessionSnapshot())))).not.toBeNull();
    }
  });
});
