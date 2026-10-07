import { describe, expectTypeOf, it } from "vitest";

import type { Database } from "../../src/database.types";
import type { Food } from "@keylow/core/schemas";
import type { Json } from "@keylow/db";

type FoodsRow = Database["public"]["Tables"]["foods"]["Row"];

// These assertions are checked by `tsc` (the package's typecheck script), not at runtime.
describe("foodRowSchema output versus the generated foods row", () => {
  it("should agree on every column except the Json columns and the database-only search column", () => {
    expectTypeOf<Omit<Food, "micros" | "quality">>().toEqualTypeOf<
      Omit<FoodsRow, "micros" | "quality" | "search">
    >();
  });

  it("should store micros as Json", () => {
    expectTypeOf<Food["micros"]>().toExtend<Json>();
  });

  it("should store quality as Json", () => {
    expectTypeOf<Food["quality"]>().toExtend<Json>();
  });
});
