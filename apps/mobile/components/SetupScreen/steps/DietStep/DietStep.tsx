import { SETUP_QUESTIONS } from "@keylow/core/copy";

import { DietOptions } from "../../../SetupOptions";

import type { DietStepProps } from "./types";

/** The diet style question: balanced, low fat or low carb. */
export function DietStep({ value, onChange }: DietStepProps) {
  return <DietOptions label={SETUP_QUESTIONS.diet.question} value={value} onChange={onChange} />;
}
