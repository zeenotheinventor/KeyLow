import { RIR_CHIP_LABELS, SET_ENTRY } from "@keylow/core/copy";
import { View } from "react-native";

import { ChipGroup, Text } from "../../ui";

import type { RirFieldProps } from "./types";

// RIR is held as the text of its number, which is what a chip stands for: "6+" is 6.
const RIR_OPTIONS = RIR_CHIP_LABELS.map((label, index) => ({ value: String(index), label }));
const LAST_RIR_CHIP = RIR_OPTIONS.length - 1;

/** The chip that stands for the RIR held as text: the 6+ chip for six or more, none for a blank. */
function chipOf(rir: string): string | null {
  const number = rir.trim() === "" ? Number.NaN : Number(rir);
  return Number.isInteger(number) && number >= 0 ? String(Math.min(number, LAST_RIR_CHIP)) : null;
}

/** The RIR choice, as the set entry and the edit set boards draw it: the heading, seven chips and a line under them. */
export function RirField({ rir, help, onChange }: RirFieldProps) {
  return (
    <View className="gap-2">
      <Text tone="secondary" variant="caption">
        {SET_ENTRY.rirHeading}
      </Text>
      <ChipGroup
        allowDeselect
        label={SET_ENTRY.rirHeading}
        layout="equal"
        options={RIR_OPTIONS}
        value={chipOf(rir)}
        onChange={(chip: string | null) => {
          onChange(chip ?? "");
        }}
      />
      {help === null ? null : (
        <Text tone="muted" variant="caption">
          {help}
        </Text>
      )}
    </View>
  );
}
