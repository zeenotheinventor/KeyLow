import type { AssistantCard } from "./card";

/** A row an action changed, read back by the owner: whether it is still there and its change time. */
export type AssistantActionTarget = { found: boolean; updatedAt: string | null };

/**
 * The part of an `assistant_actions` row the app needs to tell whether Undo still works.
 * `targetUpdatedAt` is the change time as the write left it, null when the write recorded none. `targets`
 * is what the target rows read now, or null when no change time is read for the action's table (then
 * nothing says it changed). All the targets of a multi-row action share the one `targetUpdatedAt`.
 */
export type AssistantActionState = {
  id: string;
  /** False on a reserved slot that never landed: `target_id`, `target_ids` and `target_local_date` are all null. */
  hasTarget: boolean;
  undoneAt: string | null;
  targetUpdatedAt: string | null;
  targets: readonly AssistantActionTarget[] | null;
};

export type AssistantUndoState = AssistantCard["undo"];

const sameInstant = (first: string, second: string): boolean => {
  const firstTime = Date.parse(first);
  const secondTime = Date.parse(second);
  return Number.isNaN(firstTime) || Number.isNaN(secondTime)
    ? first === second
    : firstTime === secondTime;
};

/**
 * True when a target is gone, or when it has a change time that differs from the one the write left.
 * The times are compared as instants, because the database and the function print one instant in
 * different ways. A write that recorded no change time only counts a missing target as a change.
 */
export const hasTargetChanged = ({ targetUpdatedAt, targets }: AssistantActionState): boolean =>
  targets !== null &&
  targets.some(
    (target) =>
      !target.found ||
      (targetUpdatedAt !== null &&
        (target.updatedAt === null || !sameInstant(target.updatedAt, targetUpdatedAt))),
  );

/**
 * The live undo state of the actions one card groups. Undone once every action is, unavailable when an
 * action is missing or its target changed since, otherwise available.
 */
export function undoStateOfActions(
  actionIds: readonly string[],
  actionsById: ReadonlyMap<string, AssistantActionState>,
): AssistantUndoState {
  const actions = actionIds.map((id) => actionsById.get(id));
  if (actions.every((action) => action?.undoneAt != null)) {
    return "undone";
  }
  const lostOne = actions.some(
    (action) =>
      action === undefined ||
      (action.undoneAt === null && (!action.hasTarget || hasTargetChanged(action))),
  );
  return lostOne ? "unavailable" : "available";
}
