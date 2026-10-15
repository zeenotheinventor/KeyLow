import { stripesPath } from "./stripesPath";

// The design hatches the cap 4 points apart across the stripe, which is 4 times the square root of 2
// (5.657) along the bar.
describe("stripesPath", () => {
  it("should start the first stripe one bar height to the left, rising to the top edge", () => {
    expect(stripesPath(12, 8).startsWith("M -8 8 L 0 0 ")).toBe(true);
  });

  it("should space the stripes 4 times the square root of 2 apart", () => {
    const starts = Array.from(stripesPath(12, 8).matchAll(/M (-?[\d.]+) 8/g), (match) =>
      Number(match[1]),
    );

    expect(starts).toHaveLength(4);
    expect(starts[0]).toBe(-8);
    expect(starts[1]).toBeCloseTo(-8 + 5.656854, 5);
    expect(starts[3]).toBeCloseTo(-8 + 3 * 5.656854, 5);
  });

  it("should draw nothing when the box ends where the first stripe starts", () => {
    expect(stripesPath(-8, 8)).toBe("");
  });
});
