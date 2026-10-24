import { SETUP_DIET_OPTIONS } from "@keylow/core/copy";
import { DIET_STYLES } from "@keylow/core/setup";

import { OptionCardGroup } from "../../ui";

import type { DietOptionsProps } from "./types";

const options = DIET_STYLES.map((style) => ({ id: style, ...SETUP_DIET_OPTIONS[style] }));

/** Balanced, Low fat and Low carb, each with its line of words and no fat fraction. There is no keto. */
export function DietOptions({ label, value, onChange }: DietOptionsProps) {
  return <OptionCardGroup label={label} options={options} value={value} onChange={onChange} />;
}
