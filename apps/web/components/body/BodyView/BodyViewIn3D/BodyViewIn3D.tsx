"use client";

import { describeBodyFigureLoading3d } from "@keylow/core/copy";
import dynamic from "next/dynamic";
import { useCallback, useEffect, useState } from "react";

import { LoadFailureBoundary } from "./LoadFailureBoundary";

import type { BodyViewIn3DProps } from "./types";
import type { BodyViewPhase } from "../types";

import { BodyFigure } from "@/components/ui/BodyFigure";
import { cn } from "@/lib/utils";

// The 3D body, and with it the touch handling, loads here on first use, so a person on 2D never fetches it and no
// route's first load carries it. It reaches three.js and the model through its own lazy canvas.
const Body3D = dynamic(() => import("@/components/ui/Body3D").then((loaded) => loaded.Body3D), {
  ssr: false,
});

// How long the 3D body has to draw its first frame before the 2D figure is kept for good. The first load reads two
// chunks and the 2.6 MB model and compiles the shaders, which can take several seconds on a slow connection.
const FIRST_FRAME_TIMEOUT_MILLISECONDS = 8000;

/**
 * The 2D figure with the 3D body loading over it, in the one box. The 2D figure draws at once. When the 3D body
 * reports its first frame the 2D figure fades out as the 3D body fades in over 220 ms, with no fade when the person
 * has asked for reduced motion. If there is no first frame in 8 seconds, or the 3D body fails, or its code cannot be
 * fetched, the 2D figure stays, with no message, and `onFail` is called. The box keeps the 2D figure's size
 * throughout, and a screen reader finds one image with the label: the 2D figure, named as loading, until the 3D body
 * has drawn, then the 3D body. The 3D body gets the figure's value props, the side it faces and the calls that only it
 * makes, and takes the pointer once it has drawn, over `touchWidth` if the stage is wider than the body. A hold on a
 * muscle goes to the 3D body alone: the 2D figure that shows while it loads, or stays if it fails, makes no muscle a
 * button, so a click on it is still the click of the stage. `onPhaseChange` tells the stage around it where it is.
 */
export function BodyViewIn3D({
  onFail,
  onSideChange,
  onTap,
  onLongPressMuscle,
  onPressMuscle: _onPressMuscle,
  onZoomChange,
  zoomResetCount,
  zoomInCount,
  zoomOutCount,
  touchWidth,
  onPhaseChange,
  ...figureProps
}: BodyViewIn3DProps) {
  const { label, w, side, scale, values, selected, dim = 1, unselectedOpacity = 1 } = figureProps;
  const [phase, setPhase] = useState<BodyViewPhase>("loading");

  // Told at once, because `onFail` may take this component away before an effect could say it.
  const fail = useCallback(() => {
    setPhase("failed");
    onPhaseChange?.("failed");
    onFail();
  }, [onFail, onPhaseChange]);
  const showDrawn = useCallback(() => {
    setPhase((current) => (current === "loading" ? "drawn" : current));
  }, []);

  useEffect(() => {
    onPhaseChange?.(phase);
  }, [phase, onPhaseChange]);

  useEffect(() => {
    if (phase !== "loading") {
      return;
    }
    const timer = setTimeout(fail, FIRST_FRAME_TIMEOUT_MILLISECONDS);
    return () => {
      clearTimeout(timer);
    };
  }, [phase, fail]);

  const isDrawn = phase === "drawn";
  const fade = "transition-opacity duration-standard motion-reduce:transition-none";

  return (
    <div className="relative">
      {/* In the flow, so it gives the box its size, and it stays under the 3D body for good. */}
      <div
        aria-hidden={isDrawn ? true : undefined}
        className={cn(fade, isDrawn ? "pointer-events-none opacity-0" : "opacity-100")}
      >
        <BodyFigure
          {...figureProps}
          label={phase === "loading" ? describeBodyFigureLoading3d(label) : label}
        />
      </div>
      {phase === "failed" ? null : (
        // Once the 3D body has drawn it is the one that takes the pointer, to turn, zoom, press and hold. While it
        // loads, the 2D figure is under it and nothing is drawn to touch.
        <div
          aria-hidden={isDrawn ? undefined : true}
          className={cn(
            "absolute top-0 left-1/2 -translate-x-1/2",
            fade,
            isDrawn ? "opacity-100" : "pointer-events-none opacity-0",
          )}
        >
          <LoadFailureBoundary onError={fail}>
            <Body3D
              dim={dim}
              label={label}
              scale={scale}
              selected={selected}
              side={side}
              unselectedOpacity={unselectedOpacity}
              values={values}
              w={w}
              touchWidth={touchWidth}
              onError={fail}
              onFirstFrame={showDrawn}
              onSideChange={onSideChange}
              onTap={onTap}
              onLongPressMuscle={onLongPressMuscle}
              onZoomChange={onZoomChange}
              zoomResetCount={zoomResetCount}
              zoomInCount={zoomInCount}
              zoomOutCount={zoomOutCount}
            />
          </LoadFailureBoundary>
        </div>
      )}
    </div>
  );
}
