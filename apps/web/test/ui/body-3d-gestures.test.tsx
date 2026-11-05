import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { Body3DProps } from "@/components/ui/Body3D";
import type { Body3DCanvasProps } from "@/components/ui/Body3D/Body3DCanvas";
import type { MusclePicker } from "@/components/ui/Body3D/types";

import { Body3D } from "@/components/ui/Body3D";
import { hasWebGL } from "@/components/ui/Body3D/hasWebGL";

// jsdom has no WebGL, so the canvas is stood in for. It hands over the pose and the picker, as the real one does.
const drawn = vi.hoisted((): { props: Body3DCanvasProps[] } => ({ props: [] }));

vi.mock("@/components/ui/Body3D/hasWebGL", () => ({ hasWebGL: vi.fn() }));
vi.mock("@/components/ui/Body3D/Body3DCanvas", () => ({
  Body3DCanvas: (props: Body3DCanvasProps) => {
    drawn.props.push(props);
    return null;
  },
}));

const label = "Body map in 3D, front";
const BODY_WIDTH = 200;
const HOLD_MILLISECONDS = 500;

function pose() {
  const [latest] = drawn.props.slice(-1);
  if (latest === undefined) {
    throw new Error("The canvas was not drawn.");
  }
  return latest.pose;
}

function setPicker(picker: MusclePicker | null) {
  const [latest] = drawn.props.slice(-1);
  act(() => {
    latest?.onPickerChange?.(picker);
  });
}

type PointerInit = { id?: number; x?: number; y?: number; type?: string; button?: number };

function down(
  target: HTMLElement,
  { id = 1, x = 100, y = 200, type = "mouse", button = 0 }: PointerInit = {},
) {
  fireEvent.pointerDown(target, {
    pointerId: id,
    pointerType: type,
    clientX: x,
    clientY: y,
    button,
  });
}
function move(target: HTMLElement, { id = 1, x = 100, y = 200, type = "mouse" }: PointerInit = {}) {
  fireEvent.pointerMove(target, { pointerId: id, pointerType: type, clientX: x, clientY: y });
}
function up(target: HTMLElement, { id = 1, x = 100, y = 200, type = "mouse" }: PointerInit = {}) {
  fireEvent.pointerUp(target, { pointerId: id, pointerType: type, clientX: x, clientY: y });
}
function cancel(target: HTMLElement, { id = 1, type = "mouse" }: PointerInit = {}) {
  fireEvent.pointerCancel(target, { pointerId: id, pointerType: type });
}

/** A drag from x 100 that crosses the slop at x 120 and then moves `across` pixels. The turn is measured from 120. */
function dragAcross(target: HTMLElement, across: number) {
  down(target);
  move(target, { x: 120 });
  move(target, { x: 120 + across });
  return 120 + across;
}

async function renderBody(props: Partial<Body3DProps> = {}) {
  const view = render(<Body3D label={label} w={BODY_WIDTH} {...props} />);
  await vi.waitFor(() => {
    expect(drawn.props.length).toBeGreaterThan(0);
  });
  return { ...view, image: screen.getByRole("img", { name: label }) };
}

function stubReducedMotion(isReduced: boolean) {
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: isReduced && query === "(prefers-reduced-motion: reduce)",
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  }));
}

const setPointerCapture = vi.fn();
const releasePointerCapture = vi.fn();
const hasPointerCapture = vi.fn();

beforeEach(() => {
  drawn.props = [];
  vi.mocked(hasWebGL).mockReturnValue(true);
  // jsdom has no pointer capture, which a real browser does.
  Object.assign(HTMLElement.prototype, {
    setPointerCapture,
    releasePointerCapture,
    hasPointerCapture,
  });
  hasPointerCapture.mockReturnValue(true);
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  setPointerCapture.mockClear();
  releasePointerCapture.mockClear();
  hasPointerCapture.mockReset();
});

