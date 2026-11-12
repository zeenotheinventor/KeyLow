import {
  describePlateAmountField,
  describePlateRowOpenName,
  describeRemoveFromPlate,
  PLATE,
} from "@keylow/core/copy";
import { iconStroke } from "@keylow/tokens";
import { X } from "lucide-react";
import { useId } from "react";

import type { PlateRowProps } from "./types";

import { Button } from "@/components/ui/Button";
import { StatsLine } from "@/components/ui/FoodRow/StatsLine";
import { NumericInput } from "@/components/ui/NumericInput";
import { cn } from "@/lib/utils";

// The name block is at least 48 high, so a one line food is as tall as the 44 px remove button plus its padding.
const nameBlockClassName = "flex min-h-12 min-w-0 flex-1 flex-col justify-center gap-1 text-left";

// The box around the amount is 36 high and 112 wide with 12 px of padding, as the boards draw it. Its own
// dimming is switched off, because a row that is disabled is dimmed as a whole.
const amountFrameClassName =
  "h-control-sm px-3 has-[:disabled]:bg-surface-raised has-[:disabled]:opacity-100";

/**
 * A row of Your plate: the name with its stats line, the amount to change in place, and the X that takes the
 * food off. It is a list item for `GroupedList`, which draws the card and puts the divider above it.
 */
export function PlateRow({
  name,
  isRecipe = false,
  energy,
  macros,
  amountText,
  unitWord,
  unitsWord,
  onAmountChange,
  onOpen,
  onRemove,
  isOpenDisabled = false,
  disabled = false,
  autoFocus = false,
  error,
}: PlateRowProps) {
  const errorId = useId();
  const amountName = describePlateAmountField(name, unitsWord);
  const hasError = error !== undefined && error.trim() !== "";
  // While the whole row is dimmed the name is dimmed with it. A name that is not a button is never dimmed.
  const dimsName = onOpen !== undefined && isOpenDisabled && !disabled;
  const nameBlock = (
    <>
      <span className="line-clamp-2 text-body-strong">{name}</span>
      {isRecipe && <span className="text-caption text-text-muted">{PLATE.recipe}</span>}
      <StatsLine energy={energy} macros={macros} />
    </>
  );

  return (
    <li className={cn(disabled && "opacity-40")}>
      <div className="flex items-center gap-2 py-2 pl-3 pr-1">
        {onOpen === undefined ? (
          <div className={nameBlockClassName}>{nameBlock}</div>
        ) : (
          <button
            type="button"
            aria-label={describePlateRowOpenName(name, amountText, unitWord, energy)}
            aria-disabled={isOpenDisabled || undefined}
            disabled={disabled}
            className={cn(
              nameBlockClassName,
              "rounded-small outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-2 focus-visible:ring-offset-focus-ring-offset",
              dimsName && "opacity-40",
            )}
            onClick={() => {
              if (!isOpenDisabled) onOpen();
            }}
          >
            {nameBlock}
          </button>
        )}
        <div className="w-28 shrink-0">
          <NumericInput
            label={amountName}
            hideLabel
            // The unit word is drawn after the digits and is already in the name, so the box's own name for it is left out.
            aria-label={amountName}
            unit={unitWord}
            value={amountText}
            invalid={hasError}
            describedBy={hasError ? errorId : undefined}
            disabled={disabled}
            // The edit board puts the focus in the amount field when the row appears, because a person who pressed a row to edit it wants to type.
            // eslint-disable-next-line jsx-a11y/no-autofocus
            autoFocus={autoFocus}
            frameClassName={amountFrameClassName}
            className="h-8"
            onFocus={(event) => {
              event.currentTarget.select();
            }}
            onChange={(event) => {
              onAmountChange(event.target.value);
            }}
          />
        </div>
        <Button
          variant="ghost"
          iconOnly
          aria-label={describeRemoveFromPlate(name)}
          disabled={disabled}
          className="text-text-secondary"
          onClick={onRemove}
        >
          <X aria-hidden strokeWidth={iconStroke} />
        </Button>
      </div>
      {hasError && (
        <span id={errorId} role="alert" className="block px-3 pb-2 text-caption text-danger">
          {error}
        </span>
      )}
    </li>
  );
}
