import { SETUP_ACTIVITY_OPTIONS } from "@keylow/core/copy";
import { ACTIVITY_LEVELS } from "@keylow/core/engine";

import { OptionCardGroup } from "../../ui";

import type { ActivityOptionsProps } from "./types";

const options = ACTIVITY_LEVELS.map((level) => ({ id: level, ...SETUP_ACTIVITY_OPTIONS[level] }));

/** The five activity levels, from Sedentary to Extra active, each with its line of words and no factor. */
export function ActivityOptions({ label, value, onChange }: ActivityOptionsProps) {
  return <OptionCardGroup label={label} options={options} value={value} onChange={onChange} />;
}
