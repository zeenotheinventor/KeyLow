"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef, useState } from "react";

import { Body3DBoundary } from "./Body3DBoundary";
import { hasWebGL } from "./hasWebGL";

import type { Body3DProps } from "./types";
import type { BodyFigureValues } from "../BodyFigure";

import { useReducedMotion } from "@/lib/motion";
import { vars } from "@/lib/vars";

// The drawing code, three.js and the model load here, on first use, so no route's first load carries them.
// Only the files of the Body3DCanvas folder may import them (test/ui/body-3d-lazy-boundary.test.ts).
const Body3DCanvas = dynamic(() => import("./Body3DCanvas").then((loaded) => loaded.Body3DCanvas), {
  ssr: false,
});

// The 200 by 440 drawing of `BodyFigure`, so the 3D body takes the 2D figure's place at the same size.
const DRAWING_WIDTH = 200;
const DRAWING_HEIGHT = 440;
// How long the muscles take to ease to a new look and the body to turn to a new side: the standard 220 ms.
const STANDARD_MOTION_MILLISECONDS = 220;

// One empty object, so a caller that leaves `values` out does not hand the canvas a new set every render.
const NO_VALUES: BodyFigureValues = {};

/** Calls `onError` the first time it is asked and never again, however many ways the body reports a failure. */
function useReportOnce(onError: (() => void) | undefined): () => void {
  const hasReported = useRef(false);
  const latest = useRef(onError);
  useEffect(() => {
    latest.current = onError;
  }, [onError]);
  return useCallback(() => {
    if (!hasReported.current) {
      hasReported.current = true;
      latest.current?.();
    }
  }, []);
}

/**
 * The male body in 3D on the web, drawn with WebGL and seen through a faint skin, with a clay head. Each muscle
 * takes the colour `BodyFigure` gives the same value on the same scale, the peak heat step glows, and a change of
 * values, selection or dimming eases over 220 ms, or at once with reduced motion. `side` turns the body there by
 * the shorter arc. It is one image with the label, and it is always drawn for a dark stage.
 *
 * The drawing code and the model load on first use. It writes nothing on screen when it cannot draw: with no
 * WebGL, a lost context or a model that cannot be read it draws nothing and calls `onError` once, and the caller
 * draws the 2D figure. `onFirstFrame` tells the caller the body is on the screen.
 */
export function Body3D({
  label,
  w,
  side = "front",
  scale = "heat",
  values = NO_VALUES,
  selected,
  dim = 1,
  unselectedOpacity = 1,
  onFirstFrame,
  onError,
}: Body3DProps) {
  const [canDraw] = useState(hasWebGL);
  const reportError = useReportOnce(onError);
  const motionMilliseconds = useReducedMotion() ? 0 : STANDARD_MOTION_MILLISECONDS;
  const height = (w * DRAWING_HEIGHT) / DRAWING_WIDTH;

  useEffect(() => {
    if (!canDraw) {
      reportError();
    }
  }, [canDraw, reportError]);

  return (
    <div
      aria-label={label}
      className="h-[var(--body-height)] w-[var(--body-width)]"
      role="img"
      // The size is the caller's width, which no class can name.
      style={vars({ "--body-width": `${w}px`, "--body-height": `${height}px` })}
    >
      {canDraw && (
        <Body3DBoundary onError={reportError}>
          <Body3DCanvas
            dim={dim}
            frameAspect={DRAWING_WIDTH / DRAWING_HEIGHT}
            motionMilliseconds={motionMilliseconds}
            scale={scale}
            selected={selected}
            side={side}
            unselectedOpacity={unselectedOpacity}
            values={values}
            onError={reportError}
            onFirstFrame={onFirstFrame}
          />
        </Body3DBoundary>
      )}
    </div>
  );
}
