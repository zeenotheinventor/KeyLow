import { EQUIPMENT_OPTIONS, FULL_GYM, GOAL_QUESTIONS, isFullGym } from "@keylow/core/copy";
import { EQUIPMENT } from "@keylow/core/training";

import type { EquipmentStepProps } from "./types";
import type { Equipment } from "@keylow/core/training";

import { ChipGroup } from "@/components/ui/ChipGroup";

// Full gym is a chip of the group and not a value of the answers, so it has a value of its own here.
const FULL_GYM_CHIP = "full_gym";
type EquipmentChip = Equipment | typeof FULL_GYM_CHIP;

const options = [
  { value: FULL_GYM_CHIP, label: FULL_GYM.label },
  ...EQUIPMENT.map((equipment) => ({
    value: equipment,
    label: EQUIPMENT_OPTIONS[equipment].label,
  })),
] satisfies { value: EquipmentChip; label: string }[];

const isEquipment = (chip: EquipmentChip): chip is Equipment => chip !== FULL_GYM_CHIP;

/**
 * The fifth question: any of the ten kinds of equipment as wrapped chips, with a Full gym chip first that
 * picks the nine values but Other and clears them again when pressed twice. Full gym is drawn from the
 * values, so choosing the nine one by one chooses it, and clearing one of them clears it.
 */
export function EquipmentStep({ value, onChange }: EquipmentStepProps) {
  const isFull = isFullGym(value);
  const chosen: EquipmentChip[] = isFull ? [FULL_GYM_CHIP, ...value] : [...value];

  return (
    <ChipGroup
      label={GOAL_QUESTIONS.equipment.title}
      options={options}
      selection="multiple"
      value={chosen}
      onChange={(next) => {
        if (next.includes(FULL_GYM_CHIP) !== isFull) {
          onChange(isFull ? [] : [...FULL_GYM.equipment]);
        } else {
          onChange(next.filter(isEquipment));
        }
      }}
    />
  );
}
