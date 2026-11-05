import type { TrainingGoalsRow } from "@keylow/core/schemas";

/**
 * The goal read as the query hands it out: a pending read has no data and is fetching, a paused one (offline
 * with nothing cached) has no data and is not fetching, a failed one has no data and an error.
 */
type TrainingGoalsReadStatus = "ready" | "pending" | "paused" | "error";

export const trainingGoalsRead: {
  status: TrainingGoalsReadStatus;
  row: TrainingGoalsRow | null;
  /** What `useReadsEnabled` says, which the layout passes on as `enabled`. */
  isReadEnabled: boolean;
} = { status: "ready", row: null, isReadEnabled: true };

export function resetTrainingGoalsRead(): void {
  trainingGoalsRead.status = "ready";
  trainingGoalsRead.row = null;
  trainingGoalsRead.isReadEnabled = true;
}

/** A stand-in for `useReadsEnabled`. */
export const useReadsEnabledMock = (): boolean => trainingGoalsRead.isReadEnabled;

/** A stand-in for `useTrainingGoals`, with its states. A read that is not enabled makes no request. */
export function useTrainingGoalsMock({ enabled = true }: { enabled?: boolean } = {}) {
  if (!enabled) {
    return { data: undefined, isPending: true, isError: false, fetchStatus: "idle" };
  }
  switch (trainingGoalsRead.status) {
    case "ready":
      return {
        data: trainingGoalsRead.row,
        isPending: false,
        isError: false,
        fetchStatus: "idle",
      };
    case "pending":
      return { data: undefined, isPending: true, isError: false, fetchStatus: "fetching" };
    case "paused":
      return { data: undefined, isPending: true, isError: false, fetchStatus: "paused" };
    case "error":
      return { data: undefined, isPending: false, isError: true, fetchStatus: "idle" };
  }
}

/** The golden week's goal as the database holds it, with every answer a question asks. */
export const storedGoalRow: TrainingGoalsRow = {
  id: "11111111-1111-4111-8111-111111111111",
  user_id: "22222222-2222-4222-8222-222222222222",
  goal: "hybrid",
  focus: ["arms", "chest"],
  days_per_week: 5,
  session_minutes: 50,
  equipment: ["dumbbell", "cable", "other"],
  experience: "advanced",
  muscle_priority: {},
  params_version: "v1",
  effective_from: "2026-09-21T08:00:00+00:00",
  effective_to: null,
  created_at: "2026-09-21T08:00:00+00:00",
};
