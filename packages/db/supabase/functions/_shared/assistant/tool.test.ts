import { assert, assertEquals, assertFalse, assertObjectMatch } from "@std/assert";
import { z } from "zod";

import { parseToolInput, toJsonSchema } from "./tool.ts";

import type { ReadToolDefinition, WriteToolDefinition } from "./tool.ts";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

// What the Messages API asks of a `strict: true` tool schema, as far as the guide for strict tool
// use sets it out: every object closes with `additionalProperties: false` and lists all of its
// properties as required, and there are no references to resolve. Returns the problems found.
function strictSchemaProblems(schema: unknown, path = "$"): string[] {
  if (!isRecord(schema)) {
    return [`${path} is not an object`];
  }
  const problems: string[] = [];
  if ("$schema" in schema || "$ref" in schema) {
    problems.push(`${path} holds $schema or $ref`);
  }
  if (schema["type"] === "object") {
    const properties = isRecord(schema["properties"]) ? schema["properties"] : {};
    if (schema["additionalProperties"] !== false) {
      problems.push(`${path} does not set additionalProperties: false`);
    }
    const required = Array.isArray(schema["required"]) ? [...schema["required"]].sort() : [];
    if (JSON.stringify(required) !== JSON.stringify(Object.keys(properties).sort())) {
      problems.push(`${path} does not require every property`);
    }
    for (const [key, child] of Object.entries(properties)) {
      problems.push(...strictSchemaProblems(child, `${path}.${key}`));
    }
  }
  if (schema["items"] !== undefined) {
    problems.push(...strictSchemaProblems(schema["items"], `${path}[]`));
  }
  for (const keyword of ["anyOf", "oneOf", "allOf"]) {
    const branches = schema[keyword];
    if (Array.isArray(branches)) {
      branches.forEach((branch, index) =>
        problems.push(...strictSchemaProblems(branch, `${path}.${keyword}[${index}]`)),
      );
    }
  }
  return problems;
}

const fixtureInput = z.object({
  foodId: z.string(),
  meal: z.enum(["breakfast", "lunch", "dinner", "snack"]),
  note: z.string().optional(),
  portion: z.object({
    grams: z.number(),
    label: z.string().optional(),
  }),
  tags: z.array(z.object({ name: z.string(), weight: z.number().optional() })),
});

type FixtureInput = z.infer<typeof fixtureInput>;

const fixtureRead: ReadToolDefinition<FixtureInput> = {
  name: "fixture_read",
  description: "A fixture.",
  kind: "read",
  input: fixtureInput,
  annotations: { readOnlyHint: true },
  run: () => Promise.resolve({ data: null }),
};

const fixtureWrite: WriteToolDefinition<FixtureInput> = {
  name: "fixture_write",
  description: "A fixture.",
  kind: "write",
  input: fixtureInput,
  annotations: { readOnlyHint: false, destructiveHint: false },
  targetTable: "log_entries",
  needsConfirmation: () => ({ question: "Do it?", confirmLabel: "Do it" }),
  inverse: null,
  run: () => Promise.resolve({ data: null, target: null }),
};

Deno.test("the schema is strict at every level of a nested fixture", () => {
  const schema = toJsonSchema(fixtureRead);

  assertEquals(strictSchemaProblems(schema), []);
});

Deno.test("an optional field is rendered required and nullable", () => {
  const schema = toJsonSchema(fixtureRead);

  assertObjectMatch(schema, {
    properties: { note: { anyOf: [{ type: "string" }, { type: "null" }] } },
  });
  assert(Array.isArray(schema["required"]) && schema["required"].includes("note"));
});

Deno.test("an optional field inside a nested object and inside an array is nullable too", () => {
  const schema = toJsonSchema(fixtureRead);

  assertObjectMatch(schema, {
    properties: {
      portion: { properties: { label: { anyOf: [{ type: "string" }, { type: "null" }] } } },
      tags: {
        type: "array",
        items: { properties: { weight: { anyOf: [{ type: "number" }, { type: "null" }] } } },
      },
    },
  });
});

Deno.test("an enum keeps its values and a required field is not made nullable", () => {
  const schema = toJsonSchema(fixtureRead);

  assertObjectMatch(schema, {
    properties: {
      meal: { type: "string", enum: ["breakfast", "lunch", "dinner", "snack"] },
      foodId: { type: "string" },
    },
  });
});

Deno.test("a write tool that can need a confirmation takes a nullable confirmation_id", () => {
  const schema = toJsonSchema(fixtureWrite);

  assertEquals(strictSchemaProblems(schema), []);
  assertObjectMatch(schema, {
    properties: { confirmation_id: { anyOf: [{ type: "string" }, { type: "null" }] } },
  });
  const readProperties = toJsonSchema(fixtureRead)["properties"];
  assert(isRecord(readProperties));
  assertFalse("confirmation_id" in readProperties);
});

Deno.test("a null for an optional field is read as absent", () => {
  const parsed = parseToolInput(fixtureRead, {
    foodId: "f-1",
    meal: "lunch",
    note: null,
    portion: { grams: 100, label: null },
    tags: [{ name: "a", weight: null }],
  });

  assertEquals(parsed, {
    success: true,
    data: { foodId: "f-1", meal: "lunch", portion: { grams: 100 }, tags: [{ name: "a" }] },
  });
});

