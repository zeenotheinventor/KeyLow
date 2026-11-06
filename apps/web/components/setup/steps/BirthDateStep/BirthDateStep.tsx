"use client";

import { describeAgeLine, describeBirthDateProblem, SETUP_FIELDS } from "@keylow/core/copy";
import { ageInYears } from "@keylow/core/dates";
import { readBirthDate } from "@keylow/core/setup";
import { useId, useState } from "react";

import type { BirthDateStepProps } from "./types";
import type { BirthDateFieldTexts } from "@keylow/core/setup";

import { NumericInput } from "@/components/ui/NumericInput";

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
 * bordered in danger with one line under them for a date that cannot be used, once the year has four digits
 * or the person has moved on from it, and a valid date says how old the person is.
 */
export function BirthDateStep({ value, today, onChange }: BirthDateStepProps) {
  const problemId = useId();
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
  const shared = {
    inputMode: "numeric",
    className: "text-left",
    invalid: problem !== undefined,
    describedBy: problem === undefined ? undefined : problemId,
  } as const;

  return (
    <div role="group" aria-label={SETUP_FIELDS.birthDate.group} className="flex flex-col gap-1.5">
      <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.6fr)] gap-2">
        <NumericInput
          {...shared}
          aria-label={day.name}
          label={day.label}
          maxLength={2}
          placeholder={day.placeholder}
          value={fields.day}
          onChange={(event) => {
            change({ ...fields, day: digitsOnly(event.target.value) });
          }}
        />
        <NumericInput
          {...shared}
          aria-label={month.name}
          label={month.label}
          maxLength={2}
          placeholder={month.placeholder}
          value={fields.month}
          onChange={(event) => {
            change({ ...fields, month: digitsOnly(event.target.value) });
          }}
        />
        <NumericInput
          {...shared}
          aria-label={year.name}
          label={year.label}
          maxLength={YEAR_LENGTH}
          placeholder={year.placeholder}
          value={fields.year}
          onBlur={() => {
            setHasLeftYear(true);
          }}
          onChange={(event) => {
            change({ ...fields, year: digitsOnly(event.target.value) });
          }}
        />
      </div>
      {problem === undefined ? null : (
        <span id={problemId} role="alert" className="text-caption text-danger">
          {problem}
        </span>
      )}
      {reading.kind === "valid" ? (
        <span className="text-caption tabular-nums text-text-secondary">
          {describeAgeLine(ageInYears(reading.birthDate, today))}
        </span>
      ) : null}
    </div>
  );
}
