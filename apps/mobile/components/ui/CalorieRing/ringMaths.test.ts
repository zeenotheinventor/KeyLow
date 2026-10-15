import { ringCircumference, ringPath } from "./ringMaths";

// Literals for the diary canvas's ring: 200 points square with a 14 point stroke, so the circle is
// centred on 100 with a radius of 93.
describe("ringPath", () => {
  it("should start at twelve o'clock and go clockwise round a circle of radius 93", () => {
    expect(ringPath(200, 14)).toBe("M 100 7 A 93 93 0 1 1 100 193 A 93 93 0 1 1 100 7");
  });

  it("should centre the circle on the middle of a smaller ring", () => {
    expect(ringPath(160, 10)).toBe("M 80 5 A 75 75 0 1 1 80 155 A 75 75 0 1 1 80 5");
  });
});

describe("ringCircumference", () => {
  it("should be 584.3 for the 200 point ring with a 14 point stroke", () => {
    expect(ringCircumference(200, 14)).toBeCloseTo(584.3362, 4);
  });
});
