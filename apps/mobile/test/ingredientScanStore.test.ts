import {
  beginIngredientScan,
  cancelIngredientScan,
  finishIngredientScan,
  subscribeIngredientScan,
  takeIngredientScan,
} from "../lib/ingredientScan";
import { resetIngredientScanForTests } from "../lib/ingredientScan/testing";

// The hand-back from the scanner to the recipe editor. A route cannot return a value, so the scan
// leaves the food it found here for the editor that asked for it, and nobody else.

const foodId = "11111111-1111-4111-8111-111111111111";
const otherFoodId = "22222222-2222-4222-8222-222222222222";

describe("ingredient scan hand-back", () => {
  beforeEach(() => {
    resetIngredientScanForTests();
  });

  it("should hand the food to the request that asked for it, once", () => {
    const requestId = beginIngredientScan();

    finishIngredientScan(requestId, foodId);

    expect(takeIngredientScan(requestId)).toBe(foodId);
    expect(takeIngredientScan(requestId)).toBeUndefined();
  });

  it("should have nothing to take before the scan has finished", () => {
    const requestId = beginIngredientScan();

    expect(takeIngredientScan(requestId)).toBeUndefined();
  });

  it("should ignore a result for an id that was never begun", () => {
    const requestId = beginIngredientScan();

    finishIngredientScan("made-up", foodId);

    expect(takeIngredientScan(requestId)).toBeUndefined();
    expect(takeIngredientScan("made-up")).toBeUndefined();
  });

  it("should ignore a result when nothing is pending", () => {
    finishIngredientScan("made-up", foodId);

    expect(takeIngredientScan("made-up")).toBeUndefined();
  });

  it("should give a new id to every request", () => {
    expect(beginIngredientScan()).not.toBe(beginIngredientScan());
  });

  it("should let a second request take the place of the first", () => {
    const first = beginIngredientScan();
    const second = beginIngredientScan();

    finishIngredientScan(first, foodId);
    finishIngredientScan(second, otherFoodId);

    expect(takeIngredientScan(first)).toBeUndefined();
    expect(takeIngredientScan(second)).toBe(otherFoodId);
  });

  it("should drop a request that was cancelled, so a late result is ignored", () => {
    const requestId = beginIngredientScan();

    cancelIngredientScan(requestId);
    finishIngredientScan(requestId, foodId);

    expect(takeIngredientScan(requestId)).toBeUndefined();
  });

  it("should drop a result that was not yet taken when its request is cancelled", () => {
    const requestId = beginIngredientScan();
    finishIngredientScan(requestId, foodId);

    cancelIngredientScan(requestId);

    expect(takeIngredientScan(requestId)).toBeUndefined();
  });

  it("should leave the pending request alone when another id is cancelled", () => {
    const requestId = beginIngredientScan();

    cancelIngredientScan("someone-else");
    finishIngredientScan(requestId, foodId);

    expect(takeIngredientScan(requestId)).toBe(foodId);
  });

  describe("subscribing", () => {
    it("should tell a listener when a result arrives for the pending request", () => {
      const listener = jest.fn();
      subscribeIngredientScan(listener);
      const requestId = beginIngredientScan();

      finishIngredientScan(requestId, foodId);

      expect(listener).toHaveBeenCalledTimes(1);
    });

    it("should say nothing about a result that was ignored", () => {
      const listener = jest.fn();
      subscribeIngredientScan(listener);
      beginIngredientScan();

      finishIngredientScan("made-up", foodId);

      expect(listener).not.toHaveBeenCalled();
    });

    it("should stop telling a listener that unsubscribed", () => {
      const listener = jest.fn();
      const unsubscribe = subscribeIngredientScan(listener);
      const requestId = beginIngredientScan();

      unsubscribe();
      finishIngredientScan(requestId, foodId);

      expect(listener).not.toHaveBeenCalled();
    });
  });
});
