import { plateShareColour } from "./plateShareColour";

// The board's plate share is the nutrient colour at 45 per cent over the track, which is its colour
// with an alpha of 0.45. The channels are read off the hex by hand.
describe("plateShareColour", () => {
  it("should give the calories colour in dark, #4FD1C5, at 45 per cent", () => {
    expect(plateShareColour("#4FD1C5")).toBe("rgba(79, 209, 197, 0.45)");
  });

  it("should give the calories colour in light, #0F9A8E, at 45 per cent", () => {
    expect(plateShareColour("#0F9A8E")).toBe("rgba(15, 154, 142, 0.45)");
  });

  it("should read a lower case colour as well", () => {
    expect(plateShareColour("#4fd1c5")).toBe("rgba(79, 209, 197, 0.45)");
  });

  it.each(["", "#fff", "#4FD1C", "4FD1C5", "#4FD1C5FF", "#GGGGGG", "rgb(79, 209, 197)"])(
    "should refuse %j, so it never yields rgba(NaN)",
    (notAHexColour) => {
      expect(() => plateShareColour(notAHexColour)).toThrow(RangeError);
    },
  );
});
