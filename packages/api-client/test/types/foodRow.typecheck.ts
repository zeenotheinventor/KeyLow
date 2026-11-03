import { expectTypeOf } from "vitest";

import type { Database } from "../../src/database.types";
import type { Food } from "@keylow/core/schemas";
import type { Json } from "@keylow/db";

type FoodsRow = Database["public"]["Tables"]["foods"]["Row"];

// These assertions are checked by `tsc` (the package's typecheck script), not at runtime.

// foodRowSchema output versus the generated foods row: every column agrees except the Json columns and
// the database-only search column.
expectTypeOf<Omit<Food, "micros" | "quality">>().toEqualTypeOf<
  Omit<FoodsRow, "micros" | "quality" | "search">
>();

// micros and quality are stored as Json.
expectTypeOf<Food["micros"]>().toExtend<Json>();
expectTypeOf<Food["quality"]>().toExtend<Json>();
