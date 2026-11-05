import type { Equipment } from "@keylow/core/training";

export type EquipmentStepProps = {
  /** The equipment chosen, in the order it was chosen. Empty while none is. */
  value: readonly Equipment[];
  onChange: (equipment: Equipment[]) => void;
};
