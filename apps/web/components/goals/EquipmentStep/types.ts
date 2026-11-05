import type { Equipment } from "@keylow/core/training";

export type EquipmentStepProps = {
  /** The kinds of equipment chosen, in the order they were chosen. Empty until one is. */
  value: readonly Equipment[];
  onChange: (equipment: Equipment[]) => void;
};
