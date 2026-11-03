import { assertEquals, assertThrows } from "@std/assert";

import { toolRegistry } from "../registry.ts";
import { toJsonSchema } from "../tool.ts";
import { ToolSchemaInvalidError, toAnthropicTools } from "./anthropic.ts";

import type { ListedTool } from "../mcpClient.ts";

const tools: ListedTool[] = toolRegistry.list.map((tool) => ({
  name: tool.name,
  description: tool.description,
  inputSchema: toJsonSchema(tool),
  readOnlyHint: tool.annotations.readOnlyHint,
  strict: tool.strict !== false,
}));

function toolWith(inputSchema: ListedTool["inputSchema"]): ListedTool {
  return {
    name: "shaped",
    description: "A shaped tool.",
    inputSchema,
    readOnlyHint: true,
    strict: true,
  };
}

Deno.test(
  "a strict tool says strict and a tool that opted out leaves the field out, in the same key order",
  () => {
    const [strictTool, plainTool] = toAnthropicTools([
      toolWith({ type: "object", properties: {}, additionalProperties: false }),
      {
        ...toolWith({ type: "object", properties: {}, additionalProperties: false }),
        strict: false,
      },
    ]);

    assertEquals(Object.keys(strictTool ?? {}), [
      "name",
      "description",
      "input_schema",
      "strict",
      "eager_input_streaming",
    ]);
    assertEquals(Object.keys(plainTool ?? {}), [
      "name",
      "description",
      "input_schema",
      "eager_input_streaming",
    ]);
  },
);

Deno.test(
  "every tool that did not opt out is strict, in the order of the list, with the Messages API field names",
  () => {
    const converted = toAnthropicTools(tools);

    assertEquals(
      converted.map((tool) => tool.name),
      tools.map((tool) => tool.name),
    );
    assertEquals(converted[0], {
      name: tools[0]?.name,
      description: tools[0]?.description,
      input_schema: tools[0]?.inputSchema,
      strict: true,
      eager_input_streaming: true,
    });
    assertEquals(
      converted.map((tool) => tool.strict === true),
      tools.map((tool) => tool.strict),
    );
  },
);

Deno.test("two conversions of the same list serialise to the same bytes", () => {
  assertEquals(
    JSON.stringify(toAnthropicTools(tools)),
    JSON.stringify(toAnthropicTools([...tools])),
  );
});

Deno.test("the keys of a tool come out in one fixed order", () => {
  const [first] = toAnthropicTools(tools);

  assertEquals(Object.keys(first ?? {}), [
    "name",
    "description",
    "input_schema",
    "strict",
    "eager_input_streaming",
  ]);
});

Deno.test("a schema without additionalProperties false at the top is tool_schema_invalid", () => {
  const error = assertThrows(
    () => toAnthropicTools([toolWith({ type: "object", properties: {} })]),
    ToolSchemaInvalidError,
  );

  assertEquals(error.code, "tool_schema_invalid");
});

Deno.test("a nested object without additionalProperties false is tool_schema_invalid", () => {
  const closed = { type: "object", properties: {}, additionalProperties: false };
  const open = { type: "object", properties: {} };
  const shapes: Record<string, ListedTool["inputSchema"]> = {
    property: { ...closed, properties: { child: open } },
    "array items": { ...closed, properties: { rows: { type: "array", items: open } } },
    "nullable branch": { ...closed, properties: { child: { anyOf: [open, { type: "null" }] } } },
    definition: { ...closed, $defs: { shared: open } },
  };

  for (const [where, schema] of Object.entries(shapes)) {
    const error = assertThrows(
      () => toAnthropicTools([toolWith(schema)]),
      ToolSchemaInvalidError,
      "shaped",
    );
    assertEquals(error.code, "tool_schema_invalid", where);
  }
});

Deno.test("the error names the tool and the place, and holds no schema value", () => {
  const error = assertThrows(
    () =>
      toAnthropicTools([
        toolWith({
          type: "object",
          properties: { child: { type: "object", description: "secret words" } },
          additionalProperties: false,
        }),
      ]),
    ToolSchemaInvalidError,
  );

  assertEquals(
    error.message,
    "Tool shaped has an object schema without additionalProperties false at input_schema.properties.child",
  );
});

Deno.test("closed nested objects, arrays and nullable branches are accepted", () => {
  const closed = { type: "object", properties: {}, additionalProperties: false };

  const converted = toAnthropicTools([
    toolWith({
      ...closed,
      properties: {
        child: closed,
        rows: { type: "array", items: closed },
        maybe: { anyOf: [closed, { type: "null" }] },
        note: { type: "string" },
      },
    }),
  ]);

  assertEquals(converted.length, 1);
});
