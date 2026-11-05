// A tool is defined once, here, and run by one executor whichever transport calls it (the `mcp`
// function or the in-process loop). The definition carries its zod input, which is rendered to the
// strict JSON Schema the model sees and is the schema every call is validated with.
import { toJSONSchema } from "zod";

import type { Database } from "../core/database.types.ts";
import type { ReportError } from "../report.ts";
import type { RecipeImportServices } from "./recipeParse.ts";
import type { ActionRecord, ActionStore, ActionTarget } from "./store.ts";
import type { JsonValue } from "./untrusted.ts";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { ZodType } from "zod";

// The MCP annotations. A read is `readOnlyHint: true`. `destructiveHint` is meaningful for a write.
export type ToolAnnotations = { readOnlyHint: boolean; destructiveHint?: boolean };

export type ToolTurn = {
  id: string;
  conversationId: string;
  // The text of the message that started the turn. Null when the turn has none, and then no write runs.
  userMessageText: string | null;
  // The person's own words: the last block of their stored message, when that block is text. Never the
  // context block or a tool result. Null when the turn has none, and then nothing can confirm a write.
  personsWords: string | null;
  // The day the turn's sheet was opened on, and the hour the Describe sheet knows, if any. A write
  // defaults to them when the person names no day or time.
  localDate: string;
  localTime: string | null;
};

export type ToolContext = {
  // Acts as the caller under their JWT, so row-level security scopes every query.
  caller: SupabaseClient<Database>;
  // The only holder of the service client: ids-only rows of `assistant_actions` and the turn's
  // pending confirmation.
  actions: ActionStore;
  userId: string;
  turn: ToolTurn;
  registry: ToolRegistry;
  // The tools this turn may call, chosen in code before the model ran. Undefined refuses every tool.
  allowedTools: ReadonlySet<string> | undefined;
  reportError: ReportError;
  // The page fetch and the parse call of `import_recipe_from_url`. Only the `mcp` function sets it, so no
  // other tool reaches the network, and a context without it answers that tool `tool_failed`.
  recipeImport?: RecipeImportServices;
};

export type ToolRunOutput = {
  // What the model reads. It is minimised and wrapped as untrusted data.
  data: JsonValue;
  // What only the turn loop reads (card, citation, status hint). It never reaches the model.
  structured?: JsonValue;
};

export type WriteRunOutput = ToolRunOutput & {
  // What the write changed, or null when it changed nothing, and then no action is recorded.
  target: ActionTarget | null;
};

// False asks nothing. Otherwise the tool gives the board's words for the call, built from its own rows with
// the same core functions the buttons use: the `question` the app shows when the model wrote none, the
// `confirmLabel` of the button that confirms, and a `note` line the turn loop adds after the question.
export type ConfirmationNeed = false | { question: string; confirmLabel: string; note?: string };

export type InverseOutcome = "undone" | "unavailable";

type ToolBase<Input> = {
  name: string;
  description: string;
  input: ZodType<Input>;
  annotations: ToolAnnotations;
  // Whether the Messages API holds the model to the schema. Strict by default. The API caps the strict
  // tools of a request at 20 and their optional and union parameters at 24 and 16 (see `strictLimits` in
  // `registry.test.ts`), so a tool with many nullable fields opts out with `false`. The executor
  // validates every input with zod whatever this says.
  strict?: boolean;
};

// Methods and not function properties, so a tool of one input type is a tool of the registry's list.
export type ReadToolDefinition<Input = unknown> = ToolBase<Input> & {
  kind: "read";
  run(ctx: ToolContext, input: Input): Promise<ToolRunOutput>;
};

export type WriteToolDefinition<Input = unknown> = ToolBase<Input> & {
  kind: "write";
  // The table the write changes, recorded on its action.
  targetTable: string;
  // Present when the call can be destructive or bulk. An answer other than false asks for a confirmation
  // first, and carries the tool's own question. The turn loop shows the model's question when it wrote one
  // and this one when it did not. A `note` is one line the tool wrote from the person's own rows. The turn
  // loop adds it after the question, because the model words that question in the same response as the
  // call, before the tool has answered.
  needsConfirmation?(input: Input, ctx: ToolContext): ConfirmationNeed | Promise<ConfirmationNeed>;
  // Must not throw once its write has landed. A throw releases the slot and answers `tool_failed`, so
  // a write that landed and then threw would be retried by the model and done twice. Do the write
  // last, and return the target as soon as the write is done.
  run(ctx: ToolContext, input: Input): Promise<WriteRunOutput>;
  // Undo. Null says the write has no inverse in M8 (`update_entry`, `update_recipe`), so Undo answers
  // `undo_unavailable`. A tool that has one answers `unavailable` when the target changed since
  // `action.targetUpdatedAt`.
  inverse: ((ctx: ToolContext, action: ActionRecord) => Promise<InverseOutcome>) | null;
};

