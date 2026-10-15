import {
  actionWidth,
  followFinger,
  restingOffsetFor,
} from "../../components/ui/FoodRow/SwipeToDelete/swipeOffset";

describe("the swipe offset", () => {
  it("should slide the row by the width of the action, 88 points", () => {
    expect(actionWidth).toBe(88);
  });

  describe("followFinger", () => {
    it("should follow the finger left from where the row rests", () => {
      expect(followFinger(0, -30)).toBe(-30);
      expect(followFinger(-88, 40)).toBe(-48);
    });

    it("should not slide the row right of where it starts", () => {
      expect(followFinger(0, 50)).toBe(0);
    });

    it("should not slide the row further than the action is wide", () => {
      expect(followFinger(0, -200)).toBe(-88);
    });
  });

  describe("restingOffsetFor", () => {
    it("should open the row once it is past halfway", () => {
      expect(restingOffsetFor(-45)).toBe(-88);
      expect(restingOffsetFor(-88)).toBe(-88);
    });

    it("should close the row when it is halfway or less", () => {
      expect(restingOffsetFor(-44)).toBe(0);
      expect(restingOffsetFor(-10)).toBe(0);
      expect(restingOffsetFor(0)).toBe(0);
    });

    it("should open a row let go in a quick flick left, however short the drag", () => {
      expect(restingOffsetFor(-10, -0.5)).toBe(-88);
    });

    it("should close an open row let go in a quick flick right, however short the drag", () => {
      expect(restingOffsetFor(-80, 0.5)).toBe(0);
    });

    it("should go by the position when the finger is let go slowly", () => {
      expect(restingOffsetFor(-10, -0.1)).toBe(0);
      expect(restingOffsetFor(-80, 0.1)).toBe(-88);
    });
  });
});
