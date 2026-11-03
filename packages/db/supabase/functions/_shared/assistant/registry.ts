// The ordered list of tools. A tool ticket adds its file under `tools/` and one line to `toolDefinitions`.
// The order is part of the prompt cache's prefix, so a tool is only ever appended or moved on purpose.
import { deleteEntryTool } from "./tools/deleteEntry.ts";
import { askUserTool } from "./tools/askUser.ts";
import { getDayTool } from "./tools/getDay.ts";
import { getEntriesTool } from "./tools/getEntries.ts";
import { getFoodTool } from "./tools/getFood.ts";
import { getRangeTotalsTool } from "./tools/getRangeTotals.ts";
import { getRecipesTool } from "./tools/getRecipes.ts";
import { getWeighInsTool } from "./tools/getWeighIns.ts";
import { logEntryTool } from "./tools/logEntry.ts";
import { searchFoodsTool } from "./tools/searchFoods.ts";
import { updateEntryTool } from "./tools/updateEntry.ts";
import { strictSchemaProblem } from "./tool.ts";

import type { ToolDefinition, ToolRegistry } from "./tool.ts";

const toolNamePattern = /^[a-z][a-z0-9_]*$/;

export function createRegistry(definitions: readonly ToolDefinition[]): ToolRegistry {
  const byName = new Map<string, ToolDefinition>();
  for (const definition of definitions) {
    if (!toolNamePattern.test(definition.name)) {
      throw new Error(`Tool name ${definition.name} is not lower snake case`);
    }
    if (byName.has(definition.name)) {
      throw new Error(`Tool ${definition.name} is listed twice`);
    }
    // The allowlist sets are derived from the annotations, so they must say what the kind says.
    if (definition.annotations.readOnlyHint !== (definition.kind === "read")) {
      throw new Error(`Tool ${definition.name} has annotations that contradict its kind`);
    }
    const schemaProblem = strictSchemaProblem(definition);
    if (schemaProblem !== null) {
      throw new Error(schemaProblem);
    }
    byName.set(definition.name, definition);
  }
  return {
    list: Object.freeze([...definitions]),
    get: (name) => byName.get(name),
  };
}

const toolDefinitions: readonly ToolDefinition[] = [
  searchFoodsTool,
  getFoodTool,
  getRecipesTool,
  getDayTool,
  getRangeTotalsTool,
  getEntriesTool,
  getWeighInsTool,
  logEntryTool,
  updateEntryTool,
  deleteEntryTool,
  askUserTool,
];

export const toolRegistry: ToolRegistry = createRegistry(toolDefinitions);
