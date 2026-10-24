import { describeAgeLine, describeBirthDateProblem, SETUP_FIELDS } from "@keylow/core/copy";
import { ageInYears } from "@keylow/core/dates";
import { useState } from "react";
import { View } from "react-native";

import { readBirthDate } from "./readBirthDate";
import { FieldError, NumericInput, Text } from "../../../ui";

import type { BirthDateFieldTexts, BirthDateStepProps } from "./types";

const YEAR_LENGTH = 4;

const digitsOnly = (text: string): string => text.replace(/\D/g, "");

function fieldTextsOf(birthDate: string | undefined): BirthDateFieldTexts {
  if (birthDate === undefined) {
    return { day: "", month: "", year: "" };
  }
  const [year = "", month = "", day = ""] = birthDate.split("-");
  return { day, month, year };
}

/**
 * The birth date question: Day, Month and Year typed as three fields in British order. The three are
 * bordered in danger with one line under them for a date that cannot be used, once the year has four digits or
 * the person has moved on from it, and a valid date says how old the person is.
 */
export function BirthDateStep({ value, today, onChange }: BirthDateStepProps) {
  const [fields, setFields] = useState(() => fieldTextsOf(value));
  const [hasLeftYear, setHasLeftYear] = useState(false);
  const [hasTyped, setHasTyped] = useState(false);
  const [startedFrom, setStartedFrom] = useState(value);
  // A birth date that arrives after the step opened, such as a slow read of the saved answers, fills the
  // fields only while nothing has been typed, so it never wipes what the person is typing.
  if (value !== startedFrom && !hasTyped) {
    setStartedFrom(value);
    setFields(fieldTextsOf(value));
  }
  const reading = readBirthDate(fields, today);

  function change(next: BirthDateFieldTexts) {
    setHasTyped(true);
    setFields(next);
    const nextReading = readBirthDate(next, today);
    onChange(nextReading.kind === "valid" ? nextReading.birthDate : undefined);
  }

  const problem =
    reading.kind === "problem" && (fields.year.length === YEAR_LENGTH || hasLeftYear)
      ? describeBirthDateProblem(reading.reason, today)
      : undefined;
  const { day, month, year } = SETUP_FIELDS.birthDate;

  return (
    <View aria-label={SETUP_FIELDS.birthDate.group} className="gap-[6px]" role="group">
      <View className="flex-row gap-2">
        <View className="min-w-0 flex-1">
          <NumericInput
            accessibilityLabel={day.name}
            align="left"
            error={problem}
            errorShownElsewhere
            keyboardType="number-pad"
            label={day.label}
            maxLength={2}
            placeholder={day.placeholder}
            value={fields.day}
            onChangeText={(text) => {
              change({ ...fields, day: digitsOnly(text) });
            }}
          />
        </View>
        <View className="min-w-0 flex-1">
          <NumericInput
            accessibilityLabel={month.name}
            align="left"
            error={problem}
            errorShownElsewhere
            keyboardType="number-pad"
            label={month.label}
            maxLength={2}
            placeholder={month.placeholder}
            value={fields.month}
            onChangeText={(text) => {
              change({ ...fields, month: digitsOnly(text) });
            }}
          />
        </View>
        <View className="min-w-0 flex-[1.6]">
          <NumericInput
            accessibilityLabel={year.name}
            align="left"
            error={problem}
            errorShownElsewhere
            keyboardType="number-pad"
            label={year.label}
            maxLength={YEAR_LENGTH}
            placeholder={year.placeholder}
            value={fields.year}
            onBlur={() => {
              setHasLeftYear(true);
            }}
            onChangeText={(text) => {
              change({ ...fields, year: digitsOnly(text) });
            }}
          />
        </View>
      </View>
      {problem === undefined ? null : <FieldError>{problem}</FieldError>}
      {reading.kind === "valid" ? (
        <Text className="tabular-nums" tone="secondary" variant="caption">
          {describeAgeLine(ageInYears(reading.birthDate, today))}
        </Text>
      ) : null}
    </View>
  );
}
