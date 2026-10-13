import { describe, expect, it } from "vitest";

import * as apiClient from "../src";

describe("the package index", () => {
  it.each(["listOwnFoods", "useDebouncedValue", "useFoodWithPortions", "useOwnFoods"])(
    "should export %s",
    (name) => {
      expect(apiClient).toHaveProperty(name);
    },
  );
});
