"use client";

import { BODY_TAP_SLOP } from "@keylow/body-3d/touch";
import { ZOOM_LIMITS } from "@keylow/body-3d/zoom";
import { BODY_MAP, describeZoomLevel } from "@keylow/core/copy";
import { iconStroke } from "@keylow/tokens";
import { Minus, Plus, RotateCcw } from "lucide-react";
import { useLayoutEffect, useRef, useState } from "react";

import type { BodyStageProps } from "./types";
import type { BodyViewPhase } from "@/components/body/BodyView";
import type { MouseEvent } from "react";

import { BodyView, useBody3DSupport } from "@/components/body/BodyView";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { IconButton } from "@/components/ui/IconButton";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { useElementSize } from "@/lib/useElementSize";
import { cn } from "@/lib/utils";

const SIDE_OPTIONS = [
  { value: "front", label: BODY_MAP.sideSwitch.front },
  { value: "back", label: BODY_MAP.sideSwitch.back },
] as const;

// The drawing is 200 by 440, and the stage is as high as the board draws it: 320 on a phone and 440 from the
// desktop breakpoint, where the body in it is 145 and 200 wide. Until the stage has been laid out the body is
// drawn at the desktop size.
const DRAWING_WIDTH = 200;
const DRAWING_HEIGHT = 440;
const FALLBACK_STAGE_SIZE = { width: DRAWING_WIDTH, height: DRAWING_HEIGHT };

const fade = "transition-opacity duration-standard motion-reduce:transition-none";

/**
 * One body on a dark stage, as the `web-body · 3d` boards draw it, with the Front and Back control and the zoom
 * buttons under it and the hint under those. The stage is dark in both themes (`--stage-background`), as the 3D body
 * is, and the backdrop darkens as the body fades in, over 220 ms, or at once with reduced motion. The 2D figure that
 * shows while the 3D body loads, or stays if it fails, sits on the clear stage, as does "Loading 3D…" at the corner
 * of the stage. If 3D fails the text goes, the stage stays clear and the 2D figure stays in the same place. A click
 * on the 2D figure is a tap while the 3D body has not drawn, and after that the 3D body takes the pointer, anywhere
 * on the stage and not only on the body. A hold on a muscle of the 3D body calls `onLongPressMuscle`, and so does a
 * hold or Enter on a muscle of the 2D figure that stays after a failure.
 * A pinch, a trackpad pinch and the plus and minus buttons zoom the 3D body, and two fingers pan it. While it is
 * zoomed, a pill at the top right of the stage shows the zoom, as "2×", and a Reset button eases the body back to the
 * whole body. The buttons are off until the body has drawn, Zoom out at the whole body and Zoom in at the closest.
 */
