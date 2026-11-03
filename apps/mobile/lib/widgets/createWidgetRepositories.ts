import {
  addSet,
  getActiveRoutine,
  getActiveSession,
  getFood,
  getLastPerformance,
  getLogEntry,
  getMyTimeZone,
  getRoutine,
  listFoodPortions,
  logFood,
  removeSet,
  softDeleteLogEntry,
} from "@keylow/api-client";

import type { WidgetRepositories } from "./actions";
import type { Database } from "@keylow/api-client";
import type { SupabaseClient } from "@supabase/supabase-js";

/** The repositories the one-tap actions use, bound to one Supabase client (the app's, with the stored session). */
export function createWidgetRepositories(client: SupabaseClient<Database>): WidgetRepositories {
  return {
    getLogEntry: (id) => getLogEntry(client, id),
    getFood: (id) => getFood(client, id),
    listFoodPortions: (foodId) => listFoodPortions(client, foodId),
    getMyTimeZone: () => getMyTimeZone(client),
    logFood: (input) => logFood(client, input),
    softDeleteLogEntry: (id) => softDeleteLogEntry(client, id),
    getActiveSession: () => getActiveSession(client),
    getActiveRoutine: () => getActiveRoutine(client),
    getRoutine: (id) => getRoutine(client, id),
    getLastPerformance: (exerciseId, options) => getLastPerformance(client, exerciseId, options),
    addSet: (input) => addSet(client, input),
    removeSet: (id) => removeSet(client, id),
  };
}
