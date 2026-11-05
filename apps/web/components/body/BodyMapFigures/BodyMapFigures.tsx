import { BODY_TAP_SLOP } from "@keylow/body-3d/touch";
import { BODY_MAP, describeBodyFigureLabel } from "@keylow/core/copy";
import { useRef } from "react";

import type { BodyMapFiguresProps } from "./types";
import type { BodyMapView } from "@keylow/core/training";
import type { MouseEvent } from "react";

import { BodyFigure } from "@/components/ui/BodyFigure";
import { cn } from "@/lib/utils";

const SIDES = ["front", "back"] as const;
const VIEWS = ["actual", "projected"] as const satisfies readonly BodyMapView[];

// The drawing is 200 by 440. It is 140 wide on a phone and 200 wide from the desktop breakpoint, as the
// boards draw it, so the width is a class and the figure's own height follows its width.
const FIGURE_WIDTH = 200;

// How strongly the muscles that are not the selected one show while its sheet is open.
const UNSELECTED_OPACITY = 0.4;

/**
 * The front and the back of the body side by side with each name under it, coloured by the heat of the view.
 * A click anywhere on them calls `onTap`, and a drag that ends in a click does not. The figures are plain
 * images, so a screen reader reaches the other view through the toggle button and not through this click.
 * Both views are drawn one over the other and the one that is not shown fades out over 220 ms while the
 * other fades in, or is swapped at once under prefers-reduced-motion. The one that is not shown is hidden
 * from a screen reader. With `onLongPressMuscle` the muscles of the shown view are buttons, and the hidden
 * view keeps plain figures, so Tab never reaches it. A figure given a muscle handler stops the click of a
 * muscle, so a short click on one calls `onTap` as a click anywhere else does.
 */
export function BodyMapFigures({
  view,
  actualValues,
  projectedValues,
  body,
  onTap,
  onLongPressMuscle,
  selected,
}: BodyMapFiguresProps) {
  const pressedAt = useRef<{ x: number; y: number } | null>(null);
  const valuesOf = (layer: BodyMapView) => (layer === "projected" ? projectedValues : actualValues);

  const handleClick = (event: MouseEvent) => {
    const start = pressedAt.current;
    pressedAt.current = null;
    if (
      start !== null &&
      Math.hypot(event.clientX - start.x, event.clientY - start.y) > BODY_TAP_SLOP
    ) {
      return;
    }
    onTap?.();
  };

  // A figure given a muscle handler stops the click of a muscle, so the tap is passed on from here.
  const handleMusclePress = () => {
    onTap?.();
  };

  return (
    // The tap is a convenience, and the visible toggle button is the way a keyboard reaches the same switch.
    <div
      role="presentation"
      className="flex justify-center gap-10 xl:gap-16"
      onMouseDown={(event) => {
        pressedAt.current = { x: event.clientX, y: event.clientY };
      }}
      onClick={handleClick}
    >
      {SIDES.map((side) => (
        <div key={side} className="flex flex-col items-center gap-1">
          <div className="grid w-[140px] xl:w-[200px] [&_svg]:h-auto [&_svg]:w-full">
            {VIEWS.map((layer) => (
              <div
                key={layer}
                aria-hidden={layer === view ? undefined : true}
                className={cn(
                  "col-start-1 row-start-1 transition-opacity duration-standard motion-reduce:transition-none",
                  layer === view ? "opacity-100" : "pointer-events-none opacity-0",
                )}
              >
                <BodyFigure
                  {...(layer === view && onLongPressMuscle !== undefined
                    ? { onLongPressMuscle, onPressMuscle: handleMusclePress }
                    : {})}
                  body={body}
                  label={describeBodyFigureLabel({ scale: "heat", view: layer, side, hint: null })}
                  scale="heat"
                  selected={selected}
                  side={side}
                  unselectedOpacity={UNSELECTED_OPACITY}
                  values={valuesOf(layer)}
                  w={FIGURE_WIDTH}
                />
              </div>
            ))}
          </div>
          <span className="text-caption text-text-muted">{BODY_MAP.sideSwitch[side]}</span>
        </div>
      ))}
    </div>
  );
}
