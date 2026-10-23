import { screen } from "@testing-library/react-native";

import { anyFrontFigureName } from "./figureNames";
import { touchAt, touchDown } from "./swipeResponder";

import type { SwipeTouch } from "./swipeResponder";

type Handler = (event: SwipeTouch) => unknown;

type Element = ReturnType<typeof screen.getByRole>;

// A responder handler is a function of the touch event, which is all a host node's loose props can tell.
function isHandler(value: unknown): value is Handler {
  return typeof value === "function";
}

function handlerOf(element: Element, name: string): Handler | undefined {
  const handler: unknown = Object.getOwnPropertyDescriptor(element.props, name)?.value;
  return isHandler(handler) ? handler : undefined;
}

type FiguresResponder = Record<
  "grant" | "move" | "release" | "terminate" | "termination" | "captureMove",
  Handler
>;

/**
 * The responder handlers of the view around the figures, found from a figure by walking up to the first
 * view that takes touches. The figures themselves are plain images, so the tap is the view's own. They
 * are looked up on every call, as the responder system reads the view's current props for each event.
 */
function figuresResponder(): FiguresResponder {
  let element: Element | null = screen.getByRole("img", { name: anyFrontFigureName });
  while (element !== null && handlerOf(element, "onResponderRelease") === undefined) {
    element = element.parent;
  }
  const lookup = (name: string) => (element === null ? undefined : handlerOf(element, name));
  const grant = lookup("onResponderGrant");
  const move = lookup("onResponderMove");
  const release = lookup("onResponderRelease");
  const terminate = lookup("onResponderTerminate");
  const termination = lookup("onResponderTerminationRequest");
  const captureMove = lookup("onMoveShouldSetResponderCapture");
  if (
    grant === undefined ||
    move === undefined ||
    release === undefined ||
    terminate === undefined ||
    termination === undefined ||
    captureMove === undefined
  ) {
    throw new Error("Nothing around the figures takes touches");
  }
  return { grant, move, release, terminate, termination, captureMove };
}

/** A finger that goes down on the figures and lifts where it went down. */
export function tapFigures(): void {
  const responder = figuresResponder();
  responder.grant(touchDown);
  responder.release(touchDown);
}

/** A finger that goes down on the figures, moves by (dx, dy) points and lifts there. */
export function dragFigures(dx: number, dy: number): void {
  beginDragFigures(dx, dy);
  endDragFigures(dx, dy);
}

/** A finger that goes down on the figures and moves by (dx, dy) points, and has not lifted yet. */
export function beginDragFigures(dx: number, dy: number): void {
  const responder = figuresResponder();
  responder.grant(touchDown);
  responder.move(touchAt(300 + dx, 100 + dy, 120));
}

/** The finger of `beginDragFigures` lifting where it moved to. */
export function endDragFigures(dx: number, dy: number): void {
  figuresResponder().release(touchAt(300 + dx, 100 + dy, 120));
}

/** A finger that goes down on the figures and is taken away, as when the screen scrolls under it. */
export function interruptFigures(): void {
  const responder = figuresResponder();
  responder.grant(touchDown);
  responder.terminate(touchDown);
}

/** Whether the figures give up a touch they hold when the screen asks for it, as a scroll view does to scroll. */
export function figuresYieldTouch(): boolean {
  return figuresResponder().termination(touchDown) === true;
}

/** Whether the figures take a moving touch before the views inside them or around them can claim it. */
export function figuresCaptureMove(dx: number, dy: number): boolean {
  return figuresResponder().captureMove(touchAt(300 + dx, 100 + dy, 120)) === true;
}