describe("the turn", () => {
  it("should turn half a turn for a drag across the body's width, from where the drag took hold", async () => {
    const { image } = await renderBody();

    dragAcross(image, BODY_WIDTH);

    expect(pose().yaw).toBeCloseTo(Math.PI);
  });

  it("should not turn for a move within the slop", async () => {
    const { image } = await renderBody();

    down(image);
    move(image, { x: 108 });

    expect(pose().yaw).toBe(0);
  });

  it("should turn the other way for a drag to the left", async () => {
    const { image } = await renderBody();

    dragAcross(image, -50);

    expect(pose().yaw).toBeCloseTo(-Math.PI / 4);
  });

  it("should turn from the side it was given", async () => {
    const { image } = await renderBody({ side: "back" });

    dragAcross(image, 50);

    expect(pose().yaw).toBeCloseTo(Math.PI + Math.PI / 4);
  });

  it("should settle on the back and call onSideChange when released nearer the back", async () => {
    const onSideChange = vi.fn();
    const { image } = await renderBody({ onSideChange });

    const endX = dragAcross(image, 150);
    up(image, { x: endX });
    act(() => {
      pose().step(220);
    });

    expect(pose().yaw).toBeCloseTo(Math.PI);
    expect(onSideChange).toHaveBeenCalledTimes(1);
    expect(onSideChange).toHaveBeenCalledWith("back");
  });

  it("should settle back on the front without calling onSideChange when released nearer the side it faces", async () => {
    const onSideChange = vi.fn();
    const { image } = await renderBody({ onSideChange });

    const endX = dragAcross(image, 40);
    up(image, { x: endX });
    act(() => {
      pose().step(220);
    });

    expect(pose().yaw).toBeCloseTo(0);
    expect(onSideChange).not.toHaveBeenCalled();
  });

  it("should call onSideChange with the front from a body that faces the back", async () => {
    const onSideChange = vi.fn();
    const { image } = await renderBody({ side: "back", onSideChange });

    const endX = dragAcross(image, 150);
    up(image, { x: endX });

    expect(onSideChange).toHaveBeenCalledWith("front");
  });

  it("should not call onSideChange while the pointer moves", async () => {
    const onSideChange = vi.fn();
    const { image } = await renderBody({ onSideChange });

    dragAcross(image, 150);

    expect(onSideChange).not.toHaveBeenCalled();
  });

  it("should settle over the standard 220 ms", async () => {
    const { image } = await renderBody();

    const endX = dragAcross(image, 150);
    up(image, { x: endX });
    const midway = pose().step(110);

    expect(midway).toBe(true);
    expect(pose().yaw).toBeGreaterThan(0.75 * Math.PI);
    expect(pose().yaw).toBeLessThan(Math.PI);
  });

  it("should settle at once with reduced motion", async () => {
    stubReducedMotion(true);
    const onSideChange = vi.fn();
    const { image } = await renderBody({ onSideChange });

    const endX = dragAcross(image, 150);
    up(image, { x: endX });

    expect(pose().yaw).toBe(Math.PI);
    expect(onSideChange).toHaveBeenCalledWith("back");
  });

  it("should turn at once when side changes with reduced motion", async () => {
    stubReducedMotion(true);
    const { rerender } = await renderBody();

    rerender(<Body3D label={label} side="back" w={BODY_WIDTH} />);

    expect(pose().yaw).toBe(Math.PI);
  });

  it("should turn by the shorter arc when side changes", async () => {
    const { rerender } = await renderBody();

    rerender(<Body3D label={label} side="back" w={BODY_WIDTH} />);
    act(() => {
      pose().step(220);
    });

    expect(pose().yaw).toBeCloseTo(Math.PI);
  });

  it("should settle a drag that the browser cancels, so the body never rests half turned", async () => {
    const { image } = await renderBody();

    dragAcross(image, 40);
    cancel(image);
    act(() => {
      pose().step(220);
    });

    expect(pose().yaw).toBeCloseTo(0);
  });

  it("should let a vertical swipe on a phone scroll the page", async () => {
    const { image } = await renderBody();

    // The browser reads this from the style sheet, which jsdom does not load, so the class is what is pinned.
    expect(image.parentElement?.classList.contains("touch-pan-y")).toBe(true);
  });

  it("should ignore a button that is not the main one", async () => {
    const { image } = await renderBody();

    down(image, { button: 2 });
    move(image, { x: 150 });
    move(image, { x: 250 });

    expect(pose().yaw).toBe(0);
  });
});

describe("the context menu", () => {
  it("should be kept from opening when the body takes a hold, since a touch hold opens it on some phones", async () => {
    const { image } = await renderBody({ onLongPressMuscle: vi.fn() });

    const wasNotPrevented = fireEvent.contextMenu(image);

    expect(wasNotPrevented).toBe(false);
  });

  it("should be left to the browser when the body takes no hold", async () => {
    const { image } = await renderBody();

    const wasNotPrevented = fireEvent.contextMenu(image);

    expect(wasNotPrevented).toBe(true);
  });
});

