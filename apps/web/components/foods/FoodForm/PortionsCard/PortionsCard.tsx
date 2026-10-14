import { FOOD_FORM, describeAmountUnitNote } from "@keylow/core/copy";
import { iconStroke } from "@keylow/tokens";
import { Plus } from "lucide-react";
import { useId } from "react";

import { PortionRow } from "../PortionRow";

import type { PortionsCardProps } from "./types";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

/** The portions of the food, each with its own row, then the note on units and the way to add one. */
export function PortionsCard({
  basis,
  portions,
  errors,
  idPrefix,
  onAdd,
  onChange,
  onDefaultChange,
  onRemove,
}: PortionsCardProps) {
  const headingId = useId();

  return (
    <Card asChild className="flex flex-col gap-3 shadow-none">
      <section aria-labelledby={headingId}>
        <h2 id={headingId} className="text-body-strong">
          {FOOD_FORM.portions}
        </h2>
        {portions.length > 0 && (
          <ul className="flex flex-col gap-3">
            {portions.map((portion, index) => (
              <PortionRow
                key={portion.key}
                idPrefix={`${idPrefix}-${portion.key}`}
                index={index}
                portion={portion}
                basis={basis}
                error={errors[index]}
                onLabelChange={(label) => {
                  onChange(portion.key, { label });
                }}
                onAmountChange={(amount) => {
                  onChange(portion.key, { amount });
                }}
                onDefaultChange={(isDefault) => {
                  onDefaultChange(portion.key, isDefault);
                }}
                onRemove={() => {
                  onRemove(portion.key);
                }}
              />
            ))}
          </ul>
        )}
        <span className="text-caption text-text-muted">{describeAmountUnitNote(basis)}</span>
        <Button
          type="button"
          variant="ghost"
          className="-ml-3 self-start border-0 px-3"
          onClick={onAdd}
        >
          <Plus aria-hidden strokeWidth={iconStroke} />
          {FOOD_FORM.addPortion}
        </Button>
      </section>
    </Card>
  );
}
