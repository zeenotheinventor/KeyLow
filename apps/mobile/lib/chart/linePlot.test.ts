import {
  axisTicks,
  bandPath,
  formatTick,
  labelledIndexes,
  latestIndex,
  lineRuns,
  lonePoints,
  plotPoints,
  runPath,
  valueDomain,
  weekLabel,
} from "./linePlot";

const area = { left: 10, top: 20, width: 100, height: 60 };

describe("valueDomain", () => {
  it("should span the lowest to the highest value and skip the gaps", () => {
    expect(valueDomain([50, null, 40, 55])).toEqual({ min: 40, max: 55 });
  });

  it("should open a flat series by one either side, so the line sits in the middle", () => {
    expect(valueDomain([55, 55])).toEqual({ min: 54, max: 56 });
  });

  it("should be undefined when there is no reading", () => {
    expect(valueDomain([null, null])).toBeUndefined();
    expect(valueDomain([])).toBeUndefined();
  });

  describe("with a band", () => {
    it("should run from the lowest to the highest of the values and the band ends", () => {
      expect(
        valueDomain(
          [2500, 2500, 2559.56, 2574.22, 2579.54],
          [
            { low: 2019.4, high: 2980.6 },
            { low: 2019.4, high: 2980.6 },
            { low: 2291.43, high: 2827.69 },
            { low: 2388.77, high: 2759.67 },
            { low: 2430.91, high: 2728.17 },
          ],
        ),
      ).toEqual({ min: 2019.4, max: 2980.6 });
    });

    it("should leave the domain of the values alone when the band sits inside them", () => {
      expect(
        valueDomain(
          [40, 55],
          [
            { low: 41, high: 43 },
            { low: 50, high: 54 },
          ],
        ),
      ).toEqual({ min: 40, max: 55 });
    });

    it("should skip a week without a band", () => {
      expect(valueDomain([40, 55], [null, { low: 50, high: 60 }])).toEqual({ min: 40, max: 60 });
    });

    it("should skip the band of a week without a value, which has nothing to draw", () => {
      expect(valueDomain([40, null, 55], [null, { low: 10, high: 90 }, null])).toEqual({
        min: 40,
        max: 55,
      });
    });

    it("should skip the weeks a short band list does not reach", () => {
      expect(valueDomain([40, 55, 50], [{ low: 30, high: 45 }])).toEqual({ min: 30, max: 55 });
    });

    it("should open a series whose band ends are its values by one either side", () => {
      expect(valueDomain([55, 55], [{ low: 55, high: 55 }, null])).toEqual({ min: 54, max: 56 });
    });

    it("should be undefined when no week has a value, whatever the band", () => {
      expect(valueDomain([null], [{ low: 1, high: 2 }])).toBeUndefined();
    });
  });
});

describe("latestIndex", () => {
  it("should be the last reading, skipping a gap at the end", () => {
    expect(latestIndex([40, 45, null])).toBe(1);
  });

  it("should be undefined when there is no reading", () => {
    expect(latestIndex([null])).toBeUndefined();
  });
});

describe("plotPoints", () => {
  it("should spread the weeks across the width and put the highest value at the top", () => {
    const points = plotPoints([40, 55, 47.5], area, { min: 40, max: 55 });

    expect(points).toEqual([
      { index: 0, x: 10, y: 80 },
      { index: 1, x: 60, y: 20 },
      { index: 2, x: 110, y: 50 },
    ]);
  });

  it("should leave a gap as null at its own place", () => {
    const points = plotPoints([40, null, 55], area, { min: 40, max: 55 });

    expect(points[1]).toBeNull();
    expect(points[2]).toEqual({ index: 2, x: 110, y: 20 });
  });

  it("should centre a single week", () => {
    expect(plotPoints([40], area, { min: 39, max: 41 })).toEqual([{ index: 0, x: 60, y: 50 }]);
  });

  it("should draw nothing without a domain", () => {
    expect(plotPoints([null, null], area, undefined)).toEqual([null, null]);
  });
});

describe("lineRuns", () => {
  const at = (index: number) => ({ index, x: index, y: 0 });

  it("should break the line at a gap", () => {
    const runs = lineRuns([at(0), at(1), null, at(3), at(4)]);

    expect(runs.map((run) => run.map((point) => point.index))).toEqual([
      [0, 1],
      [3, 4],
    ]);
  });

  it("should leave out a reading that stands alone, because one point has no line", () => {
    expect(lineRuns([at(0), null, at(2), at(3), null, at(5)]).map((run) => run.length)).toEqual([
      2,
    ]);
  });

  it("should be empty with no reading", () => {
    expect(lineRuns([null, null])).toEqual([]);
  });
});

