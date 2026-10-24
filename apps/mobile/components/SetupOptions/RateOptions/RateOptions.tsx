import {
  describeRateAmount,
  describeRateAmountInWords,
  describeRateTitle,
  SETUP_PER_WEEK,
  SETUP_RATE_OPTIONS,
  SETUP_SUGGESTED_BADGE,
} from "@keylow/core/copy";

import { OptionCardGroup } from "../../ui";

import type { RateOptionsProps } from "./types";

/**
 * The rates of a goal, each a percentage of body weight a week with what it comes to a week at this weight,
 * in the person's unit. The goal's default is marked Suggested whether or not it is the chosen one.
 */
export function RateOptions({
  label,
  goal,
  weightKg,
  weightUnit,
  value,
  onChange,
}: RateOptionsProps) {
  // A card's id is its rate written as text, which `Number` turns back into exactly the same rate.
  const options = SETUP_RATE_OPTIONS[goal].map(({ ratePctPerWeek, description, suggested }) => ({
    id: String(ratePctPerWeek),
    title: describeRateTitle(ratePctPerWeek),
    description,
    ...(suggested ? { badge: { children: SETUP_SUGGESTED_BADGE } } : {}),
    value: describeRateAmount(ratePctPerWeek, weightKg, weightUnit),
    valueCaption: SETUP_PER_WEEK,
    valueLabel: describeRateAmountInWords(ratePctPerWeek, weightKg, weightUnit),
  }));

  return (
    <OptionCardGroup
      label={label}
      options={options}
      value={value === undefined ? undefined : String(value)}
      onChange={(id) => {
        onChange(Number(id));
      }}
    />
  );
}
