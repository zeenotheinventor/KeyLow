import {
  describeHeightProblem,
  describeSetupWeightProblem,
  describeWeighInSource,
  SETUP_FIELDS,
} from "@keylow/core/copy";
import { heightUnitFor } from "@keylow/core/setup";
import { parseWeightInputIn } from "@keylow/core/weight";
import { useState } from "react";
import { View } from "react-native";

import { fieldTextsOf, readHeight, shouldShowProblem } from "./readBody";
import { FieldError, Icon, NumericInput, SegmentedControl, Text } from "../../../ui";

import type { BodyFieldTexts, BodyStepProps, FieldHistory } from "./types";
import type { WeightDisplayUnit } from "@keylow/core/weight";
import type { ReactNode } from "react";

const unitOptions = [
  { value: "kg", label: SETUP_FIELDS.units.metric },
  { value: "lb", label: SETUP_FIELDS.units.imperial },
] as const;

const untouchedField: FieldHistory = { hasLeft: false, hasTyped: false };

type FieldProps = {
  label: string;
  error: string | undefined;
  /** Under the error's place, such as where the weight came from. */
  note?: ReactNode;
  children: ReactNode;
};

// One label over the field's box, or over the feet and the inches, which share one. The message sits under it.
function Field({ label, error, note, children }: FieldProps) {
  return (
    <View aria-label={label} className="gap-[6px]" role="group">
      <View className="gap-1">
        <Text tone="secondary" variant="caption">
          {label}
        </Text>
        <View className="flex-row gap-2">{children}</View>
      </View>
      {error === undefined ? null : <FieldError>{error}</FieldError>}
      {note}
    </View>
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

  return (
    <>
      <SegmentedControl
        label={SETUP_FIELDS.units.name}
        options={unitOptions}
        size="sm"
        value={weightUnit}
        onChange={switchTo}
      />
      <Field error={heightProblem} label={height.label}>
        {heightUnit === "cm" ? (
          <View className="min-w-0 flex-1">
            <NumericInput
              accessibilityLabel={height.centimetres.name}
              error={heightProblem}
              errorShownElsewhere
              label={height.label}
              labelHidden
              unit={height.centimetres.suffix}
              value={texts.centimetres}
              onBlur={leaveHeight}
              onChangeText={(text) => {
                typeInto("height", { centimetres: text });
              }}
            />
          </View>
        ) : (
          <>
            <View className="min-w-0 flex-1">
              <NumericInput
                accessibilityLabel={height.feet.name}
                error={heightProblem}
                errorShownElsewhere
                keyboardType="number-pad"
                label={height.label}
                labelHidden
                unit={height.feet.suffix}
                value={texts.feet}
                onBlur={leaveHeight}
                onChangeText={(text) => {
                  typeInto("height", { feet: text });
                }}
              />
            </View>
            <View className="min-w-0 flex-1">
              <NumericInput
                accessibilityLabel={height.inches.name}
                error={heightProblem}
                errorShownElsewhere
                keyboardType="number-pad"
                label={height.label}
                labelHidden
                unit={height.inches.suffix}
                value={texts.inches}
                onBlur={leaveHeight}
                onChangeText={(text) => {
                  typeInto("height", { inches: text });
                }}
              />
            </View>
          </>
        )}
      </Field>
      <Field
        error={weightProblem}
        label={weight.label}
        note={
          weighInDate === undefined || weightProblem !== undefined ? null : (
            <View className="flex-row items-center gap-[6px]">
              <Icon name="Scale" size={14} tone="secondary" />
              <Text tone="secondary" variant="caption">
                {describeWeighInSource(weighInDate, today)}
              </Text>
            </View>
          )
        }
      >
        <View className="min-w-0 flex-1">
          <NumericInput
            accessibilityLabel={weightField.name}
            error={weightProblem}
            errorShownElsewhere
            label={weight.label}
            labelHidden
            unit={weightField.suffix}
            value={texts.weight}
            onBlur={() => {
              setWeightHistory((history) => ({ ...history, hasLeft: true }));
            }}
            onChangeText={(text) => {
              typeInto("weight", { weight: text });
            }}
          />
        </View>
      </Field>
    </>
  );
}
