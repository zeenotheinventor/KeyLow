import { assertEquals, assertThrows } from "@std/assert";
import { z } from "zod";

import { createRegistry, toolRegistry } from "./registry.ts";

import type { ReadToolDefinition, ToolDefinition, WriteToolDefinition } from "./tool.ts";

const noInput = z.object({});

const read = (name: string): ReadToolDefinition<Record<string, never>> => ({
  name,
  description: "A fixture.",
  kind: "read",
  input: noInput,
  annotations: { readOnlyHint: true },
  run: () => Promise.resolve({ data: null }),
});

const write = (name: string): WriteToolDefinition<Record<string, never>> => ({
  name,
  description: "A fixture.",
  kind: "write",
  input: noInput,
  annotations: { readOnlyHint: false, destructiveHint: false },
  targetTable: "log_entries",
  inverse: null,
  run: () => Promise.resolve({ data: null, target: null }),
});

Deno.test("the registry keeps the order the tools were listed in", () => {
  const registry = createRegistry([read("b_tool"), write("a_tool"), read("c_tool")]);

  assertEquals(
    registry.list.map((tool) => tool.name),
    ["b_tool", "a_tool", "c_tool"],
  );
});

Deno.test("a tool is found by name and an unknown name finds nothing", () => {
  const registry = createRegistry([read("get_day")]);

  assertEquals(registry.get("get_day")?.name, "get_day");
  assertEquals(registry.get("delete_everything"), undefined);
});

Deno.test("two tools with one name are refused", () => {
  assertThrows(() => createRegistry([read("get_day"), write("get_day")]), Error, "get_day");
});

Deno.test("the list cannot be changed from outside", () => {
  const source: ToolDefinition[] = [read("get_day")];
  const registry = createRegistry(source);

  source.push(read("sneaky"));

  assertEquals(registry.list.length, 1);
  assertEquals(Object.isFrozen(registry.list), true);
});

Deno.test("a read tool must be read-only and a write tool must not be", () => {
  assertThrows(
    () => createRegistry([{ ...read("get_day"), annotations: { readOnlyHint: false } }]),
    Error,
    "get_day",
  );
  assertThrows(
    () => createRegistry([{ ...write("log_entry"), annotations: { readOnlyHint: true } }]),
    Error,
    "log_entry",
  );
});

Deno.test("a name that is not lower snake case is refused", () => {
  assertThrows(() => createRegistry([read("Get Day")]), Error);
});

Deno.test("the real registry holds no tool until a tool ticket adds one", () => {
  assertEquals(toolRegistry.list, []);
});

// A read tool whose input is the given schema, for the schemas a strict tool cannot hold.
const withInput = (name: string, input: ReadToolDefinition<unknown>["input"]): ToolDefinition => ({
  name,
  description: "A fixture.",
  kind: "read",
  input,
  annotations: { readOnlyHint: true },
  run: () => Promise.resolve({ data: null }),
});

Deno.test("an input schema a strict tool cannot hold is refused with the tool's name", () => {
  const unsupported = {
    record: z.object({ weights: z.record(z.string(), z.number()) }),
    tuple: z.object({ range: z.tuple([z.string(), z.string()]) }),
    union: z.object({ amount: z.union([z.string(), z.number()]) }),
    scalarUnion: z.union([z.string(), z.number()]),
    intersection: z.object({ code: z.intersection(z.string().min(1), z.string().max(3)) }),
    discriminated: z.discriminatedUnion("kind", [
      z.object({ kind: z.literal("a") }),
      z.object({ kind: z.literal("b") }),
    ]),
    catchall: z.object({ a: z.string() }).catchall(z.number()),
  };

  for (const [feature, input] of Object.entries(unsupported)) {
    assertThrows(() => createRegistry([withInput("bad_tool", input)]), Error, "bad_tool", feature);
  }
});

Deno.test("plain objects, arrays, enums, nullable and optional are accepted", () => {
  const input = z.object({
    meal: z.enum(["breakfast", "lunch"]),
    note: z.string().nullable(),
    extra: z.string().optional(),
    both: z.string().nullable().optional(),
    items: z.array(z.object({ id: z.string(), grams: z.number().min(0).max(5000) })),
  });

  assertEquals(createRegistry([withInput("good_tool", input)]).list.length, 1);
});
