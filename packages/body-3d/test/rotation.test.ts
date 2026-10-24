import { describe, expect, it } from "vitest";

import { BODY_SIDE_YAW, nearestSide, yawAfterDrag, yawToReachSide } from "../src/rotation";

const HALF_TURN = Math.PI;
const QUARTER_TURN = Math.PI / 2;

describe("BODY_SIDE_YAW", () => {
  it("should face the front at no turn and the back at half a turn", () => {
    expect(BODY_SIDE_YAW).toEqual({ front: 0, back: Math.PI });
  });
});

describe("yawAfterDrag", () => {
  it("should turn half a turn for a drag of the body's width", () => {
    expect(yawAfterDrag(0, 120, 120)).toBeCloseTo(HALF_TURN);
  });

  it("should turn a quarter turn for a drag of half the width", () => {
    expect(yawAfterDrag(0, 60, 120)).toBeCloseTo(QUARTER_TURN);
  });

  it("should turn the other way for a drag to the left", () => {
    expect(yawAfterDrag(0, -60, 120)).toBeCloseTo(-QUARTER_TURN);
  });

  it("should add the drag to where the body was", () => {
    expect(yawAfterDrag(1, 60, 120)).toBeCloseTo(1 + QUARTER_TURN);
  });

  it("should keep turning past a half turn, without wrapping", () => {
    expect(yawAfterDrag(0, 360, 120)).toBeCloseTo(3 * HALF_TURN);
  });

  it("should not move for no drag", () => {
    expect(yawAfterDrag(2, 0, 120)).toBe(2);
  });

  it("should not move when the width is nothing, so no division by zero poisons the turn", () => {
    expect(yawAfterDrag(2, 50, 0)).toBe(2);
  });
});

describe("nearestSide", () => {
  it.each([
    [0, "front"],
    [0.3, "front"],
    [-0.3, "front"],
    [QUARTER_TURN - 0.01, "front"],
    [QUARTER_TURN + 0.01, "back"],
    [-QUARTER_TURN - 0.01, "back"],
    [HALF_TURN, "back"],
    [-HALF_TURN, "back"],
  ] as const)("should settle a yaw of %f on the %s", (yaw, side) => {
    expect(nearestSide(yaw)).toBe(side);
  });

  it.each([
    [2 * HALF_TURN, "front"],
    [3 * HALF_TURN, "back"],
    [-3 * HALF_TURN, "back"],
    [4 * HALF_TURN + 0.2, "front"],
    [5 * HALF_TURN - 0.2, "back"],
  ] as const)(
    "should read a yaw of %f past a whole turn as the same as inside one",
    (yaw, side) => {
      expect(nearestSide(yaw)).toBe(side);
    },
  );

  it("should settle exactly between the sides on the front, from either direction", () => {
    expect(nearestSide(QUARTER_TURN)).toBe("front");
    expect(nearestSide(-QUARTER_TURN)).toBe("front");
    expect(nearestSide(3 * QUARTER_TURN)).toBe("front");
    expect(nearestSide(-3 * QUARTER_TURN)).toBe("front");
  });
});

describe("yawToReachSide", () => {
  it("should not turn when the body already faces the side", () => {
    expect(yawToReachSide(0, "front")).toBe(0);
    expect(yawToReachSide(HALF_TURN, "back")).toBeCloseTo(HALF_TURN);
  });

  it("should turn the short way to the back from a little right of the front", () => {
    expect(yawToReachSide(0.1, "back")).toBeCloseTo(HALF_TURN);
  });

  it("should turn the short way to the back from a little left of the front, which is the other direction", () => {
    expect(yawToReachSide(-0.1, "back")).toBeCloseTo(-HALF_TURN);
  });

  it("should turn through a quarter turn, not three, from a quarter turn left of the back", () => {
    expect(yawToReachSide(-QUARTER_TURN, "front")).toBeCloseTo(0);
  });

  it("should turn the short way to the front from just past a half turn", () => {
    expect(yawToReachSide(HALF_TURN + 0.1, "front")).toBeCloseTo(2 * HALF_TURN);
  });

  it("should reach the side after several whole turns by the short way", () => {
    expect(yawToReachSide(4 * HALF_TURN + 0.2, "front")).toBeCloseTo(4 * HALF_TURN);
  });

  it("should turn forward a half turn from the front to the back, because both ways are as short", () => {
    expect(yawToReachSide(0, "back")).toBeCloseTo(HALF_TURN);
  });

  it("should turn forward a half turn from the back to the front", () => {
    expect(yawToReachSide(HALF_TURN, "front")).toBeCloseTo(2 * HALF_TURN);
  });

  it("should never turn further than half a turn", () => {
    for (let yaw = -20; yaw <= 20; yaw += 0.37) {
      for (const side of ["front", "back"] as const) {
        expect(Math.abs(yawToReachSide(yaw, side) - yaw)).toBeLessThanOrEqual(HALF_TURN + 1e-9);
      }
    }
  });

  it("should end on the side it was asked for", () => {
    for (let yaw = -20; yaw <= 20; yaw += 0.37) {
      expect(nearestSide(yawToReachSide(yaw, "back"))).toBe("back");
      expect(nearestSide(yawToReachSide(yaw, "front"))).toBe("front");
    }
  });
});
