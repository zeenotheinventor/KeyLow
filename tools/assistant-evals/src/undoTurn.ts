import { undoAssistantActions } from "@keylow/api-client";

import type { UndoOutcome } from "./case.ts";
import type { AssistantUndoResult, Database } from "@keylow/api-client";
import type { SupabaseClient } from "@supabase/supabase-js";

// What the Undo button does, for a case: the app's own call (`undoAssistantActions`, `POST assistant/undo`)
// as the eval user, for the actions a turn wrote. An error names the database's code and never a row, because a
// message is health data.

export type UndoTurnOptions = Readonly<{
  /** The eval user's own client, which reads the actions of its turns under row-level security. */
  client: SupabaseClient<Database>;
  /** The app's Undo. Left out, it is `undoAssistantActions`. */
  undoActions?: (
    client: SupabaseClient<Database>,
    actionIds: readonly string[],
  ) => Promise<AssistantUndoResult[]>;
}>;

/** Presses Undo for every action a turn wrote, and answers each outcome in the order the actions were written. */
export function createUndoTurn({
  client,
  undoActions = undoAssistantActions,
}: UndoTurnOptions): (turnId: string) => Promise<readonly UndoOutcome[]> {
  return async (turnId) => {
    const { data, error } = await client
      .from("assistant_actions")
      .select("id")
      .eq("turn_id", turnId)
      .order("turn_seq");
    if (error) {
      throw new Error(`Could not read the actions of the turn (${error.code})`);
    }
    const actionIds = data.map(({ id }) => id);
    if (actionIds.length === 0) {
      return [];
    }
    const results = await undoActions(client, actionIds);
    const outcomes = actionIds.flatMap((actionId) => {
      const found = results.find((result) => result.actionId === actionId);
      return found === undefined ? [] : [found.result];
    });
    if (outcomes.length !== actionIds.length) {
      throw new Error(`Undo answered for ${outcomes.length} of ${actionIds.length} actions`);
    }
    return outcomes;
  };
}