describe("the tap", () => {
  it("should call onTap once for a press that lifts where it went down", async () => {
    const onTap = vi.fn();
    const { image } = await renderBody({ onTap });

    down(image);
    up(image);

    expect(onTap).toHaveBeenCalledTimes(1);
  });

  it("should call onTap for a press that moves within the slop", async () => {
    const onTap = vi.fn();
    const { image } = await renderBody({ onTap });

    down(image);
    move(image, { x: 105, y: 204 });
    up(image, { x: 105, y: 204 });

    expect(onTap).toHaveBeenCalledTimes(1);
  });

  it("should not call onTap for a drag", async () => {
    const onTap = vi.fn();
    const { image } = await renderBody({ onTap });

    const endX = dragAcross(image, 100);
    up(image, { x: endX });

    expect(onTap).not.toHaveBeenCalled();
  });

  it("should not call onTap for a drag that comes back to where it went down", async () => {
    const onTap = vi.fn();
    const { image } = await renderBody({ onTap });

    down(image);
    move(image, { x: 160 });
    move(image, { x: 100 });
    up(image);

    expect(onTap).not.toHaveBeenCalled();
  });

  it("should not call onTap for a press the browser cancels", async () => {
    const onTap = vi.fn();
    const { image } = await renderBody({ onTap });

    down(image);
    cancel(image);

    expect(onTap).not.toHaveBeenCalled();
  });

  it("should call onTap again for the next press after a drag", async () => {
    const onTap = vi.fn();
    const { image } = await renderBody({ onTap });
    up(image, { x: dragAcross(image, 100) });

    down(image);
    up(image);

    expect(onTap).toHaveBeenCalledTimes(1);
  });
});

describe("pointer capture", () => {
  it("should capture the pointer that went down, so a drag out of the body is still followed", async () => {
    const { image } = await renderBody();

    down(image, { id: 7 });

    expect(setPointerCapture).toHaveBeenCalledWith(7);
  });

  it("should release it when the pointer lifts", async () => {
    const { image } = await renderBody();

    down(image, { id: 7 });
    up(image, { id: 7 });

    expect(releasePointerCapture).toHaveBeenCalledWith(7);
  });

  it("should release it when the browser cancels the pointer", async () => {
    const { image } = await renderBody();

    down(image, { id: 7 });
    cancel(image, { id: 7 });

    expect(releasePointerCapture).toHaveBeenCalledWith(7);
  });

  it("should take a move from a pointer that never went down as nothing", async () => {
    const { image } = await renderBody();

    move(image, { x: 250 });

    expect(pose().yaw).toBe(0);
  });

  it("should stop following a pointer that has lifted", async () => {
    const { image } = await renderBody();
    up(image, { x: dragAcross(image, 150) });
    act(() => {
      pose().step(220);
    });

    move(image, { x: 10 });

    expect(pose().yaw).toBeCloseTo(Math.PI);
  });
});

