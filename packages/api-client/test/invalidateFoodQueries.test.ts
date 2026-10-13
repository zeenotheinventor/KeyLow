import { describe, expect, it } from "vitest";

import { invalidateFoodQueries } from "../src/invalidateFoodQueries";
import { keys } from "../src/queryKeys";
import { createQueryClient } from "./support/queryClients";

const seeded = {
  detail: keys.foods.detail("food-1"),
  portions: keys.foods.portions("food-1"),
  search: keys.foods.search("chicken"),
  barcode: keys.foods.barcode("5000000000017"),
  own: keys.foods.own,
  offSearch: keys.foods.offSearch("chicken"),
};

describe("invalidateFoodQueries", () => {
  it("should invalidate every foods query except the Open Food Facts searches", async () => {
    const queryClient = createQueryClient();
    for (const key of Object.values(seeded)) {
      queryClient.setQueryData(key, []);
    }
    queryClient.setQueryData(keys.profiles.all, []);

    await invalidateFoodQueries(queryClient);

    const isInvalidated = (key: readonly unknown[]) =>
      queryClient.getQueryState(key)?.isInvalidated;
    expect(isInvalidated(seeded.detail)).toBe(true);
    expect(isInvalidated(seeded.portions)).toBe(true);
    expect(isInvalidated(seeded.search)).toBe(true);
    expect(isInvalidated(seeded.barcode)).toBe(true);
    expect(isInvalidated(seeded.own)).toBe(true);
    expect(isInvalidated(seeded.offSearch)).toBe(false);
    expect(isInvalidated(keys.profiles.all)).toBe(false);
  });
});