export function BodyStage({
  side,
  onSideChange,
  label,
  onTap,
  onLongPressMuscle,
  ...figureProps
}: BodyStageProps) {
  const { hasFailed } = useBody3DSupport();
  const [reportedPhase, setPhase] = useState<BodyViewPhase>("loading");
  const [zoom, setZoom] = useState<number>(ZOOM_LIMITS.min);
  const [zoomRequests, setZoomRequests] = useState({ reset: 0, closer: 0, back: 0 });
  const { reference: stageReference, size } = useElementSize<HTMLDivElement>();
  const { width: stageWidth, height: stageHeight } = size ?? FALLBACK_STAGE_SIZE;
  const pressedAt = useRef<{ x: number; y: number } | null>(null);
  const zoomInButton = useRef<HTMLButtonElement>(null);
  const zoomOutButton = useRef<HTMLButtonElement>(null);
  // The button the person last pressed, until the zoom it asked for has been reported, so focus can be kept.
  const pressed = useRef<"closer" | "back" | "reset" | null>(null);
  // After a failure `BodyView` draws the 2D figure alone and reports nothing, so a stage drawn after one, such as by
  // switching More to 2D and back to 3D, must not wait for a report.
  const phase = hasFailed ? "failed" : reportedPhase;
  const isDrawn = phase === "drawn";

  // A click that follows a drag is not a tap. The 3D body makes its own taps, so this is only for the 2D figure.
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

  // A button that turns itself off, or takes itself away, would drop the keyboard's place on the page. Focus goes to the
  // button that is left, once the zoom the press asked for is known: Zoom out when Zoom in reaches the closest zoom,
  // Zoom in when Zoom out reaches the whole body, and Zoom in when Reset goes.
  useLayoutEffect(() => {
    const was = pressed.current;
    pressed.current = null;
    if (was === "closer" && zoom >= ZOOM_LIMITS.max) {
      zoomOutButton.current?.focus();
    } else if ((was === "back" && zoom <= ZOOM_LIMITS.min) || was === "reset") {
      zoomInButton.current?.focus();
    }
  }, [zoom]);

  const request = (kind: keyof typeof zoomRequests) => {
    pressed.current = kind;
    setZoomRequests((requests) => ({ ...requests, [kind]: requests[kind] + 1 }));
  };

  return (
    <div className="flex flex-col gap-3">
      {/* The click is a convenience for the 2D figure, and the toggle button is the way a keyboard reaches the same switch. */}
      <div
        ref={stageReference}
        role="presentation"
        className="relative flex h-[320px] items-center justify-center overflow-hidden rounded-medium xl:h-[440px]"
        {...(isDrawn
          ? {}
          : {
              onMouseDown: (event: MouseEvent) => {
                pressedAt.current = { x: event.clientX, y: event.clientY };
              },
              onClick: handleClick,
            })}
      >
        <div
          aria-hidden
          className={cn(
            "pointer-events-none absolute inset-0 bg-stage-background",
            fade,
            isDrawn ? "opacity-100" : "opacity-0",
          )}
        />
        <BodyView
          {...figureProps}
          // After a failure the 2D figure stays with a button for each muscle, as in the 2D layout, and a short click
          // on one is still a tap. While the 3D body loads and after it has drawn there are no muscle buttons.
          {...(onLongPressMuscle === undefined
            ? {}
            : {
                onLongPressMuscle,
                onPressMuscle: () => {
                  onTap?.();
                },
              })}
          side={side}
          label={label}
          w={Math.round((stageHeight * DRAWING_WIDTH) / DRAWING_HEIGHT)}
          touchWidth={stageWidth}
          zoomResetCount={zoomRequests.reset}
          zoomInCount={zoomRequests.closer}
          zoomOutCount={zoomRequests.back}
          onSideChange={onSideChange}
          onTap={onTap}
          onPhaseChange={setPhase}
          onZoomChange={setZoom}
        />
        {isDrawn && zoom > ZOOM_LIMITS.min ? (
          <div className="absolute top-2 right-2 flex items-center gap-2">
            <Badge className="tabular-nums">{describeZoomLevel(zoom)}</Badge>
            <Button
              aria-label={BODY_MAP.zoom.resetName}
              size="sm"
              variant="secondary"
              onClick={() => {
                request("reset");
              }}
            >
              <RotateCcw aria-hidden strokeWidth={iconStroke} />
              {BODY_MAP.zoom.reset}
            </Button>
          </div>
        ) : null}
        {phase === "loading" ? (
          <span role="status" className="absolute right-2 bottom-2 text-caption text-text-muted">
            {BODY_MAP.loading3d}
          </span>
        ) : null}
      </div>
      <div className="flex items-center justify-between gap-2">
        <SegmentedControl
          label={BODY_MAP.sideSwitch.name}
          options={SIDE_OPTIONS}
          value={side}
          onChange={onSideChange}
          className="w-[180px]"
        />
        <div role="group" aria-label={BODY_MAP.zoom.groupName} className="flex gap-2">
          <IconButton
            ref={zoomOutButton}
            icon={Minus}
            label={BODY_MAP.zoom.out}
            size="card"
            disabled={!isDrawn || zoom <= ZOOM_LIMITS.min}
            onClick={() => {
              request("back");
            }}
          />
          <IconButton
            ref={zoomInButton}
            icon={Plus}
            label={BODY_MAP.zoom.in}
            size="card"
            disabled={!isDrawn || zoom >= ZOOM_LIMITS.max}
            onClick={() => {
              request("closer");
            }}
          />
        </div>
      </div>
      <p className="text-center text-caption text-text-muted">{BODY_MAP.rotateHintWeb}</p>
    </div>
  );
}
