import { BODY_MAP, describeBodyFigureLabel } from "@keylow/core/copy";
import { iconStroke } from "@keylow/tokens";
import { ArrowRightLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { useId } from "react";

import type { TrainBodyMapCardProps } from "./types";

import { ViewLabel } from "@/components/body/ViewLabel";
import { BodyFigure } from "@/components/ui/BodyFigure";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { HeatLegendStrip } from "@/components/ui/HeatLegendStrip";

const FIGURE_WIDTH = 120;
const BODY_MAP_HREF = "/body-map";

/**
 * The body map on the Train page as its board draws it, in the right-hand column: the view and its moment
 * on the left, and on the right the button that switches between Actual and Projected and the link that
 * opens the body map. Under them are the front and the back at 120 pixels with the heat legend beside
 * them, then the muscles that are warmest, and, when Projected is off, the line that says why. The figures
 * are plain images, drawn as the figure setting has them, and the front one points to the body map in its
 * name. The card holds no state: the view and its words come from the screen that reads the numbers.
 */
export function TrainBodyMapCard({
  view,
  values,
  body,
  viewLabel,
  subLine,
  toggleLabel,
  isToggleEnabled,
  note,
  warmLine,
  onToggle,
}: TrainBodyMapCardProps) {
  const noteId = useId();
  const figureLabel = (side: "front" | "back") =>
    describeBodyFigureLabel({
      scale: "heat",
      view,
      side,
      hint: side === "front" ? "openBodyMap" : null,
    });

  return (
    <Card asChild>
      <section aria-label={BODY_MAP.title} className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-2">
          <ViewLabel
            className="min-w-0 flex-1"
            isProjected={view === "projected"}
            label={viewLabel}
            subLine={subLine}
          />
          <div className="flex shrink-0 items-center gap-1">
            <Button
              aria-describedby={note === null ? undefined : noteId}
              disabled={!isToggleEnabled}
              className="text-label-small"
              size="sm"
              variant="secondary"
              onClick={onToggle}
            >
              <ArrowRightLeft aria-hidden strokeWidth={iconStroke} />
              {toggleLabel}
            </Button>
            <Button asChild iconOnly size="sm" variant="ghost" className="text-text-secondary">
              <Link aria-label={BODY_MAP.trainCard.openName} href={BODY_MAP_HREF}>
                <ChevronRight aria-hidden strokeWidth={iconStroke} />
              </Link>
            </Button>
          </div>
        </div>
        <div className="flex items-end justify-center gap-3 sm:gap-8 xl:gap-5">
          <BodyFigure
            body={body}
            label={figureLabel("front")}
            scale="heat"
            side="front"
            values={values}
            w={FIGURE_WIDTH}
          />
          <BodyFigure
            body={body}
            label={figureLabel("back")}
            scale="heat"
            side="back"
            values={values}
            w={FIGURE_WIDTH}
          />
          <HeatLegendStrip />
        </div>
        {warmLine === null ? null : (
          <p className="text-center text-caption text-text-muted">{warmLine}</p>
        )}
        {note === null ? null : (
          <p id={noteId} className="text-center text-caption text-text-muted">
            {note}
          </p>
        )}
      </section>
    </Card>
  );
}
