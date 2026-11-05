import { WHOLE_BODY_VIEW, viewAfterPinch, viewAtRest } from "@keylow/body-3d/zoom";
import { useCallback, useEffect, useRef } from "react";

import type { BodyPose } from "./bodyPose";
import type { Body3DProps } from "./types";

/** How much closer or further a step of the plus and minus is: half of the way from the whole body to the closest. */
const ZOOM_STEP = 0.5;

/** The zoom to one decimal place, which is what a pill over the body shows. */
const shownZoom = (zoom: number): number => Math.round(zoom * 10) / 10;

/**
 * Tells the caller the zoom, to one decimal place, and only when it differs from the zoom it last told, so a
 * screen that shows it renders when the zoom is settled and not while the fingers move.
 */
export function useZoomReport(onZoomChange: Body3DProps["onZoomChange"]): (zoom: number) => void {
  const reported = useRef(WHOLE_BODY_VIEW.zoom);
  const latest = useRef(onZoomChange);
  useEffect(() => {
    latest.current = onZoomChange;
  });
  return useCallback((zoom) => {
    const shown = shownZoom(zoom);
    if (shown !== reported.current) {
      reported.current = shown;
      latest.current?.(shown);
    }
  }, []);
}

type ZoomRequests = {
  pose: BodyPose;
  resetCount: number;
  zoomInCount: number;
  zoomOutCount: number;
  bodyWidth: number;
  height: number;
  motionMilliseconds: number;
  reportZoom: (zoom: number) => void;
};

/**
 * Answers the screen's buttons. Raising `resetCount` eases the view back to the whole body, and raising `zoomInCount`
 * or `zoomOutCount` steps half a zoom, each over the standard motion, or at once with none. The caller is told the
 * zoom it is heading to as the ease starts. A count that is not raised does nothing, and the count a body starts
 * with is not a request.
 */
export function useZoomRequests({
  pose,
  resetCount,
  zoomInCount,
  zoomOutCount,
  bodyWidth,
  height,
  motionMilliseconds,
  reportZoom,
}: ZoomRequests) {
  const answered = useRef({ resetCount, zoomInCount, zoomOutCount });

  useEffect(() => {
    const bounds = { body: { width: bodyWidth, height } };
    // A step is from where the last step is heading, so two quick clicks are two steps.
    const stepBy = (change: number) => {
      const { zoom } = pose.viewTarget;
      const target = viewAtRest(
        viewAfterPinch(pose.viewTarget, (zoom + change) / zoom, { x: 0, y: 0 }, bounds),
      );
      reportZoom(target.zoom);
      pose.easeViewTo(target, motionMilliseconds);
    };
    if (resetCount !== answered.current.resetCount) {
      answered.current.resetCount = resetCount;
      reportZoom(WHOLE_BODY_VIEW.zoom);
      pose.easeViewTo(WHOLE_BODY_VIEW, motionMilliseconds);
    }
    if (zoomInCount !== answered.current.zoomInCount) {
      answered.current.zoomInCount = zoomInCount;
      stepBy(ZOOM_STEP);
    }
    if (zoomOutCount !== answered.current.zoomOutCount) {
      answered.current.zoomOutCount = zoomOutCount;
      stepBy(-ZOOM_STEP);
    }
  }, [
    pose,
    resetCount,
    zoomInCount,
    zoomOutCount,
    bodyWidth,
    height,
    motionMilliseconds,
    reportZoom,
  ]);
}
