import { BODY_MAP } from "@keylow/core/copy";
import { iconStroke } from "@keylow/tokens";
import { ArrowRightLeft } from "lucide-react";
import { useId } from "react";

import type { BodyMapCardProps } from "./types";

import { BodyMapFigures } from "@/components/body/BodyMapFigures";
import { ViewLabel } from "@/components/body/ViewLabel";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";

/**
 * The body map as the web board draws it: the view label, the toggle that switches between Actual and
 * Projected, and the front and back of the body with a line under them. The toggle button sits at the top
 * right of the card from the tablet breakpoint and under the figures on a phone, where the board centres
 * it. It is named for the view it switches to, and when it is off the line under the figures says why.
 * A click on the figures switches too.
 */
export function BodyMapCard({
  view,
  viewLabel,
  subLine,
  actualValues,
  projectedValues,
  body,
  toggleLabel,
  isToggleEnabled,
  onToggle,
  note,
}: BodyMapCardProps) {
  const noteId = useId();

  return (
    <Card asChild padding="none">
      <section
        aria-label={BODY_MAP.title}
        className="grid grid-cols-1 gap-3 p-3 md:grid-cols-[1fr_auto] xl:w-[680px] xl:shrink-0 xl:p-5"
      >
        <ViewLabel
          label={viewLabel}
          subLine={subLine}
          isProjected={view === "projected"}
          className="md:col-start-1 md:row-start-1"
        />
        <div className="md:col-span-2 md:row-start-2">
          <BodyMapFigures
            view={view}
            actualValues={actualValues}
            projectedValues={projectedValues}
            body={body}
            onTap={isToggleEnabled ? onToggle : undefined}
          />
        </div>
        <Button
          variant="secondary"
          size="sm"
          disabled={!isToggleEnabled}
          aria-describedby={note === null ? undefined : noteId}
          onClick={onToggle}
          className="justify-self-center md:col-start-2 md:row-start-1 md:justify-self-end"
        >
          <ArrowRightLeft aria-hidden strokeWidth={iconStroke} />
          {toggleLabel}
        </Button>
        {note === null ? null : (
          <p
            id={noteId}
            className="text-center text-caption text-text-secondary md:col-span-2 md:row-start-3"
          >
            {note}
          </p>
        )}
      </section>
    </Card>
  );
}