export type ToolDefinition<Input = unknown> =
  ReadToolDefinition<Input> | WriteToolDefinition<Input>;

export type ToolRegistry = {
  readonly list: readonly ToolDefinition[];
  get(name: string): ToolDefinition | undefined;
};

export type JsonSchemaObject = Record<string, unknown>;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const stringList = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];

function allowsNull(schema: unknown): boolean {
  if (!isRecord(schema)) {
    return false;
  }
  const type = schema["type"];
  const branches = schema["anyOf"];
  const choices = schema["enum"];
  return (
    type === "null" ||
    (Array.isArray(type) && type.includes("null")) ||
    schema["const"] === null ||
    (Array.isArray(choices) && choices.includes(null)) ||
    (Array.isArray(branches) && branches.some((branch) => allowsNull(branch)))
  );
}

// The keywords a strict tool schema does not accept. zod still enforces every one of them when the
// executor validates the input, so leaving them out of what the model sees loses no check.
const keywordsStrictSchemasRefuse: ReadonlySet<string> = new Set([
  "minimum",
  "maximum",
  "exclusiveMinimum",
  "exclusiveMaximum",
  "multipleOf",
  "minLength",
  "maxLength",
  "minItems",
  "maxItems",
  "pattern",
  "format",
]);

// The strict form of one schema node. Every object closes with `additionalProperties: false` and
// requires all of its properties, and a property that was optional becomes nullable, because a strict
// schema has no way to leave a property out.
function strictNode(node: unknown): unknown {
  if (!isRecord(node)) {
    return node;
  }
  const strict: Record<string, unknown> = Object.fromEntries(
    Object.entries(node).filter(
      ([keyword]) => keyword !== "$schema" && !keywordsStrictSchemasRefuse.has(keyword),
    ),
  );
  const nullableType = strict["type"];
  if (Array.isArray(nullableType) && nullableType.includes("null")) {
    // zod writes a nullable scalar as `type: [X, "null"]`. The strict form is always `anyOf`.
    const inner = Object.fromEntries(
      Object.entries(strict).filter(([keyword]) => keyword !== "type"),
    );
    const others = nullableType.filter((type) => type !== "null");
    return {
      anyOf: [
        strictNode(others.length === 1 ? { ...inner, type: others[0] } : inner),
        { type: "null" },
      ],
    };
  }
  if (isRecord(strict["properties"]) || strict["type"] === "object") {
    const properties = isRecord(strict["properties"]) ? strict["properties"] : {};
    const required = stringList(strict["required"]);
    strict["properties"] = Object.fromEntries(
      Object.entries(properties).map(([key, child]) => {
        const strictChild = strictNode(child);
        const nullable = !required.includes(key) && !allowsNull(strictChild);
        return [key, nullable ? { anyOf: [strictChild, { type: "null" }] } : strictChild];
      }),
    );
    strict["required"] = Object.keys(properties);
    strict["additionalProperties"] = false;
  }
  if (strict["items"] !== undefined) {
    strict["items"] = strictNode(strict["items"]);
  }
  for (const keyword of ["anyOf", "oneOf", "allOf"]) {
    const branches = strict[keyword];
    if (Array.isArray(branches)) {
      strict[keyword] = branches.map(strictNode);
    }
  }
  return strict;
}

// The first thing in an input schema that the renderer cannot make strict, or null. Tools use plain
// objects, arrays, enums, nullable and optional. A nullable value is the only union allowed.
function unsupportedFeature(node: unknown): string | null {
  if (!isRecord(node)) {
    return null;
  }
  if ("$ref" in node) {
    return "a recursive or shared schema";
  }
  if ("allOf" in node || "oneOf" in node) {
    return "an intersection or a union";
  }
  if ("prefixItems" in node || Array.isArray(node["items"])) {
    return "a tuple";
  }
  if ("propertyNames" in node || "patternProperties" in node) {
    return "a record";
  }
  const extra = node["additionalProperties"];
  if (extra === true || isRecord(extra)) {
    return "a record or a catchall";
  }
  const type = node["type"];
  const branches = node["anyOf"];
  if (Array.isArray(type) && !(type.length === 2 && type.includes("null"))) {
    return "a union";
  }
  if (
    Array.isArray(branches) &&
    !(branches.length === 2 && branches.filter((branch) => allowsNull(branch)).length === 1)
  ) {
    return "a union";
  }
  const children = [
    ...Object.values(isRecord(node["properties"]) ? node["properties"] : {}),
    node["items"],
    ...(Array.isArray(branches) ? branches : []),
  ];
  for (const child of children) {
    const found = unsupportedFeature(child);
    if (found !== null) {
      return found;
    }
  }
  return null;
}

