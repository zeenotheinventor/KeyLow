import { describe, expect, it } from "vitest";

import {
  WHOLE_BODY_VIEW,
  ZOOM_LIMITS,
  cameraShift,
  panLimit,
  viewAfterPan,
  viewAfterPinch,
  viewAtRest,
  zoomAfterPinch,
} from "../src/zoom";

// A body 100 wide and 220 high on the stage, as drawn at the whole body.
const bounds = { body: { width: 100, height: 220 } };

describe("ZOOM_LIMITS", () => {
  it("should run from the whole body to twice as close", () => {
    expect(ZOOM_LIMITS).toStrictEqual({ min: 1, max: 2 });
  });
});

describe("zoomAfterPinch", () => {
  it("should multiply the zoom by the scale of the pinch", () => {
    expect(zoomAfterPinch(1, 1.5)).toBeCloseTo(1.5);
    expect(zoomAfterPinch(1.5, 0.8)).toBeCloseTo(1.2);
  });

  it("should stop at the upper limit exactly and past it", () => {
    expect(zoomAfterPinch(1.5, 4 / 3)).toBeCloseTo(2);
    expect(zoomAfterPinch(1.9, 3)).toBe(2);
    expect(zoomAfterPinch(2, 1.01)).toBe(2);
  });

  it("should stop at the whole body exactly and past it", () => {
    expect(zoomAfterPinch(2, 0.5)).toBeCloseTo(1);
    expect(zoomAfterPinch(1.2, 0.1)).toBe(1);
    expect(zoomAfterPinch(1, 0.99)).toBe(1);
  });

  it("should take limits of its own", () => {
    expect(zoomAfterPinch(1, 5, { min: 1, max: 3 })).toBe(3);
  });
});

describe("panLimit", () => {
  it("should be nothing either way at the whole body", () => {
    expect(panLimit(1, bounds)).toStrictEqual({ x: 0, y: 0 });
  });

  it("should be half the body's extent on each axis at twice the size", () => {
    expect(panLimit(2, bounds)).toStrictEqual({ x: 50, y: 110 });
  });

  it("should grow smoothly with the zoom, by half the body's extent for each whole step", () => {
    expect(panLimit(1.5, bounds)).toStrictEqual({ x: 25, y: 55 });
    expect(panLimit(1.2, bounds).x).toBeCloseTo(10);
  });
});

describe("viewAfterPinch", () => {
  it("should zoom about the middle of the stage when the pinch is there", () => {
    expect(viewAfterPinch(WHOLE_BODY_VIEW, 1.5, { x: 0, y: 0 }, bounds)).toStrictEqual({
      zoom: 1.5,
      x: 0,
      y: 0,
    });
  });

  it("should keep the point under the fingers where it was, so a pinch over the legs zooms the legs", () => {
    const legs = { x: 0, y: 60 };

    const view = viewAfterPinch(WHOLE_BODY_VIEW, 1.5, legs, bounds);

    // A point at y on the body is drawn at zoom * y + offset, so the point at 60 is still at 60.
    expect(view.zoom * legs.y + view.y).toBeCloseTo(legs.y);
    expect(view.y).toBeCloseTo(-30);
  });

  it("should follow the fingers sideways too", () => {
    const view = viewAfterPinch(WHOLE_BODY_VIEW, 2, { x: 30, y: 0 }, bounds);

    expect(view.x).toBeCloseTo(-30);
  });

  it("should stop with the body's side at the fingers' side of the limit for a pinch at the side", () => {
    expect(viewAfterPinch(WHOLE_BODY_VIEW, 2, { x: 120, y: 0 }, bounds).x).toBe(-50);
    expect(viewAfterPinch(WHOLE_BODY_VIEW, 2, { x: -120, y: 0 }, bounds).x).toBe(50);
  });

  it("should stop with the head at the top of the stage when the pinch is at the head", () => {
    const view = viewAfterPinch(WHOLE_BODY_VIEW, 2, { x: 0, y: -110 }, bounds);

    expect(view.y).toBe(110);
  });

  it("should stop with the feet at the bottom of the stage when the pinch is at the feet", () => {
    const view = viewAfterPinch(WHOLE_BODY_VIEW, 2, { x: 0, y: 110 }, bounds);

    expect(view.y).toBe(-110);
  });

  it("should never move the body past the head or the feet for a pinch off the body", () => {
    expect(viewAfterPinch(WHOLE_BODY_VIEW, 2, { x: 0, y: 500 }, bounds).y).toBe(-110);
    expect(viewAfterPinch(WHOLE_BODY_VIEW, 2, { x: 0, y: -500 }, bounds).y).toBe(110);
  });

  it("should leave the body in the middle again when the pinch brings it back to the whole body", () => {
    const zoomedIn = viewAfterPinch(WHOLE_BODY_VIEW, 2, { x: 0, y: 110 }, bounds);

    const view = viewAfterPinch(zoomedIn, 0.5, { x: 0, y: 110 }, bounds);

    expect(view.zoom).toBeCloseTo(1);
    expect(view.y).toBeCloseTo(0);
  });

  it("should keep the pan inside the new, smaller limit when it zooms out", () => {
    const zoomedIn = { zoom: 2, x: 0, y: 110 };

    const view = viewAfterPinch(zoomedIn, 0.75, { x: 0, y: 0 }, bounds);

    expect(Math.abs(view.y)).toBeLessThanOrEqual(panLimit(view.zoom, bounds).y);
  });

  it("should not move the body at the zoom limit, because the zoom did not change", () => {
    const atLimit = { zoom: 2, x: 0, y: 40 };

    expect(viewAfterPinch(atLimit, 1.3, { x: 0, y: -50 }, bounds)).toStrictEqual(atLimit);
  });
});

