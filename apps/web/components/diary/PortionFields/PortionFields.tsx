import { DIARY_PROBLEMS, PORTION_PICKER, describePortionUnit } from "@keylow/core/copy";

import type { PortionFieldsProps } from "./types";

import { MacroHero } from "@/components/foods/FoodDetail/MacroHero";
import { ChipGroup } from "@/components/ui/ChipGroup";
import { NumericInput } from "@/components/ui/NumericInput";
import { TimeField } from "@/components/ui/TimeField";

/**
 * What the add and the edit dialogs share once a food is chosen, as the portion boards draw them: what the
 * amount comes to in the hero, the amount and its unit, and the Time field, which an ingredient, not being
 * logged at a time, leaves out. The dialog keeps the amount, the unit and the time, and works the preview out
 * with core, so this only draws them.
 */
export function PortionFields({
  name,
  food,
  portions,
  unitOptions,
  preview,
  quantityText,
  unitValue,
  onQuantityChange,
  onUnitChange,
  amountRef,
  notice,
  ...timeProps
}: PortionFieldsProps) {
  const chosenPortion = portions.find((portion) => portion.id === unitValue);
  // A portion's own noun ("medium", "pot") follows the amount when its label counts one, else "portion(s)".
  const unitSuffix =
    chosenPortion === undefined
      ? unitValue
      : describePortionUnit(chosenPortion.label, preview.amount?.quantity ?? 1);

  return (
    <>
      {notice}
      <MacroHero
        food={food}
        amount={{ name, caption: preview.hero.caption, values: preview.hero.values }}
      />
      <div className="grid items-end gap-3 min-[700px]:grid-cols-[160px_1fr]">
        <NumericInput
          ref={amountRef}
          label={PORTION_PICKER.amountLabel}
          unit={unitSuffix}
          value={quantityText}
          error={preview.amount === null ? DIARY_PROBLEMS.quantity : undefined}
          onChange={(event) => {
            onQuantityChange(event.target.value);
          }}
        />
        <ChipGroup
          label={PORTION_PICKER.unitLabel}
          options={unitOptions}
          value={unitValue}
          onChange={onUnitChange}
        />
      </div>
      {timeProps.time !== undefined && (
        <TimeField
          value={timeProps.time}
          isNow={timeProps.isNow}
          onChange={timeProps.onTimeChange}
        />
      )}
    </>
  );
}
