import { describeProteinGrams, SETUP_PER_DAY, SETUP_PROTEIN_OPTIONS } from "@keylow/core/copy";
import { PROTEIN_PRESETS } from "@keylow/core/setup";

import { OptionCardGroup } from "../../ui";

import type { ProteinOptionsProps } from "./types";

/** Moderate, High and Very high, each with the grams a day it comes to at this weight, in grams in either unit. */
export function ProteinOptions({ label, weightKg, value, onChange }: ProteinOptionsProps) {
  const options = PROTEIN_PRESETS.map((preset) => ({
    id: preset,
    ...SETUP_PROTEIN_OPTIONS[preset],
    value: describeProteinGrams(preset, weightKg),
    valueCaption: SETUP_PER_DAY,
  }));

  return <OptionCardGroup label={label} options={options} value={value} onChange={onChange} />;
}
