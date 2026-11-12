import type { AssistantChangeRow as AssistantChangeRowData } from "@keylow/core";

export type AssistantChangeRowProps = {
  /** One row of the hook's list, whose words are drawn as sent. */
  row: AssistantChangeRowData;
  /** Whether a workout is in progress, which a training row's Undo waits for. */
  workoutInProgress: boolean;
};
