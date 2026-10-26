import { DIARY_PROBLEMS } from "@keylow/core/copy";
import { formatCalories, formatGrams } from "@keylow/core/format";
import {
  isPlateItemValid,
  plateItemName,
  plateItemValues,
  plateUnitWord,
  plateUnitWords,
} from "@keylow/core/plate";

import { PlateRow } from "../../../ui";

import type { PlateSheetRowProps } from "./types";

/**
 * One food or recipe of Your plate: the kit's row, written from what the plate holds. The amount is the plate's
 * own text, so the row, the totals and the bars follow as it is typed, and an amount that is not above 0 says so
 * under the row. The name is plain text for now: it will become the button that opens the picker to change the unit.
 */
export function PlateSheetRow({ item, isDisabled, onAmountChange, onRemove }: PlateSheetRowProps) {
  const values = plateItemValues(item);

  return (
    <PlateRow
      amountText={item.quantityText}
      disabled={isDisabled}
      energy={formatCalories(values.kcal)}
      error={isPlateItemValid(item) ? undefined : DIARY_PROBLEMS.quantity}
      isRecipe={item.kind === "recipe"}
      // Only the three values are read by the row: it is named by its energy, so it has no sentence to give.
      macros={{
        protein: formatGrams(values.protein_g),
        carbs: formatGrams(values.carbs_g),
        fat: formatGrams(values.fat_g),
        description: "",
      }}
      name={plateItemName(item)}
      unitsWord={plateUnitWords(item).plural}
      unitWord={plateUnitWord(item)}
      onAmountChange={onAmountChange}
      onRemove={onRemove}
    />
  );
}
