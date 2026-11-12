"use client";

import {
  describeHeightProblem,
  describeSetupWeightProblem,
  describeWeighInSource,
  SETUP_FIELDS,
} from "@keylow/core/copy";
import { fieldTextsOf, heightUnitFor, readHeight, shouldShowProblem } from "@keylow/core/setup";
import { parseWeightInputIn } from "@keylow/core/weight";
import { iconStroke } from "@keylow/tokens";
import { Scale } from "lucide-react";
import { useId, useState } from "react";

import type { BodyStepProps } from "./types";
import type { BodyFieldTexts, FieldHistory } from "@keylow/core/setup";
import type { WeightDisplayUnit } from "@keylow/core/weight";
import type { ReactNode } from "react";

import { NumericInput } from "@/components/ui/NumericInput";
import { SegmentedControl } from "@/components/ui/SegmentedControl";

const unitOptions = [
  { value: "kg", label: SETUP_FIELDS.units.metric },
  { value: "lb", label: SETUP_FIELDS.units.imperial },
] as const;

const untouchedField: FieldHistory = { hasLeft: false, hasTyped: false };

type FieldProps = {
  label: string;
  error: string | undefined;
  errorId: string;
  /** Under the error's place, such as where the weight came from. */
  note?: ReactNode;
  children: ReactNode;
};

// One label over the field's box, or over the feet and the inches, which share one. The message sits under it.
function Field({ label, error, errorId, note, children }: FieldProps) {
  return (
    <div role="group" aria-label={label} className="flex flex-col gap-1.5">
      <div className="flex flex-col gap-1">
        <span className="text-caption text-text-secondary">{label}</span>
        <div className="flex gap-2">{children}</div>
      </div>
      {error === undefined ? null : (
        <span id={errorId} role="alert" className="text-caption text-danger">
          {error}
        </span>
      )}
      {note}
    </div>
  );
}

/**
 * The height and weight question. A switch picks kilograms with centimetres or pounds with feet and
 * inches, and the height and the weight are typed in that unit. The answers handed on are always in
 * centimetres and kilograms, so a switch changes only what is shown, and what is shown comes from those
 * answers, which keeps a height or a weight whole through a switch and back. A problem is said under its
 * field once the field is left, or at once when more typing cannot mend it. The weight from a weigh-in
 * says so, until the number is changed.
 */