Deno.test("a null for a required field is invalid", () => {
  const parsed = parseToolInput(fixtureRead, {
    foodId: null,
    meal: "lunch",
    portion: { grams: 100 },
    tags: [],
  });

  assertEquals(parsed, { success: false, fields: ["foodId"] });
});

Deno.test("a wrong type or a missing field is invalid and names only the field", () => {
  const parsed = parseToolInput(fixtureRead, {
    foodId: "f-1",
    meal: "elevenses",
    portion: { grams: "a lot" },
    tags: [],
  });

  assertEquals(parsed, { success: false, fields: ["meal", "portion.grams"] });
});

Deno.test("an input that is not an object is invalid", () => {
  assertEquals(parseToolInput(fixtureRead, "get me food"), { success: false, fields: [] });
});

Deno.test("a field that is really nullable keeps its null", () => {
  const clearing: ReadToolDefinition<{ note: string | null }> = {
    name: "fixture_clear",
    description: "A fixture.",
    kind: "read",
    input: z.object({ note: z.string().nullable() }),
    annotations: { readOnlyHint: true },
    run: () => Promise.resolve({ data: null }),
  };

  assertEquals(parseToolInput(clearing, { note: null }), { success: true, data: { note: null } });
});

Deno.test(
  "the keywords a strict tool schema may not hold are left out, and zod still enforces them",
  () => {
    const bounded: ReadToolDefinition<{
      grams: number;
      name: string;
      tags: string[];
      day: string;
    }> = {
      name: "bounded",
      description: "A fixture.",
      kind: "read",
      input: z.object({
        grams: z.number().min(1).max(5000).multipleOf(5).gt(0).lt(9000),
        name: z
          .string()
          .min(1)
          .max(40)
          .regex(/^[a-z ]+$/),
        tags: z.array(z.string()).min(1).max(5),
        day: z.iso.date(),
      }),
      annotations: { readOnlyHint: true },
      run: () => Promise.resolve({ data: null }),
    };

    const schema = JSON.stringify(toJsonSchema(bounded));

    for (const keyword of [
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
    ]) {
      assertFalse(schema.includes(`"${keyword}"`), keyword);
    }
    assertEquals(strictSchemaProblems(toJsonSchema(bounded)), []);
    assertEquals(
      parseToolInput(bounded, { grams: 0, name: "ok", tags: ["a"], day: "2026-11-02" }),
      { success: false, fields: ["grams"] },
    );
  },
);

Deno.test("a property that is named like a keyword is kept", () => {
  const named: ReadToolDefinition<{ format: string; pattern: number }> = {
    name: "named",
    description: "A fixture.",
    kind: "read",
    input: z.object({ format: z.string(), pattern: z.number() }),
    annotations: { readOnlyHint: true },
    run: () => Promise.resolve({ data: null }),
  };

  assertObjectMatch(toJsonSchema(named), {
    properties: { format: { type: "string" }, pattern: { type: "number" } },
  });
});

Deno.test("a field that is optional and nullable keeps an explicit null", () => {
  const both: ReadToolDefinition<{ note?: string | null | undefined }> = {
    name: "both",
    description: "A fixture.",
    kind: "read",
    input: z.object({ note: z.string().nullable().optional() }),
    annotations: { readOnlyHint: true },
    run: () => Promise.resolve({ data: null }),
  };

  assertEquals(parseToolInput(both, { note: null }), { success: true, data: { note: null } });
  assertEquals(parseToolInput(both, {}), { success: true, data: {} });
  assertObjectMatch(toJsonSchema(both), {
    required: ["note"],
    properties: { note: { anyOf: [{ type: "string" }, { type: "null" }] } },
  });
});

Deno.test("an optional field inside a nullable object is read as absent when it is null", () => {
  const nested: ReadToolDefinition<{ o: { k?: string } | null }> = {
    name: "nested",
    description: "A fixture.",
    kind: "read",
    input: z.object({ o: z.object({ k: z.string().optional() }).nullable() }),
    annotations: { readOnlyHint: true },
    run: () => Promise.resolve({ data: null }),
  };

  assertEquals(parseToolInput(nested, { o: { k: null } }), { success: true, data: { o: {} } });
  assertEquals(parseToolInput(nested, { o: null }), { success: true, data: { o: null } });
  assertEquals(parseToolInput(nested, { o: { k: "a" } }), {
    success: true,
    data: { o: { k: "a" } },
  });
});

Deno.test(
  "an optional field inside a nullable array of objects is read as absent when it is null",
  () => {
    const listed: ReadToolDefinition<{ rows: { id: string; note?: string }[] | null }> = {
      name: "listed",
      description: "A fixture.",
      kind: "read",
      input: z.object({
        rows: z.array(z.object({ id: z.string(), note: z.string().optional() })).nullable(),
      }),
      annotations: { readOnlyHint: true },
      run: () => Promise.resolve({ data: null }),
    };

    assertEquals(
      parseToolInput(listed, {
        rows: [
          { id: "a", note: null },
          { id: "b", note: "x" },
        ],
      }),
      {
        success: true,
        data: { rows: [{ id: "a" }, { id: "b", note: "x" }] },
      },
    );
    assertEquals(parseToolInput(listed, { rows: null }), { success: true, data: { rows: null } });
  },
);
