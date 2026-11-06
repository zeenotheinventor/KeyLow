import { describe, expect, it } from "vitest";

import {
  COMPOSITION_PLOT_PADDING,
  COMPOSITION_VALUE_COLUMN_WIDTH,
  compositionEmptyGridOffsets,
  compositionPlotOffsetOf,
} from "../../src/weight";

const axis = { min: 80, max: 100 };

describe("the composition plot's room", () => {
  it("should keep the phone's padding: 12 left, the value column and 4 right, 16 above and 8 below", () => {
    expect(COMPOSITION_PLOT_PADDING).toEqual({ left: 12, right: 44, top: 16, bottom: 8 });
    expect(COMPOSITION_PLOT_PADDING.right).toBe(COMPOSITION_VALUE_COLUMN_WIDTH + 4);
  });

  describe.each([76, 106])("in a plot %i high", (plotHeight) => {
    it("should draw the highest value at the top padding and the lowest at the bottom padding", () => {
      expect(compositionPlotOffsetOf(100, axis, plotHeight)).toBe(COMPOSITION_PLOT_PADDING.top);
      expect(compositionPlotOffsetOf(80, axis, plotHeight)).toBe(
        plotHeight - COMPOSITION_PLOT_PADDING.bottom,
      );
    });

    it("should draw the middle of the axis half way between them", () => {
      expect(compositionPlotOffsetOf(90, axis, plotHeight)).toBe(
        (COMPOSITION_PLOT_PADDING.top + plotHeight - COMPOSITION_PLOT_PADDING.bottom) / 2,
      );
    });

    it("should draw the grid of an empty range at the top, the middle and the bottom of the plot", () => {
      expect(compositionEmptyGridOffsets(plotHeight)).toEqual([
        COMPOSITION_PLOT_PADDING.top,
        (COMPOSITION_PLOT_PADDING.top + plotHeight - COMPOSITION_PLOT_PADDING.bottom) / 2,
        plotHeight - COMPOSITION_PLOT_PADDING.bottom,
      ]);
    });
  });

  it("should give the phone's offsets for its 76 point plot", () => {
    expect(compositionEmptyGridOffsets(76)).toEqual([16, 42, 68]);
  });

  it("should give the web's offsets for its 106 point plot at the large breakpoint", () => {
    expect(compositionEmptyGridOffsets(106)).toEqual([16, 57, 98]);
  });
});
