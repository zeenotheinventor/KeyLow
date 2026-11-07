import { assert, assertEquals, assertThrows } from "@std/assert";
import { z } from "zod";

import { createRegistry, toolRegistry } from "./registry.ts";
import { toJsonSchema } from "./tool.ts";

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

Deno.test(
  "the real registry lists the food reads, the diary reads, the diary, day, recipe, food, targets and recipe import writes, the training reads and then ask_user in order",
  () => {
    assertEquals(
      toolRegistry.list.map((tool) => [tool.name, tool.kind]),
      [
        ["search_foods", "read"],
        ["get_food", "read"],
        ["get_recipes", "read"],
        ["get_day", "read"],
        ["get_range_totals", "read"],
        ["get_entries", "read"],
        ["get_weigh_ins", "read"],
        ["log_entry", "write"],
        ["update_entry", "write"],
        ["delete_entry", "write"],
        ["copy_day", "write"],
        ["set_day_complete", "write"],
        ["create_recipe", "write"],
        ["update_recipe", "write"],
        ["archive_recipe", "write"],
        ["create_custom_food", "write"],
        ["update_targets", "write"],
        ["import_recipe_from_url", "write"],
        ["search_exercises", "read"],
        ["get_routines", "read"],
        ["get_training_goals", "read"],
        ["get_workouts", "read"],
        ["get_exercise_progress", "read"],
        ["get_muscle_state", "read"],
        ["suggest_next_session", "read"],
        ["ask_user", "read"],
      ],
    );
    assertEquals(
      toolRegistry.list.map((tool) => tool.annotations.readOnlyHint),
      toolRegistry.list.map((tool) => tool.kind === "read"),
    );
  },
);

// The Messages API caps what the strict tools of one request hold together: 20 tools, 24 optional
// parameters and 16 parameters with a union type (`anyOf` or a type array), counted across all of
// their schemas. https://platform.claude.com/docs/en/build-with-claude/structured-outputs.md
// (section "Explicit limits"). A tool that would break a cap sets `strict: false`.
const strictLimits = { tools: 20, optionalParameters: 24, unionParameters: 16 } as const;

type Schema = Record<string, unknown>;
const isSchema = (value: unknown): value is Schema =>
  typeof value === "object" && value !== null && !Array.isArray(value);

// Counts the parameters under a schema: every property of an object, however deep, and the items of arrays.
function countParameters(schema: unknown): { optional: number; union: number } {
  const total = { optional: 0, union: 0 };
  if (!isSchema(schema)) {
    return total;
  }
  const properties = isSchema(schema["properties"]) ? schema["properties"] : {};
  const required = Array.isArray(schema["required"]) ? schema["required"] : [];
  for (const [name, property] of Object.entries(properties)) {
    total.optional += required.includes(name) ? 0 : 1;
    total.union +=
      isSchema(property) && (Array.isArray(property["anyOf"]) || Array.isArray(property["type"]))
        ? 1
        : 0;
    const inner = countParameters(
      isSchema(property) && Array.isArray(property["anyOf"])
        ? property["anyOf"].find((branch) => isSchema(branch) && branch["type"] !== "null")
        : property,
    );
    total.optional += inner.optional;
    total.union += inner.union;
  }
  const items = countParameters(schema["items"]);
  return { optional: total.optional + items.optional, union: total.union + items.union };
}

function strictBudgetOf(tools: readonly ToolDefinition[]) {
  const strictTools = tools.filter((tool) => tool.strict !== false);
  const counts = strictTools.map((tool) => countParameters(toJsonSchema(tool)));
  return {
    tools: strictTools.length,
    optionalParameters: counts.reduce((sum, count) => sum + count.optional, 0),
    unionParameters: counts.reduce((sum, count) => sum + count.union, 0),
  };
}

Deno.test("the strict tools of the registry stay inside what one request may hold", () => {
  const budget = strictBudgetOf(toolRegistry.list);

  assert(budget.tools <= strictLimits.tools, `${budget.tools} strict tools`);
  assert(budget.optionalParameters <= strictLimits.optionalParameters, JSON.stringify(budget));
  assert(budget.unionParameters <= strictLimits.unionParameters, JSON.stringify(budget));
});

