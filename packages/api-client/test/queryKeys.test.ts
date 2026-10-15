import { describe, expect, it } from "vitest";

import { keys } from "../src/queryKeys";

describe("keys.profiles", () => {
  it("should expose the profiles root key", () => {
    expect(keys.profiles.all).toEqual(["profiles"]);
  });

  it("should build a detail key scoped to the profile id", () => {
    expect(keys.profiles.detail("user-1")).toEqual(["profiles", "user-1"]);
  });

  it("should expose a key for the signed in user's terms acceptance, under the profiles root", () => {
    expect(keys.profiles.termsAcceptance).toEqual(["profiles", "terms-acceptance"]);
  });

  it("should expose keys for the signed in user's targets and time zone, under the profiles root", () => {
    expect(keys.profiles.targets).toEqual(["profiles", "targets"]);
    expect(keys.profiles.timeZone).toEqual(["profiles", "time-zone"]);
  });
});

describe("keys.foods", () => {
  it("should expose the foods root key", () => {
    expect(keys.foods.all).toEqual(["foods"]);
  });

  it("should build a detail key scoped to the food id", () => {
    expect(keys.foods.detail("food-1")).toEqual(["foods", "food-1"]);
  });

  it("should build a portions key nested under the food detail key", () => {
    expect(keys.foods.portions("food-1")).toEqual(["foods", "food-1", "portions"]);
  });

  it("should build a search key scoped to the query text", () => {
    expect(keys.foods.search("chicken")).toEqual(["foods", "search", "chicken"]);
  });

  it("should build an Open Food Facts search key scoped to the query text", () => {
    expect(keys.foods.offSearch("chicken")).toEqual(["foods", "off-search", "chicken"]);
  });

  it("should build a barcode key scoped to the code", () => {
    expect(keys.foods.barcode("0036000291452")).toEqual(["foods", "barcode", "0036000291452"]);
  });

  it("should expose a key for the list of the user's own foods", () => {
    expect(keys.foods.own).toEqual(["foods", "own"]);
  });

  it("should nest every foods key under the foods root so one invalidation covers them all", () => {
    const rootLength = keys.foods.all.length;

    for (const key of [
      keys.foods.detail("food-1"),
      keys.foods.portions("food-1"),
      keys.foods.search("chicken"),
      keys.foods.offSearch("chicken"),
      keys.foods.barcode("0036000291452"),
      keys.foods.own,
    ]) {
      expect(key.slice(0, rootLength)).toEqual(keys.foods.all);
    }
  });
});

describe("keys.diary", () => {
  it("should expose the diary root key", () => {
    expect(keys.diary.all).toEqual(["diary"]);
  });

  it("should build a day key scoped to the local date", () => {
    expect(keys.diary.day("2026-10-15")).toEqual(["diary", "day", "2026-10-15"]);
  });

  it("should build a week key scoped to the Monday", () => {
    expect(keys.diary.week("2026-10-12")).toEqual(["diary", "week", "2026-10-12"]);
  });

  it("should build a complete days key scoped to the month", () => {
    expect(keys.diary.completeDays("2026-10")).toEqual(["diary", "complete-days", "2026-10"]);
  });

  it("should expose a key for the recent foods", () => {
    expect(keys.diary.recentFoods).toEqual(["diary", "recent-foods"]);
  });

  it("should expose the prefix of every day key and of every week key, for invalidating them all", () => {
    expect(keys.diary.days).toEqual(["diary", "day"]);
    expect(keys.diary.weeks).toEqual(["diary", "week"]);
    expect(keys.diary.day("2026-10-15").slice(0, 2)).toEqual(keys.diary.days);
    expect(keys.diary.week("2026-10-12").slice(0, 2)).toEqual(keys.diary.weeks);
  });

  it("should nest every diary key under the diary root so one invalidation covers them all", () => {
    for (const key of [
      keys.diary.day("2026-10-15"),
      keys.diary.week("2026-10-12"),
      keys.diary.completeDays("2026-10"),
      keys.diary.recentFoods,
    ]) {
      expect(key.slice(0, 1)).toEqual(keys.diary.all);
    }
  });
});