// The schema as the tool author wrote it: optional properties are left out of `required`.
const authoredSchemas = new WeakMap<object, Record<string, unknown>>();

function authoredSchema(tool: ToolDefinition): Record<string, unknown> {
  const known = authoredSchemas.get(tool.input);
  if (known !== undefined) {
    return known;
  }
  const rendered = toJSONSchema(tool.input, { io: "input", reused: "inline" });
  authoredSchemas.set(tool.input, rendered);
  return rendered;
}

// A message that names the tool when its input schema holds something a strict schema cannot, or null.
export function strictSchemaProblem(tool: ToolDefinition): string | null {
  const feature = unsupportedFeature(authoredSchema(tool));
  return feature === null
    ? null
    : `Tool ${tool.name} has an input schema with ${feature}, which a strict tool schema cannot hold`;
}

// The strict JSON Schema of any zod input, made the way a tool's is: every nullable is `anyOf` with null, every
// object is closed with all its properties required, and the keywords a strict schema refuses are left out.
// For the structured output of a call that is not a tool call.
export function toStrictJsonSchema(input: ZodType): JsonSchemaObject {
  const strict = strictNode(toJSONSchema(input, { io: "input", reused: "inline" }));
  if (!isRecord(strict)) {
    throw new Error("The schema is not an object schema");
  }
  return strict;
}

// Where `tools/list` says whether a tool is strict, in the tool's `_meta`.
export const strictMetaKey = "kilo/strict";

export const confirmationIdKey = "confirmation_id";

const confirmationIdProperty = {
  anyOf: [{ type: "string" }, { type: "null" }],
  description:
    "The confirmation_id of an earlier needs_confirmation answer, once the user said yes.",
};

// The strict JSON Schema the model sees for the tool's input (`strict: true` on the Messages API).
export function toJsonSchema(tool: ToolDefinition): JsonSchemaObject {
  const strict = strictNode(authoredSchema(tool));
  if (!isRecord(strict)) {
    throw new Error(`The input of ${tool.name} is not an object schema`);
  }
  if (tool.kind !== "write" || tool.needsConfirmation === undefined) {
    return strict;
  }
  const properties = isRecord(strict["properties"]) ? strict["properties"] : {};
  return {
    ...strict,
    properties: { ...properties, [confirmationIdKey]: confirmationIdProperty },
    required: [...stringList(strict["required"]), confirmationIdKey],
  };
}

// A model that is told every property is required sends null for the ones it has no value for. Only a
// null at an optional property that does not accept null is dropped, so a nullable field keeps its null.
function withoutNullOptionals(schema: unknown, value: unknown): unknown {
  if (!isRecord(schema)) {
    return value;
  }
  // A nullable object or array is `anyOf` of that schema and null, so look inside the one other branch.
  const branches = schema["anyOf"];
  if (Array.isArray(branches)) {
    const nonNull = branches.filter((branch) => !allowsNull(branch));
    const [only] = nonNull;
    return nonNull.length === 1 && value !== null ? withoutNullOptionals(only, value) : value;
  }
  if (Array.isArray(value)) {
    return value.map((item) => withoutNullOptionals(schema["items"], item));
  }
  const properties = schema["properties"];
  if (isRecord(value) && isRecord(properties)) {
    const required = stringList(schema["required"]);
    return Object.fromEntries(
      Object.entries(value).flatMap(([key, child]) => {
        const childSchema = properties[key];
        if (child === null && !required.includes(key) && !allowsNull(childSchema)) {
          return [];
        }
        return [[key, withoutNullOptionals(childSchema, child)]];
      }),
    );
  }
  return value;
}

export type ParsedToolInput<Input> =
  { success: true; data: Input } | { success: false; fields: string[] };

// Validates a raw input against the tool's zod schema. A failure names the fields and nothing else,
// because an issue message can quote the value, and the value can be health data.
export function parseToolInput<Input>(
  tool: ToolDefinition<Input>,
  rawInput: unknown,
): ParsedToolInput<Input> {
  const result = tool.input.safeParse(withoutNullOptionals(authoredSchema(tool), rawInput));
  if (result.success) {
    return { success: true, data: result.data };
  }
  const fields = result.error.issues
    .map((issue) => issue.path.map(String).join("."))
    .filter((field) => field !== "");
  return { success: false, fields: [...new Set(fields)] };
}
