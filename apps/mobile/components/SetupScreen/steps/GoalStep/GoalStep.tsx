import { SETUP_GOAL_NOTES, SETUP_QUESTIONS } from "@keylow/core/copy";

import { GoalOptions } from "../../../SetupOptions";
import { Banner } from "../../../ui";

import type { GoalStepProps } from "./types";

/**
 * The goal question: three cards, none chosen on a first run, and under them a note that is always there.
 * Pregnancy and breastfeeding are never asked about and nothing is stored, so the note only says to talk to
 * someone, and it says it for under 18 too when Lose is not offered.
 */
export function GoalStep({ value, allowedGoals, onChange }: GoalStepProps) {
  const note = allowedGoals.includes("lose") ? SETUP_GOAL_NOTES.default : SETUP_GOAL_NOTES.under18;

  return (
    <>
      <GoalOptions
        allowedGoals={allowedGoals}
        label={SETUP_QUESTIONS.goal.question}
        value={value}
        onChange={onChange}
      />
      <Banner body={note.body} title={note.title} />
    </>
  );
}
