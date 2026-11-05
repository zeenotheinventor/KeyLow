import {
  describeMinutesOption,
  GOAL_ERRORS,
  GOAL_QUESTIONNAIRE,
  GOAL_QUESTIONS,
  MINUTES_PRESETS,
} from "@keylow/core/copy";
import { goalAnswersSchema } from "@keylow/core/training";
import { useState } from "react";
import { View } from "react-native";

import { ChipGroup, NumericInput } from "../../ui";

import type { MinutesStepProps } from "./types";

// The chips are keyed by their text, since a chip group's values are strings.
const OTHER = "other";
const options = [
  ...MINUTES_PRESETS.map((minutes) => ({
    value: String(minutes),
    label: describeMinutesOption(minutes),
  })),
  { value: OTHER, label: GOAL_QUESTIONNAIRE.otherMinutesOption },
];

const isPreset = (minutes: number): boolean => MINUTES_PRESETS.some((preset) => preset === minutes);

const isAllowed = (minutes: number): boolean =>
  goalAnswersSchema.shape.session_minutes.safeParse(minutes).success;

/**
 * The fourth question: a session of 30 to 90 minutes in five steps, or Other with a field for any whole
 * number from 15 to 180. The chips wrap onto lines, as the board draws them. Other opens with the field
 * empty and Next off, until the field holds minutes in range. A number out of range shows the rule under
 * the field and is given on, so Next stays off. Minutes that are no preset open with Other chosen.
 */
export function MinutesStep({ value, onChange }: MinutesStepProps) {
  const [isOtherChosen, setIsOtherChosen] = useState(value !== undefined && !isPreset(value));
  const [otherText, setOtherText] = useState(
    value !== undefined && !isPreset(value) ? String(value) : "",
  );
  const otherMinutes = otherText === "" ? undefined : Number(otherText);
  const error =
    otherMinutes !== undefined && !isAllowed(otherMinutes) ? GOAL_ERRORS.minutes : undefined;

  return (
    <View className="gap-3">
      <ChipGroup
        label={GOAL_QUESTIONS.minutes.title}
        layout="wrap"
        options={options}
        value={isOtherChosen ? OTHER : value === undefined ? null : String(value)}
        onChange={(next: string) => {
          if (next === OTHER) {
            setIsOtherChosen(true);
            setOtherText("");
            onChange(undefined);
          } else {
            setIsOtherChosen(false);
            onChange(Number(next));
          }
        }}
      />
      {isOtherChosen ? (
        <NumericInput
          error={error}
          keyboardType="number-pad"
          label={GOAL_QUESTIONNAIRE.otherMinutesOption}
          labelHidden
          maxLength={3}
          unit={GOAL_QUESTIONNAIRE.minutesUnit}
          value={otherText}
          onChangeText={(text) => {
            const digits = text.replace(/\D/g, "");
            setOtherText(digits);
            onChange(digits === "" ? undefined : Number(digits));
          }}
        />
      ) : null}
    </View>
  );
}
