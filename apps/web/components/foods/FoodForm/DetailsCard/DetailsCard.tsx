import { FOOD_FORM } from "@keylow/core/copy";
import { Lock } from "lucide-react";
import { useId } from "react";

import { DENSE_INPUT_CLASS_NAME } from "../denseField";

import type { DetailsCardProps } from "./types";

import { Card } from "@/components/ui/card";
import { TextField } from "@/components/ui/input";
import { cn } from "@/lib/utils";

/** The name, brand and barcode. Name takes two of the four columns when there is room. */
export function DetailsCard({
  values,
  errors,
  isBarcodeLocked,
  lockedBarcodeNote,
  onChange,
}: DetailsCardProps) {
  const headingId = useId();

  return (
    <Card asChild className="flex flex-col gap-3 shadow-none">
      <section aria-labelledby={headingId}>
        <h2 id={headingId} className="text-body-strong">
          {FOOD_FORM.details}
        </h2>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
          <div className="min-w-0 md:col-span-2">
            <TextField
              label={FOOD_FORM.name}
              labelHint={FOOD_FORM.required}
              placeholder={FOOD_FORM.namePlaceholder}
              autoComplete="off"
              aria-required="true"
              className={DENSE_INPUT_CLASS_NAME}
              value={values.name}
              onChange={(event) => {
                onChange("name", event.target.value);
              }}
              error={errors.name}
            />
          </div>
          <div className="min-w-0">
            <TextField
              label={FOOD_FORM.brand}
              placeholder={FOOD_FORM.optionalPlaceholder}
              autoComplete="off"
              className={DENSE_INPUT_CLASS_NAME}
              value={values.brand}
              onChange={(event) => {
                onChange("brand", event.target.value);
              }}
            />
          </div>
          <div className="min-w-0">
            <TextField
              label={FOOD_FORM.barcode}
              placeholder={FOOD_FORM.optionalPlaceholder}
              inputMode="numeric"
              autoComplete="off"
              className={cn(DENSE_INPUT_CLASS_NAME, isBarcodeLocked && "read-only:bg-surface")}
              value={values.barcode}
              readOnly={isBarcodeLocked}
              trailingIcon={isBarcodeLocked ? Lock : undefined}
              helper={isBarcodeLocked ? lockedBarcodeNote : undefined}
              onChange={(event) => {
                onChange("barcode", event.target.value);
              }}
              error={errors.barcode}
            />
          </div>
        </div>
      </section>
    </Card>
  );
}
