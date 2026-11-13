import { assertEquals } from "@std/assert";

import { executeTool } from "../executor.ts";
import { createFakeContext } from "../testing.ts";
import { toJsonSchema } from "../tool.ts";
import { kitchenProbeTool } from "./kitchenProbe.ts";
import { payloadOf } from "./testing.ts";

Deno.test("the kitchen probe is a read of the kitchen group that takes no input", () => {
  assertEquals(kitchenProbeTool.kind, "read");
  assertEquals(kitchenProbeTool.group, "kitchen");
  assertEquals(toJsonSchema(kitchenProbeTool)["properties"], {});
});

Deno.test("the kitchen probe answers ok through the executor and reads nothing", async () => {
  const { ctx } = createFakeContext([kitchenProbeTool]);

  const result = await executeTool(ctx, "kitchen_probe", {});

  assertEquals(result.status, "ok");
  assertEquals(payloadOf(result), { status: "ok" });
});
