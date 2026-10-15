import { canvasOutset, ringPaths } from "./ringMaths";

// Literals for the dashboard board's ring: 200 points square with a 14 point stroke, so the ring's circle has
// a radius of 93. The canvas is 3 points larger on every side, so the outer outline (which reaches 2.5 points
// past the 200 box) is not clipped, and the circles are centred on 103.
describe("ringPaths", () => {
  it("should give the canvas room for the outline, 3 points on every side", () => {
    expect(canvasOutset).toBe(3);
  });

  it("should start at twelve o'clock and go clockwise round a circle of radius 93", () => {
    expect(ringPaths(200, 14).ring).toBe("M 103 10 A 93 93 0 1 1 103 196 A 93 93 0 1 1 103 10");
  });

  it("should draw the outer outline at radius 101.75, which is 1 point of gap and a 1.5 point ring past the stroke", () => {
    expect(ringPaths(200, 14).outerOutline).toBe(
      "M 103 1.25 A 101.75 101.75 0 1 1 103 204.75 A 101.75 101.75 0 1 1 103 1.25",
    );
  });

  it("should draw the inner outline at radius 84.25, the same distance inside the stroke", () => {
    expect(ringPaths(200, 14).innerOutline).toBe(
      "M 103 18.75 A 84.25 84.25 0 1 1 103 187.25 A 84.25 84.25 0 1 1 103 18.75",
    );
  });

  it("should centre the circles on the middle of a smaller ring's canvas", () => {
    expect(ringPaths(160, 10).ring).toBe("M 83 8 A 75 75 0 1 1 83 158 A 75 75 0 1 1 83 8");
  });
});
