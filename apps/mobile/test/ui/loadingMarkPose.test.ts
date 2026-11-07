import { loadingMarkPose } from "../../components/LoadingMark/loadingMarkPose";

const AXIS = Math.SQRT1_2;

// The Babel plugin that makes a worklet gives the function a hash and a closure of what it captured, and it
// runs under Jest. Jest runs a worklet on the JavaScript thread, so a function that lacks the directive
// still passes every other test here and then crashes on the phone. So the functions the pose calls
// are found through its closure, and each one must have been made a worklet.
function hasWorkletHash(candidate: unknown): boolean {
  return typeof candidate === "function" && "__workletHash" in candidate;
}

function calledFunctions(worklet: unknown): Map<string, unknown> {
  const found = new Map<string, unknown>();
  const visit = (candidate: unknown) => {
    if (typeof candidate !== "function" || !("__closure" in candidate)) {
      return;
    }
    const { __closure: closure } = candidate;
    if (typeof closure !== "object" || closure === null) {
      return;
    }
    for (const [name, captured] of Object.entries(closure)) {
      if (typeof captured === "function" && !found.has(name)) {
        found.set(name, captured);
        visit(captured);
      }
    }
  };
  visit(worklet);
  return found;
}

// The pose gives coordinates, so the table's quantities are read back out of them.
function readPose(t: number) {
  const pose = loadingMarkPose(t);
  const dip = (pose.bar.x1 - 72) / AXIS;
  const arcErased = (arc: { length: number; offset: number }) =>
    arc.offset === 0 ? 0 : arc.length + 1000 - arc.offset;

  return {
    pose,
    travelOne: (pose.plateOne.x1 - 150) / AXIS - dip,
    travelTwo: -(pose.plateTwo.x1 - 60) / AXIS + dip,
    opacityOne: pose.plateOne.opacity,
    opacityTwo: pose.plateTwo.opacity,
    lengthOne: pose.arcOne.length,
    lengthTwo: pose.arcTwo.length,
    erased: arcErased(pose.arcOne),
    dip,
  };
}

