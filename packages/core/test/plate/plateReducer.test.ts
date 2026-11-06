import { describe, expect, it } from "vitest";

import { banana, greekYoghurt } from "./sample";
import { plateItemOfHit, plateReducer, startingPlate } from "../../src/plate";

import type { PlateItem, PlateState } from "../../src/plate";

const NOW = { isNow: true } as const;
const yoghurt = (key: string) => plateItemOfHit(key, greekYoghurt);
const bananaRow = (key: string) => plateItemOfHit(key, banana);
const keysOf = (state: PlateState) => state.items.map((item: PlateItem) => item.key);

const withBoth = (): PlateState =>
  plateReducer(plateReducer(startingPlate(NOW), { type: "add", item: yoghurt("a") }), {
    type: "add",
    item: bananaRow("b"),
  });

describe("startingPlate", () => {
  it("should be empty, with nothing to restore and nothing added, at the time given", () => {
    expect(startingPlate({ isNow: false, time: "12:00" })).toEqual({
      items: [],
      cleared: [],
      time: { isNow: false, time: "12:00" },
      addCount: 0,
    });
  });
});

describe("plateReducer", () => {
  describe("add", () => {
    it("should put the item on the plate and count the add", () => {
      const state = plateReducer(startingPlate(NOW), { type: "add", item: yoghurt("a") });

      expect(keysOf(state)).toEqual(["a"]);
      expect(state.addCount).toBe(1);
    });

    it("should merge the same food in the same unit and still count the add", () => {
      const state = plateReducer(withBoth(), { type: "add", item: yoghurt("c") });

      expect(keysOf(state)).toEqual(["a", "b"]);
      expect(state.items[0]).toMatchObject({ quantity: 2 });
      expect(state.addCount).toBe(3);
    });
  });

  describe("setQuantity", () => {
    it("should set what the row's field holds and what it reads as", () => {
      const state = plateReducer(withBoth(), { type: "setQuantity", key: "a", text: "3" });

      expect(state.items[0]).toMatchObject({ quantityText: "3", quantity: 3 });
    });

    it("should not count as an add", () => {
      const state = plateReducer(withBoth(), { type: "setQuantity", key: "a", text: "3" });

      expect(state.addCount).toBe(2);
    });
  });

  describe("replace", () => {
    it("should swap the row in place, keeping its key and its place", () => {
      const state = plateReducer(withBoth(), { type: "replace", key: "a", item: bananaRow("a") });

      expect(keysOf(state)).toEqual(["a", "b"]);
      expect(state.items.map((item) => (item.kind === "food" ? item.name : ""))).toEqual([
        "Banana",
        "Banana",
      ]);
    });
    it("should replace the row the action names, whatever key the new item carries", () => {
      const state = plateReducer(withBoth(), { type: "replace", key: "a", item: bananaRow("z") });

      expect(keysOf(state)).toEqual(["a", "b"]);
      expect(state.items.map((item) => (item.kind === "food" ? item.name : ""))).toEqual([
        "Banana",
        "Banana",
      ]);
    });
  });

  describe("remove", () => {
    it("should take the row off the plate", () => {
      const state = plateReducer(withBoth(), { type: "remove", key: "a" });

      expect(keysOf(state)).toEqual(["b"]);
    });
  });

  describe("clear and restore", () => {
    it("should empty the plate and keep what was on it", () => {
      const state = plateReducer(withBoth(), { type: "clear" });

      expect(state.items).toEqual([]);
      expect(state.cleared.map((item) => item.key)).toEqual(["a", "b"]);
    });

    it("should not lose what the first clear kept when the plate is cleared again", () => {
      const cleared = plateReducer(withBoth(), { type: "clear" });

      const clearedTwice = plateReducer(cleared, { type: "clear" });

      expect(clearedTwice).toBe(cleared);
    });

    it("should put back what a clear took away, and keep nothing to restore", () => {
      const state = plateReducer(plateReducer(withBoth(), { type: "clear" }), {
        type: "restore",
      });

      expect(keysOf(state)).toEqual(["a", "b"]);
      expect(state.cleared).toEqual([]);
    });
  });

  describe("setTime", () => {
    it("should set when the plate is logged and leave the rows alone", () => {
      const before = withBoth();

      const state = plateReducer(before, {
        type: "setTime",
        time: { isNow: false, time: "19:20" },
      });

      expect(state.time).toEqual({ isNow: false, time: "19:20" });
      expect(state.items).toBe(before.items);
    });
  });
});
