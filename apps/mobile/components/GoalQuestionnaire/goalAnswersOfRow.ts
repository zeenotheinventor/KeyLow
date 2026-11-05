import type { GoalDraftAnswers } from "./goalDraftReducer";
import type { TrainingGoalsRow } from "@keylow/core/schemas";

/** The six answers of a stored goal and nothing else of the row, so the flow opens filled with them. */
export function goalAnswersOfRow(row: TrainingGoalsRow): GoalDraftAnswers {
  return {
    goal: row.goal,
    focus: row.focus,
    days_per_week: row.days_per_week,
    session_minutes: row.session_minutes,
    equipment: row.equipment,
    experience: row.experience,
  };
}
