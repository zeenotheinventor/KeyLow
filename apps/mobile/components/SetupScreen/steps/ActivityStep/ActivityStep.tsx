import { SETUP_QUESTIONS } from "@keylow/core/copy";

import { ActivityOptions } from "../../../SetupOptions";

import type { ActivityStepProps } from "./types";

/** The activity question: five levels, none chosen on a first run. */
export function ActivityStep({ value, onChange }: ActivityStepProps) {
  return (
    <ActivityOptions label={SETUP_QUESTIONS.activity.question} value={value} onChange={onChange} />
  );
}
