// The ordered list of tools. A tool ticket adds its file under `tools/` and one line to `toolDefinitions`.
// The order is part of the prompt cache's prefix, so a tool is only ever appended or moved on purpose.
import { archiveRecipeTool } from "./tools/archiveRecipe.ts";
import { copyDayTool } from "./tools/copyDay.ts";
import { createCustomFoodTool } from "./tools/createCustomFood.ts";
import { createRecipeTool } from "./tools/createRecipe.ts";
import { createRoutineTool } from "./tools/createRoutine.ts";
import { deleteEntryTool } from "./tools/deleteEntry.ts";
import { editRoutineTool } from "./tools/editRoutine.ts";
import { askUserTool } from "./tools/askUser.ts";
import { estimatePortionsTool } from "./tools/estimatePortions.ts";
import { getDayTool } from "./tools/getDay.ts";
import { getEntriesTool } from "./tools/getEntries.ts";
import { getExerciseProgressTool } from "./tools/getExerciseProgress.ts";
import { getFoodTool } from "./tools/getFood.ts";
import { getRangeTotalsTool } from "./tools/getRangeTotals.ts";
import { getRecipesTool } from "./tools/getRecipes.ts";
import { getMuscleStateTool } from "./tools/getMuscleState.ts";
import { getRoutinesTool } from "./tools/getRoutines.ts";
import { getTrainingGoalsTool } from "./tools/getTrainingGoals.ts";
import { getWeighInsTool } from "./tools/getWeighIns.ts";
import { getWorkoutsTool } from "./tools/getWorkouts.ts";
import { importRecipeFromUrlTool } from "./tools/importRecipeFromUrl.ts";
import { logEntryTool } from "./tools/logEntry.ts";
import { searchExercisesTool } from "./tools/searchExercises.ts";
import { searchFoodsTool } from "./tools/searchFoods.ts";
import { setDayCompleteTool } from "./tools/setDayComplete.ts";
import { suggestNextSessionTool } from "./tools/suggestNextSession.ts";
import { updateEntryTool } from "./tools/updateEntry.ts";
import { updateRecipeTool } from "./tools/updateRecipe.ts";
import { updateTargetsTool } from "./tools/updateTargets.ts";
import { showExerciseMusclesTool } from "./tools/showExerciseMuscles.ts";
import { setActiveRoutineTool } from "./tools/setActiveRoutine.ts";
import { archiveRoutineTool } from "./tools/archiveRoutine.ts";
import { updatePastSetTool } from "./tools/updatePastSet.ts";
import { updateTrainingGoalsTool } from "./tools/updateTrainingGoals.ts";
import { archiveCustomExerciseTool } from "./tools/archiveCustomExercise.ts";
import { saveCustomExerciseTool } from "./tools/saveCustomExercise.ts";
import { deleteWorkoutTool } from "./tools/deleteWorkout.ts";
import { showExerciseFormTool } from "./tools/showExerciseForm.ts";
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
  copyDayTool,
  setDayCompleteTool,
  createRecipeTool,
  updateRecipeTool,
  archiveRecipeTool,
  createCustomFoodTool,
  updateTargetsTool,
  importRecipeFromUrlTool,
  searchExercisesTool,
  getRoutinesTool,
  getTrainingGoalsTool,
  getWorkoutsTool,
  getExerciseProgressTool,
  showExerciseMusclesTool,
  getMuscleStateTool,
  suggestNextSessionTool,
  setActiveRoutineTool,
  archiveRoutineTool,
  editRoutineTool,
  updatePastSetTool,
  updateTrainingGoalsTool,
  createRoutineTool,
  saveCustomExerciseTool,
  archiveCustomExerciseTool,
  deleteWorkoutTool,
  showExerciseFormTool,
  estimatePortionsTool,
  askUserTool,
];

export const toolRegistry: ToolRegistry = createRegistry(toolDefinitions);
