// The foods, portions and context the diary write tools' tests share. Nothing in production imports this.
import { createFakeContext, userId } from "../testing.ts";
import { writeStub } from "./writeStub.ts";

import type { ExecutionResult } from "../executor.ts";
import type { ToolContext, ToolDefinition } from "../tool.ts";
import type { RpcHandler } from "./writeStub.ts";

export const eggId = "00000000-0000-4000-8000-0000000000e1";
export const largeEggId = "00000000-0000-4000-8000-0000000000e2";
export const toastId = "00000000-0000-4000-8000-0000000000f1";
export const sliceId = "00000000-0000-4000-8000-0000000000f2";
export const deletedFoodId = "00000000-0000-4000-8000-0000000000d1";

export const foodRow = (overrides: Record<string, unknown>) => ({
  source: "user",
  source_ref: null,
  owner_id: userId,
  brand: null,
  barcode: null,
  basis: "per_100g",
  density_g_per_ml: null,
  sat_fat_g: null,
  sugars_g: null,
  fibre_g: null,
  salt_g: null,
  micros: {},
  quality: {},
  food_group: null,
  fetched_at: null,
  deleted_at: null,
  created_at: "2026-10-07T10:00:00+00:00",
  ...overrides,
});

export const portionRow = (id: string, foodId: string, label: string, grams: number) => ({
  id,
  food_id: foodId,
  owner_id: null,
  label,
  grams,
  ml: null,
  is_default: false,
  position: 0,
  created_at: "2026-10-07T10:00:00+00:00",
});

// The figures are per 100 g, chosen so two large eggs and a slice of toast are the board's 144 and 88 kcal.
export const dietRows = () => ({
  foods: [
    foodRow({
      id: eggId,
      name: "Egg, boiled",
      kcal: 144,
      protein_g: 12.6,
      fat_g: 9.5,
      carbs_g: 0.8,
    }),
    foodRow({
      id: toastId,
      name: "Toast, white bread",
      kcal: 293.3333,
      protein_g: 9.3333,
      fat_g: 3,
      carbs_g: 54.6667,
    }),
    foodRow({
      id: deletedFoodId,
      name: "Old food",
      kcal: 100,
      protein_g: 1,
      fat_g: 1,
      carbs_g: 1,
      deleted_at: "2026-10-08T10:00:00+00:00",
    }),
  ],
  food_portions: [
    portionRow(largeEggId, eggId, "large egg", 50),
    portionRow(sliceId, toastId, "slice", 30),
  ],
  profiles: [{ timezone: "Europe/London" }],
});

// A context for the tools in one registry whose caller is the in-memory diary, in the turn of 3 November.
export function writeContext(
  tools: readonly ToolDefinition[],
  options: {
    localTime?: string | null;
    rows?: Record<string, Record<string, unknown>[]>;
    rpc?: Record<string, RpcHandler>;
  } = {},
) {
  const stub = writeStub(
    { ...dietRows(), ...options.rows },
    { callerUserId: userId, ...(options.rpc === undefined ? {} : { rpc: options.rpc }) },
  );
  const made = createFakeContext(tools, {
    localDate: "2026-11-03",
    localTime: options.localTime === undefined ? "08:10" : options.localTime,
  });
  const ctx: ToolContext = { ...made.ctx, caller: stub.caller };
  return { ...made, ctx, stub };
}

// The structured outcome of a landed write, which only the turn loop reads.
export function structuredOf(result: ExecutionResult): Record<string, unknown> {
  const structured = result.status === "ok" ? result.structured : null;
  return typeof structured === "object" && structured !== null && !Array.isArray(structured)
    ? structured
    : {};
}

// Stops the clock at the given instant for the rest of the test file, so a tool that reads "now" (the
// person's today) answers the same on every day the suite runs. Deno runs each test file in its own
// isolate, so this reaches no other file.
export function fixClock(instant: string): void {
  const RealDate = Date;
  const fixed = RealDate.parse(instant);
  class FixedDate extends RealDate {
    constructor(...args: unknown[]) {
      // The constructor's overloads are not expressible as a spread, so the arguments pass through whole.
      // deno-lint-ignore no-explicit-any
      super(...((args.length === 0 ? [fixed] : args) as [any]));
    }
    static override now(): number {
      return fixed;
    }
  }
  globalThis.Date = FixedDate as DateConstructor;
}
