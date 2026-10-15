import { beforeEach, describe, expect, it, vi } from "vitest";

import { buildLogEntry } from "../../src/diary/buildLogEntry";
import { foodChangedSinceLogged } from "../../src/diary/foodChangedSinceLogged";
import { foodOfSnapshot } from "../../src/diary/foodOfSnapshot";
import { foodSnapshotSchema } from "../../src/diary/schemas";
import { nutrientsOfSnapshot } from "../../src/diary/snapshotQuantity";
import { estimateDensity } from "../../src/nutrition/density";
import { SPOON_PORTIONS } from "../../src/nutrition/volume";
import { buildFood } from "../../src/testing";
import goldenEntries from "../fixtures/diary/goldenV1Snapshots.json";

// The estimate is stubbed, so these tests do not depend on the numbers in the density table.
vi.mock("../../src/nutrition/density", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../src/nutrition/density")>();
  return { ...actual, estimateDensity: vi.fn(actual.estimateDensity) };
});

const estimateIs = (gPerMl: number | null) =>
  vi.mocked(estimateDensity).mockReturnValue(gPerMl === null ? null : { gPerMl, basis: "group" });

const tablespoon = SPOON_PORTIONS[1];
if (tablespoon === undefined) {
  throw new Error("The spoon portions must include a tablespoon");
}

const when = {
  localDate: "2026-10-15",
  loggedAt: "2026-10-15T12:30:00+01:00",
} as const;

// No density of its own: whatever density it has comes from the stubbed estimate.
const oil = buildFood({
  id: "00000000-0000-4000-8000-0000000000e3",
  name: "Estimated oil",
  density_g_per_ml: null,
  kcal: 884,
  fat_g: 100,
});

beforeEach(() => {
  vi.mocked(estimateDensity).mockReset();
});

describe("old entries when the live food now has an estimated density", () => {
  const densityNull = goldenEntries.filter(({ snapshot }) => snapshot.density === null);
  const densityGiven = goldenEntries.filter(({ snapshot }) => snapshot.density !== null);

  it("should have density-null and explicit-density golden entries to test", () => {
    expect(densityNull).toHaveLength(3);
    expect(densityGiven).toHaveLength(1);
  });

  it.each(densityNull)(
    "should not flag $name, which has no own density, even though the live food has an estimate",
    ({ snapshot }) => {
      estimateIs(0.92);
      const liveFood = foodOfSnapshot(foodSnapshotSchema.parse(snapshot), "2026-10-07T10:00:00Z");

      expect(foodChangedSinceLogged(liveFood, foodSnapshotSchema.parse(snapshot))).toBe(false);
    },
  );

  it.each(densityNull)(
    "should still flag $name when the live food has a density of its own",
    ({ snapshot }) => {
      estimateIs(0.92);
      const liveFood = {
        ...foodOfSnapshot(foodSnapshotSchema.parse(snapshot), "2026-10-07T10:00:00Z"),
        density_g_per_ml: 0.92,
      };

      expect(foodChangedSinceLogged(liveFood, foodSnapshotSchema.parse(snapshot))).toBe(true);
    },
  );

  it.each(densityGiven)(
    "should not flag $name when the live food keeps its own density",
    ({ snapshot }) => {
      estimateIs(0.5);
      const liveFood = foodOfSnapshot(foodSnapshotSchema.parse(snapshot), "2026-10-07T10:00:00Z");

      expect(foodChangedSinceLogged(liveFood, foodSnapshotSchema.parse(snapshot))).toBe(false);
    },
  );
});

describe("an estimated density, once logged", () => {
  const logTablespoon = () => {
    estimateIs(0.92);
    return buildLogEntry({
      food: oil,
      quantity: 2,
      unit: "portion",
      portion: tablespoon,
      ...when,
    });
  };

  it("should be frozen into the snapshot", () => {
    expect(logTablespoon().snapshot.density).toBe(0.92);
  });

  it("should leave the stored entry's nutrients unchanged when the estimate changes", () => {
    const { snapshot, nutrients } = logTablespoon();

    estimateIs(0.5);

    expect(nutrientsOfSnapshot(snapshot)).toEqual(nutrients);
    expect(nutrientsOfSnapshot(snapshot).kcal).toBeCloseTo(884 * 0.276, 10);
  });

  it("should not flag the entry while the estimate stays the same", () => {
    const { snapshot } = logTablespoon();

    expect(foodChangedSinceLogged(oil, snapshot)).toBe(false);
  });

  it("should flag the entry when the estimate changes to another number", () => {
    const { snapshot } = logTablespoon();

    estimateIs(0.5);

    expect(foodChangedSinceLogged(oil, snapshot)).toBe(true);
  });

  it("should flag the entry when the estimate is removed entirely", () => {
    const { snapshot } = logTablespoon();

    estimateIs(null);

    expect(foodChangedSinceLogged(oil, snapshot)).toBe(true);
  });

  it("should flag the entry when the person gives the food a density of their own", () => {
    const { snapshot } = logTablespoon();

    estimateIs(0.92);

    expect(foodChangedSinceLogged({ ...oil, density_g_per_ml: 0.91 }, snapshot)).toBe(true);
  });
});
