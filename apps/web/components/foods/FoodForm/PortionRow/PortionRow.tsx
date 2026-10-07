import { amountUnit } from "../formValues";
import { TextField } from "../TextField";

import type { PortionRowProps } from "./types";

import { Button } from "@/components/ui/button";

export function PortionRow({
  idPrefix,
  index,
  portion,
  basis,
  labelError,
  amountError,
  onLabelChange,
  onAmountChange,
  onDefaultChange,
  onRemove,
}: PortionRowProps) {
  const number = index + 1;
  const defaultId = `${idPrefix}-default`;

  return (
    <li className="flex flex-col gap-3 rounded-md border p-3 sm:flex-row sm:items-start">
      <div className="sm:flex-1">
        <TextField
          id={`${idPrefix}-label`}
          label={`Portion ${String(number)} label`}
          value={portion.label}
          onChange={(event) => {
            onLabelChange(event.target.value);
          }}
          error={labelError}
        />
      </div>
      <div className="sm:w-40">
        <TextField
          id={`${idPrefix}-amount`}
          label={`Portion ${String(number)} amount (${amountUnit(basis)})`}
          type="number"
          inputMode="decimal"
          step="any"
          min="0"
          value={portion.amount}
          onChange={(event) => {
            onAmountChange(event.target.value);
          }}
          error={amountError}
        />
      </div>
      <div className="flex items-center gap-4 sm:pt-7">
        <div className="flex min-h-11 items-center gap-2 md:min-h-9">
          <input
            id={defaultId}
            type="checkbox"
            className="size-5 accent-primary md:size-4"
            checked={portion.isDefault}
            onChange={(event) => {
              onDefaultChange(event.target.checked);
            }}
          />
          <label htmlFor={defaultId} className="text-sm">
            <span className="sr-only">{`Portion ${String(number)} is the default`}</span>
            <span aria-hidden="true">Default</span>
          </label>
        </div>
        <Button
          type="button"
          variant="outline"
          className="h-11 md:h-9"
          aria-label={`Remove portion ${String(number)}`}
          onClick={onRemove}
        >
          Remove
        </Button>
      </div>
    </li>
  );
}