describe("viewAfterPan", () => {
  it("should move the zoomed view by the fingers' move", () => {
    expect(viewAfterPan({ zoom: 2, x: 0, y: 0 }, { x: 0, y: -30 }, bounds)).toStrictEqual({
      zoom: 2,
      x: 0,
      y: -30,
    });
  });

  it("should stop at the head and at the feet", () => {
    const zoomed = { zoom: 2, x: 0, y: 100 };

    expect(viewAfterPan(zoomed, { x: 0, y: 50 }, bounds).y).toBe(110);
    expect(viewAfterPan({ ...zoomed, y: -100 }, { x: 0, y: -50 }, bounds).y).toBe(-110);
  });

  it("should stop at each side, half the body's width from the middle at twice the size", () => {
    const zoomed = { zoom: 2, x: 40, y: 0 };

    expect(viewAfterPan(zoomed, { x: 30, y: 0 }, bounds).x).toBe(50);
    expect(viewAfterPan({ ...zoomed, x: -40 }, { x: -30, y: 0 }, bounds).x).toBe(-50);
  });

  it("should stop sooner at a smaller zoom", () => {
    expect(viewAfterPan({ zoom: 1.5, x: 0, y: 0 }, { x: 90, y: 0 }, bounds).x).toBe(25);
  });

  it("should leave the whole body where it is, because there is nothing to pan", () => {
    expect(viewAfterPan(WHOLE_BODY_VIEW, { x: 60, y: -60 }, bounds)).toStrictEqual(WHOLE_BODY_VIEW);
  });
});

describe("viewAtRest", () => {
  it("should leave a zoom well past the whole body as it is", () => {
    const view = { zoom: 1.5, x: 0, y: 20 };

    expect(viewAtRest(view)).toStrictEqual(view);
  });

  it("should settle a zoom that is hardly past the whole body on the whole body, centred", () => {
    expect(viewAtRest({ zoom: 1.04, x: 0, y: 3 })).toStrictEqual(WHOLE_BODY_VIEW);
  });

  it("should keep a zoom of 1.05 or more", () => {
    expect(viewAtRest({ zoom: 1.05, x: 0, y: 3 }).zoom).toBe(1.05);
  });
});

describe("cameraShift", () => {
  it("should be nothing for the whole body", () => {
    expect(cameraShift(WHOLE_BODY_VIEW, 100)).toStrictEqual({ x: 0, y: 0 });
  });

  it("should move the camera up when the body is moved down, and left when it is moved right", () => {
    // 100 points to the metre, zoom 2: a body moved 100 points down is 0.5 m of the body, seen at twice the size.
    const shift = cameraShift({ zoom: 2, x: 100, y: 100 }, 100);

    expect(shift.x).toBeCloseTo(-0.5);
    expect(shift.y).toBeCloseTo(0.5);
  });
});