Deno.test("update_recipe opts out of strict mode and the other recipe writes do not", () => {
  const strictOf = (name: string) => toolRegistry.get(name)?.strict;

  assertEquals(strictOf("update_recipe"), false);
  assertEquals(strictOf("create_recipe"), undefined);
  assertEquals(strictOf("archive_recipe"), undefined);
});

Deno.test("create_custom_food opts out of strict mode and update_targets does not", () => {
  const strictOf = (name: string) => toolRegistry.get(name)?.strict;

  assertEquals(strictOf("create_custom_food"), false);
  assertEquals(strictOf("update_targets"), undefined);
});

Deno.test(
  "the training reads opt out of strict mode, so they take nothing from the strict budget",
  () => {
    for (const name of [
      "search_exercises",
      "get_routines",
      "get_training_goals",
      "get_workouts",
      "get_exercise_progress",
    ]) {
      assertEquals(toolRegistry.get(name)?.strict, false, name);
    }
  },
);

Deno.test(
  "the muscle and suggestion reads are read-only and opt out of strict mode, so they take nothing from the strict budget",
  () => {
    for (const name of ["get_muscle_state", "suggest_next_session"]) {
      assertEquals(toolRegistry.get(name)?.strict, false, name);
      assertEquals(toolRegistry.get(name)?.annotations.readOnlyHint, true, name);
    }
  },
);

Deno.test(
  "the strict budget of the real registry is 16 tools, 0 optional and 14 union parameters",
  () => {
    assertEquals(strictBudgetOf(toolRegistry.list), {
      tools: 16,
      optionalParameters: 0,
      unionParameters: 14,
    });
  },
);

Deno.test(
  "the budget counts a nullable and a confirmation id as union parameters, and skips a tool that is not strict",
  () => {
    const nullable = {
      ...read("nullable_tool"),
      input: z.object({
        note: z.string().nullable(),
        nested: z.object({ n: z.number().nullable() }),
      }),
    };
    const confirmed = {
      ...write("confirmed_tool"),
      needsConfirmation: () => ({ question: "Do it?", confirmLabel: "Do it" }),
    };

    assertEquals(strictBudgetOf([nullable]), {
      tools: 1,
      optionalParameters: 0,
      unionParameters: 2,
    });
    assertEquals(strictBudgetOf([confirmed]), {
      tools: 1,
      optionalParameters: 0,
      unionParameters: 1,
    });
    assertEquals(strictBudgetOf([{ ...nullable, strict: false }]), {
      tools: 0,
      optionalParameters: 0,
      unionParameters: 0,
    });
  },
);

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

Deno.test(
  "import_recipe_from_url stays strict, and its servings are the only nullable parameter",
  () => {
    const importTool = toolRegistry.get("import_recipe_from_url");

    assertEquals(importTool?.strict, undefined);
    assertEquals(strictBudgetOf(importTool === undefined ? [] : [importTool]), {
      tools: 1,
      optionalParameters: 0,
      unionParameters: 1,
    });
  },
);

// The tables of the training feature. A write to one of them must not run while a workout is in progress,
// so its tool carries `refusesDuringWorkout` and the executor and Undo refuse it (KEY-899).
const trainingTables: ReadonlySet<string> = new Set([
  "exercises",
  "exercise_muscles",
  "routines",
  "routine_days",
  "routine_exercises",
  "training_goals",
  "workout_sessions",
  "workout_sets",
]);

const trainingWritesWithoutTheGuard = (tools: readonly ToolDefinition[]): string[] =>
  tools
    .filter(
      (tool) =>
        tool.kind === "write" &&
        trainingTables.has(tool.targetTable) &&
        tool.refusesDuringWorkout !== true,
    )
    .map((tool) => tool.name);

Deno.test(
  "every write tool of the registry that changes a training table refuses a live workout",
  () => {
    assertEquals(trainingWritesWithoutTheGuard(toolRegistry.list), []);
  },
);

Deno.test("the check names a training write that lacks the guard and spares the rest", () => {
  const guarded: WriteToolDefinition<Record<string, never>> = {
    ...write("log_set"),
    targetTable: "workout_sets",
    refusesDuringWorkout: true,
  };

  assertEquals(
    trainingWritesWithoutTheGuard([
      guarded,
      { ...write("remove_set"), targetTable: "workout_sets" },
      { ...write("archive_routine"), targetTable: "routines" },
      write("log_entry"),
      read("get_workouts"),
    ]),
    ["remove_set", "archive_routine"],
  );
});
