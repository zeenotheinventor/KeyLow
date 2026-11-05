import type { UndoOutcome } from "./case.ts";
import type { Database } from "@keylow/api-client";
import type { SupabaseClient } from "@supabase/supabase-js";

// What the Undo button does, for a case: the same call the app's card makes, `POST assistant/undo`, as the
// eval user. An error names the status or the database's code and never a body or a row, because a message
// is health data.

export type UndoTurnOptions = Readonly<{
  /** The project's API address, such as `http://127.0.0.1:54321`. */
  apiUrl: string;
  anonKey: string;
  getAccessToken: () => Promise<string>;
  /** The eval user's own client, which reads the actions of its turns under row-level security. */
  client: SupabaseClient<Database>;
}>;

const OUTCOMES: readonly UndoOutcome[] = [
  "undone",
  "already_undone",
  "undo_unavailable",
  "not_found",
];

const outcomeOf = (value: unknown): UndoOutcome | undefined =>
  OUTCOMES.find((outcome) => outcome === value);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const malformed = (status: number) =>
  new Error(`The undo route answered ${status} with an answer that was not understood`);

/** The outcome of each action in `actionIds` order, read from the route's `results`. */
function outcomesOf(actionIds: readonly string[], body: unknown, status: number): UndoOutcome[] {
  const listed = isRecord(body) ? body["results"] : undefined;
  const results: readonly unknown[] = Array.isArray(listed) ? listed : [];
  return actionIds.map((actionId) => {
    const found = results.find((result) => isRecord(result) && result["actionId"] === actionId);
    const outcome = isRecord(found) ? outcomeOf(found["result"]) : undefined;
    if (outcome === undefined) {
      throw malformed(status);
    }
    return outcome;
  });
}

/** Presses Undo for every action a turn wrote, and answers each outcome in the order the actions were written. */
export function createUndoTurn({
  apiUrl,
  anonKey,
  getAccessToken,
  client,
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
    const response = await fetch(`${apiUrl}/functions/v1/assistant/undo`, {
      method: "POST",
      headers: {
        apikey: anonKey,
        Authorization: `Bearer ${await getAccessToken()}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ actionIds }),
      signal: AbortSignal.timeout(30_000),
    });
    if (!response.ok) {
      throw new Error(`The undo route answered ${response.status}`);
    }
    return outcomesOf(actionIds, await response.json(), response.status);
  };
}
