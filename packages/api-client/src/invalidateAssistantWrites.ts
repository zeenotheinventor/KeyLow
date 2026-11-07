import { invalidateFoodQueries } from "./invalidateFoodQueries";
import { keys } from "./queryKeys";

import type { QueryClient } from "@tanstack/react-query";

/**
 * Marks stale everything an assistant write can change: the diary, the recipes, the foods (not the Open
 * Food Facts searches, see `invalidateFoodQueries`), and the targets with the program that hangs on them, and all of training: the routines, goals, exercises, sets
 * and sessions the training tools write, which the exercise searches and suggestion library sit under. The ones on screen read again.
 */
export function invalidateAssistantWrites(queryClient: QueryClient) {
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: keys.diary.all }),
    queryClient.invalidateQueries({ queryKey: keys.recipes.all }),
    invalidateFoodQueries(queryClient),
    queryClient.invalidateQueries({ queryKey: keys.profiles.targets }),
    queryClient.invalidateQueries({ queryKey: keys.program.all }),
    queryClient.invalidateQueries({ queryKey: keys.training.all }),
  ]);
}
