import { SETUP_QUESTIONS, setupGoalNoteFor } from "@keylow/core/copy";

import { GoalOptions } from "../../SetupOptions";

import type { GoalStepProps } from "./types";

import { Banner } from "@/components/ui/Banner";

/**
 * The goal question: three cards, none chosen on a first run, and under them a note that is always there.
 * Pregnancy and breastfeeding are never asked about and nothing is stored, so the note only says to talk to
 * someone, and it says it for under 18 too when Lose is not offered.
 */
export function GoalStep({ value, allowedGoals, onChange }: GoalStepProps) {
  const note = setupGoalNoteFor(allowedGoals);

  return (
    <>
      <GoalOptions
        allowedGoals={allowedGoals}
        label={SETUP_QUESTIONS.goal.question}
        value={value}
        onChange={onChange}
      />
      <Banner title={note.title}>{note.body}</Banner>
    </>
  );
}