describe("loadingMarkPose", () => {
  // These come from running the prototype page's POSES.load at each t.
  it.each([
    {
      t: 0,
      travelOne: 52,
      travelTwo: 52,
      opacityOne: 0,
      opacityTwo: 0,
      lengthOne: 0,
      lengthTwo: 0,
      erased: 0,
      dip: 0,
    },
    {
      t: 0.1,
      travelOne: 0.21,
      travelTwo: 52,
      opacityOne: 1,
      opacityTwo: 0,
      lengthOne: 0,
      lengthTwo: 0,
      erased: 0,
      dip: 0,
    },
    {
      t: 0.25,
      travelOne: 0,
      travelTwo: 52,
      opacityOne: 1,
      opacityTwo: 0,
      lengthOne: 115.3,
      lengthTwo: 0,
      erased: 0,
      dip: -0.585,
    },
    {
      t: 0.4,
      travelOne: 0,
      travelTwo: -3.58,
      opacityOne: 1,
      opacityTwo: 1,
      lengthOne: 205,
      lengthTwo: 0.07,
      erased: 0,
      dip: -0.013,
    },
    {
      t: 0.5,
      travelOne: 0,
      travelTwo: 0,
      opacityOne: 1,
      opacityTwo: 1,
      lengthOne: 205,
      lengthTwo: 89.7,
      erased: 0,
      dip: -0.773,
    },
    {
      t: 0.72,
      travelOne: 0,
      travelTwo: 0,
      opacityOne: 1,
      opacityTwo: 1,
      lengthOne: 205,
      lengthTwo: 205,
      erased: 0,
      dip: 0.005,
    },
    {
      t: 0.9,
      travelOne: 26,
      travelTwo: 26,
      opacityOne: 0.667,
      opacityTwo: 0.667,
      lengthOne: 102.5,
      lengthTwo: 102.5,
      erased: 102.5,
      dip: 0,
    },
    {
      t: 0.98,
      travelOne: 52,
      travelTwo: 52,
      opacityOne: 0,
      opacityTwo: 0,
      lengthOne: 0,
      lengthTwo: 0,
      erased: 205,
      dip: 0,
    },
  ])("should match the page at t $t", ({ t, dip, ...expected }) => {
    const actual = readPose(t);

    expect(actual.travelOne).toBeCloseTo(expected.travelOne, 2);
    expect(actual.travelTwo).toBeCloseTo(expected.travelTwo, 2);
    expect(actual.opacityOne).toBeCloseTo(expected.opacityOne, 2);
    expect(actual.opacityTwo).toBeCloseTo(expected.opacityTwo, 2);
    expect(actual.lengthOne).toBeCloseTo(expected.lengthOne, 2);
    expect(actual.lengthTwo).toBeCloseTo(expected.lengthTwo, 2);
    expect(actual.erased).toBeCloseTo(expected.erased, 2);
    expect(actual.dip).toBeCloseTo(dip, 2);
  });

  // The bar still rings a little from the second knock at t 0.9, so this is to 2 places.
  it("should slide plate one up and right and plate two down and left by the same distance, at t 0.9", () => {
    const { plateOne, plateTwo } = loadingMarkPose(0.9);

    expect(plateOne.x1).toBeCloseTo(150 + 26 * AXIS, 2);
    expect(plateOne.y1).toBeCloseTo(60 - 26 * AXIS, 2);
    expect(plateTwo.x1).toBeCloseTo(60 - 26 * AXIS, 2);
    expect(plateTwo.y1).toBeCloseTo(150 + 26 * AXIS, 2);
  });

  it("should move the bar and both plates together by the dip, at t 0.5", () => {
    const { bar, plateOne } = loadingMarkPose(0.5);
    const shift = bar.x1 - 72;

    expect(shift).not.toBe(0);
    expect(bar.y1 - 184).toBeCloseTo(shift, 5);
    expect(bar.x2 - 184).toBeCloseTo(shift, 5);
    expect(bar.y2 - 72).toBeCloseTo(shift, 5);
    expect(plateOne.x1 - 150).toBeCloseTo(shift, 5);
    expect(plateOne.y1 - 60).toBeCloseTo(shift, 5);
  });

  it("should leave the bar fully drawn at every time", () => {
    for (let t = 0; t < 1; t += 0.01) {
      expect(loadingMarkPose(t).bar).not.toHaveProperty("opacity");
    }
  });

  it("should be the logo at rest on the first drawn frame, t 0.72", () => {
    const { bar, plateOne, plateTwo, arcOne, arcTwo } = loadingMarkPose(0.72);

    expect(bar.x1).toBeCloseTo(72, 1);
    expect(bar.y1).toBeCloseTo(184, 1);
    expect(bar.x2).toBeCloseTo(184, 1);
    expect(bar.y2).toBeCloseTo(72, 1);
    expect([plateOne.x1, plateOne.y1, plateOne.x2, plateOne.y2]).toEqual([
      expect.closeTo(150, 1),
      expect.closeTo(60, 1),
      expect.closeTo(196, 1),
      expect.closeTo(106, 1),
    ]);
    expect([plateTwo.x1, plateTwo.y1, plateTwo.x2, plateTwo.y2]).toEqual([
      expect.closeTo(60, 1),
      expect.closeTo(150, 1),
      expect.closeTo(106, 1),
      expect.closeTo(196, 1),
    ]);
    expect(arcOne.length).toBeCloseTo(205, 1);
    expect(arcTwo.length).toBeCloseTo(205, 1);
  });

  it("should hide an arc shorter than half a unit, so its round cap draws no dot", () => {
    expect(loadingMarkPose(0.1).arcOne).toMatchObject({ length: 0, opacity: 0 });
    expect(loadingMarkPose(0.4).arcTwo.opacity).toBe(0);
    expect(loadingMarkPose(0.25).arcOne.opacity).toBe(1);
  });

  it("should draw the arc from its start at t 0.5 and shift the pattern by the erased length at t 0.9", () => {
    expect(loadingMarkPose(0.5).arcOne.offset).toBe(0);
    expect(loadingMarkPose(0.9).arcOne.offset).toBeCloseTo(1000, 5);
  });

  it("should never give a negative dash offset", () => {
    for (let t = 0; t <= 1; t += 0.005) {
      const { arcOne, arcTwo } = loadingMarkPose(t);

      expect(arcOne.offset).toBeGreaterThanOrEqual(0);
      expect(arcTwo.offset).toBeGreaterThanOrEqual(0);
    }
  });

  it.each([0, 0.98, 0.99, 1])(
    "should show no arc and no plate at t %s, so the seam cannot be seen",
    (t) => {
      const { arcOne, arcTwo, plateOne, plateTwo } = loadingMarkPose(t);

      expect([arcOne.opacity, arcTwo.opacity, plateOne.opacity, plateTwo.opacity]).toEqual([
        0, 0, 0, 0,
      ]);
    },
  );

  it("should give the same numbers for the same t", () => {
    expect(loadingMarkPose(0.37)).toEqual(loadingMarkPose(0.37));
  });

  describe("the worklet directive", () => {
    it("should be on loadingMarkPose", () => {
      expect(hasWorkletHash(loadingMarkPose)).toBe(true);
    });

    it("should be on every helper the pose calls, however deep", () => {
      const called = calledFunctions(loadingMarkPose);

      expect([...called.keys()].sort()).toEqual(["arcPose", "backOut", "inOut", "knock", "span"]);
      for (const [name, helper] of called) {
        expect({ name, isWorklet: hasWorkletHash(helper) }).toEqual({ name, isWorklet: true });
      }
    });
  });
});
