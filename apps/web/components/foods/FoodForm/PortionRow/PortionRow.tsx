import { FOOD_FORM, describePortionAmountField, describePortionField } from "@keylow/core/copy";
import { iconStroke } from "@keylow/tokens";
import { Trash2 } from "lucide-react";

import { DENSE_FRAME_CLASS_NAME, DENSE_INPUT_CLASS_NAME } from "../denseField";
import { amountUnit } from "../formValues";

import type { PortionRowProps } from "./types";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/Checkbox";
import { TextField } from "@/components/ui/input";
import { NumericInput } from "@/components/ui/NumericInput";

/**
 * One portion: a label, an amount, whether it is the default, and a way to remove it. A problem
 * with either field is one sentence under the row, which both fields are flagged by and described by.
 */
export function PortionRow({
  idPrefix,
  index,
  portion,
  basis,
  error,
  onLabelChange,
  onAmountChange,
  onDefaultChange,
  onRemove,
}: PortionRowProps) {
  const position = index + 1;
  const unit = amountUnit(basis);
  const messageId = `${idPrefix}-message`;
  const describedBy = error === undefined ? undefined : messageId;

  return (
    <li className="grid grid-cols-1 items-end gap-x-3 gap-y-2 border-b border-border pb-3 md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_auto_auto]">
      <TextField
        label={describePortionField("label", position)}
        placeholder={FOOD_FORM.portionLabelPlaceholder}
        autoComplete="off"
        aria-required="true"
        className={DENSE_INPUT_CLASS_NAME}
        value={portion.label}
        onChange={(event) => {
          onLabelChange(event.target.value);
        }}
        invalid={error?.isLabelInvalid}
        describedBy={error?.isLabelInvalid === true ? describedBy : undefined}
      />
      <NumericInput
        label={FOOD_FORM.amount}
        unit={unit}
        aria-label={describePortionAmountField(position, basis)}
        aria-required="true"
        frameClassName={DENSE_FRAME_CLASS_NAME}
        value={portion.amount}
        onChange={(event) => {
          onAmountChange(event.target.value);
        }}
        invalid={error?.isAmountInvalid}
        describedBy={error?.isAmountInvalid === true ? describedBy : undefined}
      />
      <Checkbox
        label={FOOD_FORM.makeDefault}
        aria-label={describePortionField("default", position)}
        checked={portion.isDefault}
        onChange={(event) => {
          onDefaultChange(event.target.checked);
        }}
      />
      <Button
        type="button"
        variant="ghost"
        aria-label={describePortionField("remove", position)}
        className="justify-start gap-1.5 rounded-small border-0 px-2 text-[14px] font-semibold leading-5 text-text-secondary [&_svg]:size-4"
        onClick={onRemove}
      >
        <Trash2 aria-hidden strokeWidth={iconStroke} />
        {FOOD_FORM.remove}
      </Button>
      {error !== undefined && (
        <span id={messageId} role="alert" className="col-span-full text-caption text-danger">
          {error.sentence}
        </span>
      )}
    </li>
  );
}
