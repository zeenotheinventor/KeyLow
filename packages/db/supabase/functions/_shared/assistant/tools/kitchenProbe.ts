// A test-only tool of the hidden kitchen group (ADR 0006, Amendment 5). It proves on a live stack that the API
// takes a deferred tool and a `tool_addition`, and that a second kitchen turn reads the prompt cache. It is
// listed only when the function secret ASSISTANT_KITCHEN_PROBE is 1, and the real kitchen tools replace it.
// Nothing here reads or writes the database.
import { z } from "zod";

import type { ReadToolDefinition } from "../tool.ts";

export const kitchenProbeTool: ReadToolDefinition<Record<string, never>> = {
  name: "kitchen_probe",
  description: "Test only. Answers ok. Call it when the person asks to probe the kitchen tools.",
  kind: "read",
  group: "kitchen",
  input: z.strictObject({}),
  annotations: { readOnlyHint: true },
  run: () => Promise.resolve({ data: { status: "ok" } }),
};
