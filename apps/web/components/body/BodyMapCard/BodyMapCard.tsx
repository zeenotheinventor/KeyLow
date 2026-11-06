import { BODY_MAP } from "@keylow/core/copy";
import { iconStroke } from "@keylow/tokens";
import { ArrowRightLeft, Columns2 } from "lucide-react";
import { useId, useState } from "react";

import type { BodyMapCardProps } from "./types";
import type { BodyArtworkSide } from "@keylow/core/training";

import { BodyMapFigures } from "@/components/body/BodyMapFigures";
import { useBody3DLayout } from "@/components/body/BodyView";
import { ViewLabel } from "@/components/body/ViewLabel";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { IconButton } from "@/components/ui/IconButton";
import { SegmentedControl } from "@/components/ui/SegmentedControl";

const SIDE_OPTIONS = [
  { value: "front", label: BODY_MAP.sideSwitch.front },
  { value: "back", label: BODY_MAP.sideSwitch.back },
] as const;

// Two thirds of the way down the figures, where the board lays the strip over the legs, 12 in from each side.
// A share of the height keeps it there when the figures are narrower, and from the tablet width it is the
// width of a Toast, centred, since a strip across both figures would be wider than its words need.
const OVERLAY_PLACEMENT = "absolute inset-x-3 top-[67%] z-10 mx-auto md:max-w-[360px]";

/**
 * The body map as the web board draws it: the view label, the toggle that switches between Actual and
 * Projected, and the front and back of the body with a line under them. The toggle button sits at the top
 * right of the card from the tablet breakpoint and under the figures on a phone, where the board centres
 * it. It is named for the view it switches to, and when it is off the line under the figures says why.
 * A click on the figures switches too. Gap has neither the button nor the click, and its line under the
 * figures is the note on what the plan left behind.
 *
 * With `onToggleSideBySide` the Show side by side button sits at the top right of the card. While
 * `sideBySide` is given the card is the side by side view, with the small Front and Back switch in the view
 * label's place. A `footer` closes the card, as the day scrubber does. An `overlay` is laid over the figures
 * two thirds of the way down, where the board lays the first-open hint over the legs, and only on the 2D
 * figures.
 *
 * With 3D chosen in More, a figure that has a 3D body and a browser that can draw it, the figures are one body on a
 * dark stage with the Front and Back control, the zoom buttons and the hint under it. The layout is decided when the
 * card first draws, so a failure of the 3D body after that leaves the card as it is, with the 2D figure in the stage.
 * A click on the body still switches the view and a drag does not. Side by side is always 2D.
 */
export function BodyMapCard({
  scale,
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
  onLongPressMuscle,
  selectedMuscle,
  selectedView,
  sideBySide,
  onToggleSideBySide,
  isSideBySideEnabled = true,
  overlay,
  footer,
}: BodyMapCardProps) {
  const noteId = useId();
  const isSideBySide = sideBySide !== undefined;
  const isIn3d = useBody3DLayout(body) && !isSideBySide;
  // The side the 3D body faces, which the control under it and a drag of the body both set.
  const [side3d, setSide3d] = useState<BodyArtworkSide>("front");

  return (
    <Card asChild padding="none">
      <section
        aria-label={BODY_MAP.title}
        className={`grid grid-cols-[1fr_auto] gap-3 p-3 xl:w-[680px] xl:shrink-0 xl:p-5 ${
          onToggleSideBySide === undefined
            ? "md:grid-cols-[1fr_auto]"
            : "md:grid-cols-[1fr_auto_auto]"
        }`}
      >
        {sideBySide === undefined ? (
          <ViewLabel
            label={viewLabel}
            subLine={subLine}
            isProjected={scale !== "gap" && view === "projected"}
            className="md:col-start-1 md:row-start-1"
          />
        ) : (
          <SegmentedControl
            label={BODY_MAP.sideSwitch.name}
            options={SIDE_OPTIONS}
            value={sideBySide.side}
            onChange={sideBySide.onSideChange}
            size="sm"
            className="w-40 self-start md:col-start-1 md:row-start-1"
          />
        )}
        {onToggleSideBySide === undefined ? null : (
          <div className="self-start md:col-start-3 md:row-start-1">
            <IconButton
              icon={Columns2}
              label={BODY_MAP.sideBySideName}
              size="card"
              isSelected={isSideBySide}
              aria-pressed={isSideBySide}
              disabled={!isSideBySideEnabled}
              onClick={onToggleSideBySide}
            />
          </div>
        )}
        <div className="relative col-span-full md:row-start-2">
          <BodyMapFigures
            scale={scale}
            view={view}
            actualValues={actualValues}
            projectedValues={projectedValues}
            body={body}
            onTap={isToggleEnabled && !isSideBySide ? onToggle : undefined}
            onLongPressMuscle={onLongPressMuscle}
            selected={selectedMuscle}
            selectedView={selectedView}
            sideBySide={sideBySide}
            in3d={isIn3d ? { side: side3d, onSideChange: setSide3d } : undefined}
          />
          {overlay === undefined || isIn3d ? null : (
            <div className={OVERLAY_PLACEMENT}>{overlay}</div>
          )}
        </div>
        {toggleLabel === null ? null : (
          <Button
            variant="secondary"
            size="sm"
            disabled={!isToggleEnabled}
            aria-describedby={note === null ? undefined : noteId}
            onClick={onToggle}
            className="col-span-full justify-self-center md:col-span-1 md:col-start-2 md:row-start-1 md:justify-self-end"
          >
            <ArrowRightLeft aria-hidden strokeWidth={iconStroke} />
            {toggleLabel}
          </Button>
        )}
        {note === null ? null : (
          <p
            id={noteId}
            className="col-span-full text-center text-caption text-text-secondary md:row-start-3"
          >
            {note}
          </p>
        )}
        {footer === undefined ? null : (
          <div
            className={
              note === null ? "col-span-full md:row-start-3" : "col-span-full md:row-start-4"
            }
          >
            {footer}
          </div>
        )}
      </section>
    </Card>
  );
}