describe("the press and hold", () => {
  const chest = "chest_upper" as const;

  async function renderHolding(props: Partial<Body3DProps> = {}) {
    const onLongPressMuscle = vi.fn();
    const onTap = vi.fn();
    const rendered = await renderBody({ onLongPressMuscle, onTap, ...props });
    const picker = vi.fn<MusclePicker>().mockReturnValue(chest);
    setPicker(picker);
    vi.useFakeTimers();
    return { ...rendered, onLongPressMuscle, onTap, picker };
  }

  it("should name the muscle under the pointer after 500 ms", async () => {
    const { image, onLongPressMuscle, picker } = await renderHolding();

    down(image, { x: 90, y: 150 });
    vi.advanceTimersByTime(HOLD_MILLISECONDS);

    expect(picker).toHaveBeenCalledWith({ x: 90, y: 150 });
    expect(onLongPressMuscle).toHaveBeenCalledTimes(1);
    expect(onLongPressMuscle).toHaveBeenCalledWith(chest);
  });

  it("should name the muscle while the pointer is still down", async () => {
    const { image, onLongPressMuscle } = await renderHolding();

    down(image);
    vi.advanceTimersByTime(HOLD_MILLISECONDS);

    expect(onLongPressMuscle).toHaveBeenCalledTimes(1);
    up(image);
    expect(onLongPressMuscle).toHaveBeenCalledTimes(1);
  });

  it("should call nothing before 500 ms", async () => {
    const { image, onLongPressMuscle } = await renderHolding();

    down(image);
    vi.advanceTimersByTime(HOLD_MILLISECONDS - 1);

    expect(onLongPressMuscle).not.toHaveBeenCalled();
  });

  it("should measure the point from the top left of the touch area", async () => {
    const { image, picker } = await renderHolding();
    vi.spyOn(image.parentElement ?? image, "getBoundingClientRect").mockReturnValue(
      new DOMRect(30, 40, 200, 440),
    );

    down(image, { x: 130, y: 240 });
    vi.advanceTimersByTime(HOLD_MILLISECONDS);

    expect(picker).toHaveBeenCalledWith({ x: 100, y: 200 });
  });

  it("should move within the slop and still name the muscle", async () => {
    const { image, onLongPressMuscle } = await renderHolding();

    down(image);
    move(image, { x: 104, y: 205 });
    vi.advanceTimersByTime(HOLD_MILLISECONDS);

    expect(onLongPressMuscle).toHaveBeenCalledTimes(1);
  });

  it("should be cancelled by a move past the slop", async () => {
    const { image, onLongPressMuscle } = await renderHolding();

    down(image);
    expect(vi.getTimerCount()).toBe(1);
    move(image, { x: 130 });
    expect(vi.getTimerCount()).toBe(0);
    vi.advanceTimersByTime(HOLD_MILLISECONDS * 2);

    expect(onLongPressMuscle).not.toHaveBeenCalled();
  });

  it("should be cancelled by a move past the slop even if the pointer comes back", async () => {
    const { image, onLongPressMuscle } = await renderHolding();

    down(image);
    move(image, { x: 130 });
    move(image, { x: 100 });
    vi.advanceTimersByTime(HOLD_MILLISECONDS * 2);

    expect(onLongPressMuscle).not.toHaveBeenCalled();
  });

  it("should be cancelled by a release before 500 ms", async () => {
    const { image, onLongPressMuscle } = await renderHolding();

    down(image);
    up(image);
    vi.advanceTimersByTime(HOLD_MILLISECONDS * 2);

    expect(onLongPressMuscle).not.toHaveBeenCalled();
  });

  it("should be cancelled by a cancel of the pointer", async () => {
    const { image, onLongPressMuscle } = await renderHolding();

    down(image);
    cancel(image);
    expect(vi.getTimerCount()).toBe(0);
    vi.advanceTimersByTime(HOLD_MILLISECONDS * 2);

    expect(onLongPressMuscle).not.toHaveBeenCalled();
  });

  it("should be cancelled by a second finger", async () => {
    const { image, onLongPressMuscle } = await renderHolding();

    down(image, { id: 1, type: "touch" });
    down(image, { id: 2, type: "touch", x: 140 });
    expect(vi.getTimerCount()).toBe(0);
    vi.advanceTimersByTime(HOLD_MILLISECONDS * 2);

    expect(onLongPressMuscle).not.toHaveBeenCalled();
  });

  it("should not be a tap once it has fired", async () => {
    const { image, onTap } = await renderHolding();

    down(image);
    vi.advanceTimersByTime(HOLD_MILLISECONDS);
    up(image);

    expect(onTap).not.toHaveBeenCalled();
  });

  it("should not be a tap even when it names nothing", async () => {
    const { image, onLongPressMuscle, onTap, picker } = await renderHolding();
    picker.mockReturnValue(null);

    down(image);
    vi.advanceTimersByTime(HOLD_MILLISECONDS);
    up(image);

    expect(onLongPressMuscle).not.toHaveBeenCalled();
    expect(onTap).not.toHaveBeenCalled();
  });

  it("should call nothing while the canvas has no picker", async () => {
    const { image, onLongPressMuscle } = await renderHolding();
    setPicker(null);

    down(image);
    vi.advanceTimersByTime(HOLD_MILLISECONDS);

    expect(onLongPressMuscle).not.toHaveBeenCalled();
  });

  it("should not turn the body once it has fired", async () => {
    const { image } = await renderHolding();

    down(image);
    vi.advanceTimersByTime(HOLD_MILLISECONDS);
    move(image, { x: 160 });
    move(image, { x: 260 });

    expect(pose().yaw).toBe(0);
  });

  it("should name a muscle again for the next hold", async () => {
    const { image, onLongPressMuscle } = await renderHolding();
    down(image);
    vi.advanceTimersByTime(HOLD_MILLISECONDS);
    up(image);

    down(image);
    vi.advanceTimersByTime(HOLD_MILLISECONDS);

    expect(onLongPressMuscle).toHaveBeenCalledTimes(2);
  });

  it("should take no hold without a handler, and ask the canvas for nothing", async () => {
    const onTap = vi.fn();
    await renderBody({ onTap });
    const picker = vi.fn<MusclePicker>().mockReturnValue(chest);
    setPicker(picker);
    vi.useFakeTimers();
    const image = screen.getByRole("img", { name: label });

    down(image);
    vi.advanceTimersByTime(HOLD_MILLISECONDS * 2);
    up(image);

    expect(picker).not.toHaveBeenCalled();
    expect(onTap).toHaveBeenCalledTimes(1);
  });

  it("should stop asking when the body goes", async () => {
    const { image, onLongPressMuscle, unmount } = await renderHolding();

    down(image);
    unmount();
    vi.advanceTimersByTime(HOLD_MILLISECONDS * 2);

    expect(onLongPressMuscle).not.toHaveBeenCalled();
  });
});

