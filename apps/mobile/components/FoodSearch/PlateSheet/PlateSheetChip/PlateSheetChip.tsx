import { usePlate } from "../../../../lib/plate";
import { PlateChip } from "../../../ui";

import type { PlateSheetChipProps } from "./types";

/**
 * The plate chip of the search header: it shows the number of foods on the plate and opens Your plate. It is
 * there from the first food to the last, and dimmed while the plate is being logged.
 */
export function PlateSheetChip({ onPress }: PlateSheetChipProps) {
  const { count, isLogging } = usePlate();

  if (count === 0) {
    return null;
  }

  return <PlateChip count={count} disabled={isLogging} onPress={onPress} />;
}