export function BodyStep({
  heightCm,
  weightKg,
  weightUnit,
  weighInDate,
  today,
  onChange,
}: BodyStepProps) {
  const heightErrorId = useId();
  const weightErrorId = useId();
  const [texts, setTexts] = useState(() => fieldTextsOf({ heightCm, weightKg }, weightUnit));
  const [heightHistory, setHeightHistory] = useState(untouchedField);
  const [weightHistory, setWeightHistory] = useState(untouchedField);
  const [hasTouched, setHasTouched] = useState(false);
  const [startedFrom, setStartedFrom] = useState({ heightCm, weightKg, weightUnit });
  // Answers that arrive after the step opened, such as a slow read of the saved ones, fill the fields only
  // while nothing has been touched, so they never wipe what the person is typing.
  if (
    !hasTouched &&
    (heightCm !== startedFrom.heightCm ||
      weightKg !== startedFrom.weightKg ||
      weightUnit !== startedFrom.weightUnit)
  ) {
    setStartedFrom({ heightCm, weightKg, weightUnit });
    setTexts(fieldTextsOf({ heightCm, weightKg }, weightUnit));
  }

  const heightUnit = heightUnitFor(weightUnit);
  const heightReading = readHeight(texts, heightUnit);
  const weightReading = parseWeightInputIn(texts.weight, weightUnit);

  function typeInto(field: "height" | "weight", change: Partial<BodyFieldTexts>) {
    const nextTexts = { ...texts, ...change };
    const nextHeight = readHeight(nextTexts, heightUnit);
    const nextWeight = parseWeightInputIn(nextTexts.weight, weightUnit);
    const setHistory = field === "height" ? setHeightHistory : setWeightHistory;
    setHistory((history) => ({ ...history, hasTyped: true }));
    setHasTouched(true);
    setTexts(nextTexts);
    // Only the field typed in is read again. The other keeps the answer it has, which may be a saved number
    // the fields show to fewer places.
    onChange({
      heightCm: field === "height" ? (nextHeight.ok ? nextHeight.heightCm : undefined) : heightCm,
      weightKg: field === "weight" ? (nextWeight.ok ? nextWeight.weightKg : undefined) : weightKg,
      weightUnit,
    });
  }

  // The fields show the answers in the other unit. A height or a weight typed but not usable is not an
  // answer, so its field comes up empty.
  function switchTo(nextUnit: WeightDisplayUnit) {
    setHasTouched(true);
    setTexts(fieldTextsOf({ heightCm, weightKg }, nextUnit));
    setHeightHistory(untouchedField);
    setWeightHistory(untouchedField);
    onChange({ heightCm, weightKg, weightUnit: nextUnit });
  }

  const heightProblem =
    !heightReading.ok && shouldShowProblem(heightReading.reason, heightHistory)
      ? (describeHeightProblem(heightReading.reason, heightUnit) ?? undefined)
      : undefined;
  const weightProblem =
    !weightReading.ok && shouldShowProblem(weightReading.reason, weightHistory)
      ? (describeSetupWeightProblem(weightReading.reason, weightUnit) ?? undefined)
      : undefined;
  const { height, weight } = SETUP_FIELDS;
  const weightField = weightUnit === "kg" ? weight.kilograms : weight.pounds;

  const leaveHeight = () => {
    setHeightHistory((history) => ({ ...history, hasLeft: true }));
  };
  const heightFieldProps = {
    label: height.label,
    hideLabel: true,
    invalid: heightProblem !== undefined,
    describedBy: heightProblem === undefined ? undefined : heightErrorId,
    onBlur: leaveHeight,
  } as const;

  return (
    <div className="flex flex-col gap-3">
      <SegmentedControl
        label={SETUP_FIELDS.units.name}
        options={unitOptions}
        size="sm"
        value={weightUnit}
        onChange={switchTo}
      />
      <Field error={heightProblem} errorId={heightErrorId} label={height.label}>
        {heightUnit === "cm" ? (
          <div className="min-w-0 flex-1">
            <NumericInput
              {...heightFieldProps}
              aria-label={height.centimetres.name}
              unit={height.centimetres.suffix}
              value={texts.centimetres}
              onChange={(event) => {
                typeInto("height", { centimetres: event.target.value });
              }}
            />
          </div>
        ) : (
          <>
            <div className="min-w-0 flex-1">
              <NumericInput
                {...heightFieldProps}
                aria-label={height.feet.name}
                inputMode="numeric"
                unit={height.feet.suffix}
                value={texts.feet}
                onChange={(event) => {
                  typeInto("height", { feet: event.target.value });
                }}
              />
            </div>
            <div className="min-w-0 flex-1">
              <NumericInput
                {...heightFieldProps}
                aria-label={height.inches.name}
                inputMode="numeric"
                unit={height.inches.suffix}
                value={texts.inches}
                onChange={(event) => {
                  typeInto("height", { inches: event.target.value });
                }}
              />
            </div>
          </>
        )}
      </Field>
      <Field
        error={weightProblem}
        errorId={weightErrorId}
        label={weight.label}
        note={
          weighInDate === undefined || weightProblem !== undefined ? null : (
            <span className="flex items-center gap-1.5 text-caption text-text-secondary">
              <Scale aria-hidden className="size-3.5 shrink-0" strokeWidth={iconStroke} />
              {describeWeighInSource(weighInDate, today)}
            </span>
          )
        }
      >
        <div className="min-w-0 flex-1">
          <NumericInput
            aria-label={weightField.name}
            describedBy={weightProblem === undefined ? undefined : weightErrorId}
            hideLabel
            invalid={weightProblem !== undefined}
            label={weight.label}
            unit={weightField.suffix}
            value={texts.weight}
            onBlur={() => {
              setWeightHistory((history) => ({ ...history, hasLeft: true }));
            }}
            onChange={(event) => {
              typeInto("weight", { weight: event.target.value });
            }}
          />
        </div>
      </Field>
    </div>
  );
}
