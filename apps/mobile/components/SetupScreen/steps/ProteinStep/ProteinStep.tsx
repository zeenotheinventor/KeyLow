import { SETUP_QUESTIONS } from "@keylow/core/copy";

import { ProteinOptions } from "../../../SetupOptions";

import type { ProteinStepProps } from "./types";

/** The protein question: three presets, with the grams a day each comes to at the weight from step 3. */
export function ProteinStep({ weightKg, value, onChange }: ProteinStepProps) {
  return (
    <ProteinOptions
      label={SETUP_QUESTIONS.protein.question}
      value={value}
      weightKg={weightKg}
      onChange={onChange}
    />
  );
}
