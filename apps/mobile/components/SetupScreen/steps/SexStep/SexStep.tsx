import { SETUP_QUESTIONS, SETUP_SEX_OPTIONS } from "@keylow/core/copy";
import { SEXES } from "@keylow/core/engine";

import { OptionCardGroup } from "../../../ui";

import type { SexStepProps } from "./types";

const options = SEXES.map((sex) => ({ id: sex, ...SETUP_SEX_OPTIONS[sex] }));

/** The sex question: three cards, with "Prefer not to say" stored as `other`. */
export function SexStep({ value, onChange }: SexStepProps) {
  return (
    <OptionCardGroup
      label={SETUP_QUESTIONS.sex.question}
      options={options}
      value={value}
      onChange={onChange}
    />
  );
}
