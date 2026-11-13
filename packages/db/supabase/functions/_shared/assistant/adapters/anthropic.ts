// The only file that knows the Messages API's tool shape. It turns the tools the MCP client listed into
// client tools for the Messages API, and a second model API gets a second file like this one. The order of
// the list and the order of the keys are part of the prompt cache's prefix, so neither is ever changed here.
import type { ListedTool } from "../mcpClient.ts";
import type { JsonSchemaObject } from "../tool.ts";

export type AnthropicTool = {
  name: string;
  description: string;
  input_schema: JsonSchemaObject;
  // Grammar-constrained input, which needs additionalProperties false at every level. Left out for a
  // tool that opted out, because the API caps strict tools, optional and union parameters per request.
  strict?: true;
  eager_input_streaming: true;
  // A tool of the kitchen group starts hidden: it is known to the request and not shown to the model until a
  // `tool_addition` surfaces it (ADR 0006, Amendment 5). Only those tools carry the key, and it is the last key,
  // so every other tool's bytes are what they were.
  defer_loading?: true;
};

// A schema the registry should never have let through. It is a bug, so it is thrown and never sent.
export class ToolSchemaInvalidError extends Error {
  readonly code = "tool_schema_invalid";

  constructor(toolName: string, place: string) {
    super(`Tool ${toolName} has an object schema without additionalProperties false at ${place}`);
    this.name = "ToolSchemaInvalidError";
  }
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

function isObjectSchema(schema: Record<string, unknown>): boolean {
  const type = schema["type"];
  return (
    type === "object" || (Array.isArray(type) && type.includes("object")) || "properties" in schema
  );
}

function childrenOf(schema: Record<string, unknown>, place: string): [string, unknown][] {
  const children: [string, unknown][] = [];
  for (const keyword of ["properties", "$defs", "definitions"]) {
    const named = schema[keyword];
    if (isRecord(named)) {
      for (const [key, child] of Object.entries(named)) {
        children.push([`${place}.${keyword}.${key}`, child]);
      }
    }
  }
  const items = schema["items"];
  for (const child of Array.isArray(items) ? items : [items]) {
    children.push([`${place}.items`, child]);
  }
  for (const keyword of ["anyOf", "oneOf", "allOf", "prefixItems"]) {
    const branches = schema[keyword];
    if (Array.isArray(branches)) {
      branches.forEach((child, index) => children.push([`${place}.${keyword}[${index}]`, child]));
    }
  }
  return children;
}

// The place of the first object schema that is not closed, or null.
function firstOpenObject(schema: unknown, place: string): string | null {
  if (!isRecord(schema)) {
    return null;
  }
  if (isObjectSchema(schema) && schema["additionalProperties"] !== false) {
    return place;
  }
  for (const [childPlace, child] of childrenOf(schema, place)) {
    const found = firstOpenObject(child, childPlace);
    if (found !== null) {
      return found;
    }
  }
  return null;
}

// A strict tool sets both `strict` and `eager_input_streaming`, as the ticket asks. The Messages API docs do not say
// the two cannot be combined and the tool reference says the properties compose, but no request has been
// sent with both yet, so the first live run (KEY-682) confirms it. If the API refuses, drop the second.
export function toAnthropicTools(tools: readonly ListedTool[]): AnthropicTool[] {
  return tools.map((tool) => {
    const openPlace = firstOpenObject(tool.inputSchema, "input_schema");
    if (openPlace !== null) {
      throw new ToolSchemaInvalidError(tool.name, openPlace);
    }
    return {
      name: tool.name,
      description: tool.description,
      input_schema: tool.inputSchema,
      ...(tool.strict ? { strict: true as const } : {}),
      eager_input_streaming: true,
      ...(tool.group === undefined ? {} : { defer_loading: true as const }),
    };
  });
}