describe("runPath", () => {
  it("should move to the first point and line to the rest, to two decimals", () => {
    expect(
      runPath([
        { index: 0, x: 10, y: 80 },
        { index: 1, x: 43.3333333, y: 50.5 },
        { index: 2, x: 110, y: 20 },
      ]),
    ).toBe("M10 80 L43.33 50.5 L110 20");
  });
});

describe("axisTicks", () => {
  it("should run from the top of the domain to the bottom through the middle", () => {
    expect(axisTicks({ min: 40, max: 55 })).toEqual([55, 47.5, 40]);
  });
});

describe("formatTick", () => {
  it("should drop a trailing .0 and keep one decimal otherwise", () => {
    expect(formatTick(55)).toBe("55");
    expect(formatTick(47.5)).toBe("47.5");
    expect(formatTick(47.46)).toBe("47.5");
    expect(formatTick(54.99)).toBe("55");
  });
});

describe("labelledIndexes", () => {
  it("should label every week of a short series", () => {
    expect(labelledIndexes(4, 4)).toEqual(new Set([0, 1, 2, 3]));
  });

  it("should label about four weeks of a longer series, counting back from the latest", () => {
    expect(labelledIndexes(13, 4)).toEqual(new Set([12, 8, 4, 0]));
    expect(labelledIndexes(52, 4)).toEqual(new Set([51, 38, 25, 12]));
  });

  it("should label nothing in an empty series", () => {
    expect(labelledIndexes(0, 4)).toEqual(new Set());
  });
});

describe("weekLabel", () => {
  it("should write the Monday as the day and the short month", () => {
    expect(weekLabel("2026-10-12")).toBe("12 Oct");
    expect(weekLabel("2026-01-05")).toBe("5 Jan");
  });
});

describe("lonePoints", () => {
  const at = (index: number) => ({ index, x: index, y: 0 });

  it("should be the readings with a skipped week or an edge on both sides", () => {
    expect(
      lonePoints([at(0), null, at(2), null, at(4), at(5)]).map((point) => point.index),
    ).toEqual([0, 2]);
  });

  it("should include a series of one reading", () => {
    expect(lonePoints([at(0)]).map((point) => point.index)).toEqual([0]);
  });

  it("should be empty when every reading is on a line", () => {
    expect(lonePoints([at(0), at(1), null, at(3), at(4)])).toEqual([]);
  });
});

describe("bandPath", () => {
  const at = (x: number, y: number | null) => ({ x, y });

  it("should run along the high ends and back along the low ends, and close", () => {
    expect(bandPath([at(10, 20), at(30, 10)], [at(10, 60), at(30, 50)])).toBe(
      "M10 20 L30 10 L30 50 L10 60 Z",
    );
  });

  it("should write the numbers to two decimals", () => {
    expect(bandPath([at(10.123, 20.456), at(30, 10)], [at(10.123, 60), at(30, 50.999)])).toBe(
      "M10.12 20.46 L30 10 L30 51 L10.12 60 Z",
    );
  });

  it("should break at a week with no value and start a new shape after it", () => {
    expect(
      bandPath(
        [at(0, 10), at(10, 10), at(20, null), at(30, 10), at(40, 12)],
        [at(0, 50), at(10, 50), at(20, null), at(30, 50), at(40, 52)],
      ),
    ).toBe("M0 10 L10 10 L10 50 L0 50 Z M30 10 L40 12 L40 52 L30 50 Z");
  });

  it("should break at a week whose low end is missing", () => {
    expect(
      bandPath([at(0, 10), at(10, 10), at(20, 10)], [at(0, 50), at(10, null), at(20, 50)]),
    ).toBe("M-6 10 H6 V50 H-6 Z M14 10 H26 V50 H14 Z");
  });

  it("should draw a lone week as a bar 12 points wide, centred on its point", () => {
    expect(bandPath([at(50, 20)], [at(50, 60)])).toBe("M44 20 H56 V60 H44 Z");
  });

  it("should draw a week alone between two skipped weeks as a bar", () => {
    expect(
      bandPath([at(0, null), at(10, 10), at(20, null)], [at(0, null), at(10, 50), at(20, null)]),
    ).toBe("M4 10 H16 V50 H4 Z");
  });

  it("should draw nothing when no week has a band", () => {
    expect(bandPath([at(0, null)], [at(0, null)])).toBe("");
    expect(bandPath([], [])).toBe("");
  });

  it("should treat a missing value like a null one", () => {
    expect(bandPath([{ x: 0, y: undefined }], [{ x: 0, y: undefined }])).toBe("");
  });
});
