import { describe, expect, it } from "vitest";

import { BODY_LONG_PRESS_DELAY_MILLISECONDS, BODY_TAP_SLOP, classifyTouch } from "../src/touch";

const down = { x: 100, y: 200 };

describe("BODY_LONG_PRESS_DELAY_MILLISECONDS", () => {
  it("should be half a second, the delay the 2D figure's long press has always had", () => {
    expect(BODY_LONG_PRESS_DELAY_MILLISECONDS).toBe(500);
  });
});

describe("BODY_TAP_SLOP", () => {
  it("should be 10 points, the same as the 2D figure's tap slop", () => {
    expect(BODY_TAP_SLOP).toBe(10);
  });
});

describe("classifyTouch", () => {
  it("should call a lift where the finger went down a tap", () => {
    expect(classifyTouch(down, down, BODY_TAP_SLOP)).toBe("tap");
  });

  it("should call a lift exactly 10 points away a tap", () => {
    expect(classifyTouch(down, { x: 110, y: 200 }, BODY_TAP_SLOP)).toBe("tap");
  });

  it("should call a lift 11 points away a drag", () => {
    expect(classifyTouch(down, { x: 111, y: 200 }, BODY_TAP_SLOP)).toBe("drag");
  });

  it("should measure along a vertical move as it does along a horizontal one", () => {
    expect(classifyTouch(down, { x: 100, y: 210 }, BODY_TAP_SLOP)).toBe("tap");
    expect(classifyTouch(down, { x: 100, y: 190 }, BODY_TAP_SLOP)).toBe("tap");
    expect(classifyTouch(down, { x: 100, y: 211 }, BODY_TAP_SLOP)).toBe("drag");
  });

  it("should measure the straight distance of a diagonal move, not each axis", () => {
    expect(classifyTouch(down, { x: 107, y: 207 }, BODY_TAP_SLOP)).toBe("tap");
    expect(classifyTouch(down, { x: 108, y: 208 }, BODY_TAP_SLOP)).toBe("drag");
  });

  it("should call a lift to the left or above a drag when it is far enough", () => {
    expect(classifyTouch(down, { x: 89, y: 200 }, BODY_TAP_SLOP)).toBe("drag");
    expect(classifyTouch(down, { x: 100, y: 189 }, BODY_TAP_SLOP)).toBe("drag");
  });

  it("should use the slop it is given", () => {
    expect(classifyTouch(down, { x: 105, y: 200 }, 4)).toBe("drag");
    expect(classifyTouch(down, { x: 104, y: 200 }, 4)).toBe("tap");
  });
});
