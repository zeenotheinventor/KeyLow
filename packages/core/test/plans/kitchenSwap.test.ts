import { describe, expect, it } from "vitest";

import { KITCHEN_RANKINGS, KITCHEN_START_DATES, kitchenInput } from "./kitchenWeek";
import { planMeals } from "../../src/plans";

describe("the kitchen week with recipes that overshoot", () => {
  const cases = Object.keys(KITCHEN_RANKINGS).flatMap((ranking) =>
    KITCHEN_START_DATES.map((start) => ({ ranking, start })),
  );

  it.each(cases)(
    "should plan every day within tolerance with $ranking from $start",
    ({ ranking, start }) => {
      const plan = planMeals(kitchenInput(start, KITCHEN_RANKINGS[ranking] ?? []));

      expect(
        plan.days
          .filter((day) => day.status === "short")
          .map((day) => [day.localDate, day.shortfalls]),
      ).toEqual([]);
    },
  );
});
