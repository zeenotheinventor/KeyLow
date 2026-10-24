import { SETUP_QUESTIONS } from "@keylow/core/copy";

import { RateOptions } from "../../../SetupOptions";

import type { RateStepProps } from "./types";

/** The rate question for a goal that moves the weight, which names the direction: lose or gain. */
export function RateStep({ goal, weightKg, weightUnit, value, onChange }: RateStepProps) {
  return (
    <RateOptions
      goal={goal}
      label={SETUP_QUESTIONS.rate[goal].question}
      value={value}
      weightKg={weightKg}
      weightUnit={weightUnit}
      onChange={onChange}
    />
  );
}