describe("the zoom", () => {
  const stageCentre = { x: BODY_WIDTH / 2, y: 220 };

  /** Two fingers either side of the stage's middle, `gap` pixels apart. */
  function twoFingers(target: HTMLElement, gap: number) {
    return {
      start() {
        down(target, { id: 1, type: "touch", x: stageCentre.x - gap / 2, y: stageCentre.y });
        down(target, { id: 2, type: "touch", x: stageCentre.x + gap / 2, y: stageCentre.y });
      },
      spreadTo(next: number) {
        move(target, { id: 1, type: "touch", x: stageCentre.x - next / 2, y: stageCentre.y });
        move(target, { id: 2, type: "touch", x: stageCentre.x + next / 2, y: stageCentre.y });
      },
      lift(next: number) {
        up(target, { id: 1, type: "touch", x: stageCentre.x - next / 2, y: stageCentre.y });
        up(target, { id: 2, type: "touch", x: stageCentre.x + next / 2, y: stageCentre.y });
      },
    };
  }

  it("should zoom closer as two fingers spread", async () => {
    const { image } = await renderBody();
    const fingers = twoFingers(image, 100);

    fingers.start();
    fingers.spreadTo(150);

    expect(pose().view.zoom).toBeCloseTo(1.5);
  });

  it("should zoom back as two fingers close", async () => {
    const { image } = await renderBody();
    const fingers = twoFingers(image, 100);
    fingers.start();
    fingers.spreadTo(180);

    fingers.spreadTo(135);

    expect(pose().view.zoom).toBeCloseTo(1.35);
  });

  it("should stop at twice as close", async () => {
    const { image } = await renderBody();
    const fingers = twoFingers(image, 100);

    fingers.start();
    fingers.spreadTo(400);

    expect(pose().view.zoom).toBe(2);
  });

  it("should not zoom out past the whole body", async () => {
    const { image } = await renderBody();
    const fingers = twoFingers(image, 100);

    fingers.start();
    fingers.spreadTo(20);

    expect(pose().view.zoom).toBe(1);
  });

  it("should pan the zoomed body as two fingers move together", async () => {
    const { image } = await renderBody();
    const fingers = twoFingers(image, 100);
    fingers.start();
    fingers.spreadTo(200);
    const before = pose().view;

    move(image, { id: 1, type: "touch", x: stageCentre.x - 100 - 30, y: stageCentre.y + 40 });
    move(image, { id: 2, type: "touch", x: stageCentre.x + 100 - 30, y: stageCentre.y + 40 });

    expect(pose().view.zoom).toBe(2);
    expect(pose().view.x - before.x).toBeCloseTo(-30);
    expect(pose().view.y - before.y).toBeCloseTo(40);
  });

  it("should not turn the body or tap it", async () => {
    const onTap = vi.fn();
    const { image } = await renderBody({ onTap });
    const fingers = twoFingers(image, 100);

    fingers.start();
    fingers.spreadTo(150);
    fingers.lift(150);

    expect(pose().yaw).toBe(0);
    expect(onTap).not.toHaveBeenCalled();
  });

  it("should not turn the body when one finger of a pinch stays down", async () => {
    const { image } = await renderBody();
    const fingers = twoFingers(image, 100);
    fingers.start();
    fingers.spreadTo(150);

    up(image, { id: 2, type: "touch", x: stageCentre.x + 75, y: stageCentre.y });
    move(image, { id: 1, type: "touch", x: stageCentre.x - 75 + 80, y: stageCentre.y });

    expect(pose().yaw).toBe(0);
  });

  it("should report the zoom to one decimal place when the fingers let go", async () => {
    const onZoomChange = vi.fn();
    const { image } = await renderBody({ onZoomChange });
    const fingers = twoFingers(image, 100);
    fingers.start();
    fingers.spreadTo(157);

    expect(onZoomChange).not.toHaveBeenCalled();
    fingers.lift(157);

    expect(onZoomChange).toHaveBeenCalledTimes(1);
    expect(onZoomChange).toHaveBeenCalledWith(1.6);
  });

  it("should settle a zoom hardly past the whole body on the whole body, and report nothing new", async () => {
    const onZoomChange = vi.fn();
    const { image } = await renderBody({ onZoomChange });
    const fingers = twoFingers(image, 100);
    fingers.start();
    fingers.spreadTo(103);

    fingers.lift(103);

    expect(pose().view).toEqual({ zoom: 1, x: 0, y: 0 });
    expect(onZoomChange).not.toHaveBeenCalled();
  });

  it("should report once when the browser cancels a pinch", async () => {
    const onZoomChange = vi.fn();
    const { image } = await renderBody({ onZoomChange });
    const fingers = twoFingers(image, 100);
    fingers.start();
    fingers.spreadTo(150);

    cancel(image, { id: 1, type: "touch" });
    cancel(image, { id: 2, type: "touch" });

    expect(onZoomChange).toHaveBeenCalledTimes(1);
    expect(onZoomChange).toHaveBeenCalledWith(1.5);
  });

  describe("with a trackpad pinch, which is the wheel with ctrl held", () => {
    it("should zoom closer for a negative delta, and take the wheel from the page", async () => {
      const { image } = await renderBody();

      const wasNotPrevented = fireEvent.wheel(image, {
        ctrlKey: true,
        deltaY: -50,
        clientX: stageCentre.x,
        clientY: stageCentre.y,
      });

      expect(pose().view.zoom).toBeCloseTo(Math.exp(0.5));
      expect(wasNotPrevented).toBe(false);
    });

    it("should zoom back for a positive delta", async () => {
      const { image } = await renderBody();
      fireEvent.wheel(image, { ctrlKey: true, deltaY: -50 });

      fireEvent.wheel(image, { ctrlKey: true, deltaY: 20 });

      expect(pose().view.zoom).toBeCloseTo(Math.exp(0.3));
    });

    it("should zoom about the pointer, measured from the middle of a stage wider than the body", async () => {
      const { image } = await renderBody({ touchWidth: 360 });
      const height = (BODY_WIDTH * 440) / 200;

      fireEvent.wheel(image, { ctrlKey: true, deltaY: -50, clientX: 200, clientY: 120 });

      // The point under the pointer stays under it: 20 right of the stage's middle (180) and 100 above its middle (220).
      const ratio = Math.exp(0.5);
      expect(pose().view.x).toBeCloseTo(20 * (1 - ratio));
      expect(pose().view.y).toBeCloseTo((120 - height / 2) * (1 - ratio));
    });

    it("should not report after the body has gone", async () => {
      const onZoomChange = vi.fn();
      const { image, unmount } = await renderBody({ onZoomChange });
      vi.useFakeTimers();

      fireEvent.wheel(image, { ctrlKey: true, deltaY: -30 });
      unmount();
      vi.advanceTimersByTime(1000);

      expect(vi.getTimerCount()).toBe(0);
      expect(onZoomChange).not.toHaveBeenCalled();
    });

    it("should report the zoom once it has been still for a moment", async () => {
      const onZoomChange = vi.fn();
      const { image } = await renderBody({ onZoomChange });
      vi.useFakeTimers();

      fireEvent.wheel(image, { ctrlKey: true, deltaY: -30 });
      fireEvent.wheel(image, { ctrlKey: true, deltaY: -30 });
      vi.advanceTimersByTime(100);
      fireEvent.wheel(image, { ctrlKey: true, deltaY: -10 });
      vi.advanceTimersByTime(100);

      expect(onZoomChange).not.toHaveBeenCalled();
      vi.advanceTimersByTime(100);

      expect(onZoomChange).toHaveBeenCalledTimes(1);
      expect(onZoomChange).toHaveBeenCalledWith(2);
    });
  });

  describe("with a plain wheel", () => {
    it("should be left to scroll the page, neither prevented nor zoomed", async () => {
      const onZoomChange = vi.fn();
      const { image } = await renderBody({ onZoomChange });
      vi.useFakeTimers();

      const wasNotPrevented = fireEvent.wheel(image, { deltaY: -120 });
      vi.advanceTimersByTime(1000);

      expect(wasNotPrevented).toBe(true);
      expect(pose().view).toEqual({ zoom: 1, x: 0, y: 0 });
      expect(onZoomChange).not.toHaveBeenCalled();
    });

    it("should be left alone sideways too", async () => {
      const { image } = await renderBody();

      const wasNotPrevented = fireEvent.wheel(image, { deltaX: 80, deltaY: 0 });

      expect(wasNotPrevented).toBe(true);
      expect(pose().yaw).toBe(0);
    });
  });

  describe("a reset", () => {
    it("should ease back to the whole body over 220 ms when the count is raised", async () => {
      const { image, rerender } = await renderBody();
      fireEvent.wheel(image, { ctrlKey: true, deltaY: -100 });
      expect(pose().view.zoom).toBe(2);

      rerender(<Body3D label={label} w={BODY_WIDTH} zoomResetCount={1} />);
      act(() => {
        pose().step(110);
      });
      expect(pose().view.zoom).toBeCloseTo(1.5);
      act(() => {
        pose().step(110);
      });

      expect(pose().view).toEqual({ zoom: 1, x: 0, y: 0 });
    });

    it("should go back at once with reduced motion", async () => {
      stubReducedMotion(true);
      const { image, rerender } = await renderBody();
      fireEvent.wheel(image, { ctrlKey: true, deltaY: -100 });

      rerender(<Body3D label={label} w={BODY_WIDTH} zoomResetCount={1} />);

      expect(pose().view).toEqual({ zoom: 1, x: 0, y: 0 });
    });

    it("should report the whole body as it starts", async () => {
      const onZoomChange = vi.fn();
      const { image, rerender } = await renderBody({ onZoomChange });
      vi.useFakeTimers();
      fireEvent.wheel(image, { ctrlKey: true, deltaY: -100 });
      vi.advanceTimersByTime(200);
      onZoomChange.mockClear();

      rerender(
        <Body3D label={label} w={BODY_WIDTH} zoomResetCount={1} onZoomChange={onZoomChange} />,
      );

      expect(onZoomChange).toHaveBeenCalledTimes(1);
      expect(onZoomChange).toHaveBeenCalledWith(1);
    });

    it("should do nothing for the count a body starts with", async () => {
      const onZoomChange = vi.fn();
      await renderBody({ zoomResetCount: 3, onZoomChange });

      expect(pose().view).toEqual({ zoom: 1, x: 0, y: 0 });
      expect(onZoomChange).not.toHaveBeenCalled();
    });

    it.each([
      ["zoomInCount", { zoomInCount: 2 }],
      ["zoomOutCount", { zoomOutCount: 2 }],
    ])("should not step for the %s a body starts with", async (_name, counts) => {
      const onZoomChange = vi.fn();
      await renderBody({ ...counts, onZoomChange });

      expect(pose().view).toEqual({ zoom: 1, x: 0, y: 0 });
      expect(onZoomChange).not.toHaveBeenCalled();
    });

    it("should do nothing when the count is not raised", async () => {
      const { image, rerender } = await renderBody({ zoomResetCount: 1 });
      fireEvent.wheel(image, { ctrlKey: true, deltaY: -100 });

      rerender(<Body3D label={label} w={BODY_WIDTH} zoomResetCount={1} side="front" />);

      expect(pose().view.zoom).toBe(2);
    });

    it("should be taken over by a pinch that lands while it eases", async () => {
      const { image, rerender } = await renderBody();
      fireEvent.wheel(image, { ctrlKey: true, deltaY: -100 });
      rerender(<Body3D label={label} w={BODY_WIDTH} zoomResetCount={1} />);
      act(() => {
        pose().step(110);
      });

      fireEvent.wheel(image, { ctrlKey: true, deltaY: -1 });

      expect(pose().step(220)).toBe(false);
      expect(pose().view.zoom).toBeCloseTo(1.5 * Math.exp(0.01));
    });
  });

  describe("the steps in and out", () => {
    it("should step half a zoom closer for each raise of zoomInCount, easing like a reset", async () => {
      const { rerender } = await renderBody();

      rerender(<Body3D label={label} w={BODY_WIDTH} zoomInCount={1} />);
      act(() => {
        pose().step(220);
      });

      expect(pose().view.zoom).toBeCloseTo(1.5);
    });

    it("should step from where a step is heading when asked again before it lands", async () => {
      const { rerender } = await renderBody();
      rerender(<Body3D label={label} w={BODY_WIDTH} zoomInCount={1} />);
      act(() => {
        pose().step(60);
      });

      rerender(<Body3D label={label} w={BODY_WIDTH} zoomInCount={2} />);
      act(() => {
        pose().step(220);
      });

      expect(pose().view.zoom).toBeCloseTo(2);
    });

    it("should step back from where a step back is heading when asked again before it lands", async () => {
      const { image, rerender } = await renderBody();
      fireEvent.wheel(image, { ctrlKey: true, deltaY: -100 });
      rerender(<Body3D label={label} w={BODY_WIDTH} zoomOutCount={1} />);
      act(() => {
        pose().step(60);
      });

      rerender(<Body3D label={label} w={BODY_WIDTH} zoomOutCount={2} />);
      act(() => {
        pose().step(220);
      });

      expect(pose().view).toEqual({ zoom: 1, x: 0, y: 0 });
    });

    it("should stop at twice as close", async () => {
      const { rerender } = await renderBody();

      rerender(<Body3D label={label} w={BODY_WIDTH} zoomInCount={3} />);
      act(() => {
        pose().step(220);
      });
      rerender(<Body3D label={label} w={BODY_WIDTH} zoomInCount={4} />);
      act(() => {
        pose().step(220);
      });

      expect(pose().view.zoom).toBe(2);
    });

    it("should step half a zoom back for each raise of zoomOutCount, to the whole body at least", async () => {
      const { image, rerender } = await renderBody();
      fireEvent.wheel(image, { ctrlKey: true, deltaY: -100 });

      rerender(<Body3D label={label} w={BODY_WIDTH} zoomOutCount={1} />);
      act(() => {
        pose().step(220);
      });
      expect(pose().view.zoom).toBeCloseTo(1.5);
      rerender(<Body3D label={label} w={BODY_WIDTH} zoomOutCount={2} />);
      act(() => {
        pose().step(220);
      });
      expect(pose().view).toEqual({ zoom: 1, x: 0, y: 0 });
      rerender(<Body3D label={label} w={BODY_WIDTH} zoomOutCount={3} />);
      act(() => {
        pose().step(220);
      });

      expect(pose().view).toEqual({ zoom: 1, x: 0, y: 0 });
    });

    it("should step at once with reduced motion", async () => {
      stubReducedMotion(true);
      const { rerender } = await renderBody();

      rerender(<Body3D label={label} w={BODY_WIDTH} zoomInCount={1} />);

      expect(pose().view.zoom).toBeCloseTo(1.5);
    });

    it("should report the zoom it is heading to as the step starts, and nothing for a step that changes nothing", async () => {
      const onZoomChange = vi.fn();
      const { rerender } = await renderBody({ onZoomChange });

      rerender(
        <Body3D label={label} w={BODY_WIDTH} zoomOutCount={1} onZoomChange={onZoomChange} />,
      );
      expect(onZoomChange).not.toHaveBeenCalled();
      rerender(
        <Body3D
          label={label}
          w={BODY_WIDTH}
          zoomInCount={1}
          zoomOutCount={1}
          onZoomChange={onZoomChange}
        />,
      );

      expect(onZoomChange).toHaveBeenCalledTimes(1);
      expect(onZoomChange).toHaveBeenCalledWith(1.5);
    });
  });
});
