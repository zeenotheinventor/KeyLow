import { outlineColour } from "./outlineColour";

// The ruling's ring: the nutrient colour at 55 per cent and white at 45. The channels are worked out by
// hand: 0.55 of the colour plus 0.45 of 255 (114.75), rounded.
describe("outlineColour", () => {
  it("should mix the calories colour in dark, #4FD1C5, with 45 per cent white", () => {
    expect(outlineColour("#4FD1C5")).toBe("rgb(158, 230, 223)");
  });

  it("should mix the calories colour in light, #0F9A8E, with 45 per cent white", () => {
    expect(outlineColour("#0F9A8E")).toBe("rgb(123, 199, 193)");
  });

  it("should leave white white", () => {
    expect(outlineColour("#FFFFFF")).toBe("rgb(255, 255, 255)");
  });

  it("should turn black into the 45 per cent white that is left", () => {
    expect(outlineColour("#000000")).toBe("rgb(115, 115, 115)");
  });

  it("should read a lower case colour as well", () => {
    expect(outlineColour("#4fd1c5")).toBe("rgb(158, 230, 223)");
  });

  it.each(["", "#fff", "#4FD1C", "4FD1C5", "#4FD1C5FF", "#GGGGGG", "rgb(79, 209, 197)"])(
    "should refuse %j, so it never yields rgb(NaN)",
    (notAHexColour) => {
      expect(() => outlineColour(notAHexColour)).toThrow(RangeError);
    },
  );
});
