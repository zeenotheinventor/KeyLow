import { screen } from "@testing-library/react-native";

/** What the responder system hands a handler: the touches so far, as it keeps them. */
export type SwipeTouch = {
  nativeEvent: { touches: object[] };
  touchHistory: {
    touchBank: object[];
    numberActiveTouches: number;
    indexOfSingleActiveTouch: number;
    mostRecentTimeStamp: number;
  };
};

const startPageX = 300;
const startPageY = 100;

/**
 * A single finger that went down at (300, 100) and is now at (x, y) at `timestamp` milliseconds. The
 * finger is taken to have moved there in one step, so the velocity is the distance over the time.
 */
export function touchAt(x: number, y: number, timestamp: number): SwipeTouch {
  return {
    nativeEvent: { touches: [{}] },
    touchHistory: {
      touchBank: [
        {
          touchActive: true,
          startPageX,
          startPageY,
          startTimeStamp: 0,
          currentPageX: x,
          currentPageY: y,
          currentTimeStamp: timestamp,
          previousPageX: startPageX,
          previousPageY: startPageY,
          previousTimeStamp: 0,
        },
      ],
      numberActiveTouches: 1,
      indexOfSingleActiveTouch: 0,
      mostRecentTimeStamp: timestamp,
    },
  };
}

/** A finger that is still where it went down. */
export const touchDown = touchAt(startPageX, startPageY, 1);

const handlerNames = [
  "onStartShouldSetResponderCapture",
  "onMoveShouldSetResponderCapture",
  "onMoveShouldSetResponder",
  "onResponderGrant",
  "onResponderMove",
  "onResponderRelease",
] as const;

export type SwipeResponder = Record<(typeof handlerNames)[number], (event: SwipeTouch) => unknown>;

function isSwipeResponder(props: unknown): props is SwipeResponder {
  return (
    typeof props === "object" &&
    props !== null &&
    handlerNames.every(
      (name) => typeof Object.getOwnPropertyDescriptor(props, name)?.value === "function",
    )
  );
}

/** The view that slides. It has no role to query by, so it is found by the responder handlers it carries. */
export function swipeableRow() {
  const row = screen.root?.queryAll((node) => isSwipeResponder(node.props))[0];
  if (!row) {
    throw new Error("The swipeable row is not on the screen");
  }
  return row;
}

/**
 * The responder handlers of the view that slides. The responder refuses RNTL's fireEvent because it
 * claims no touch at the start, so the handlers are called as the responder system calls them.
 */
export function swipeResponder(): SwipeResponder {
  const { props } = swipeableRow();
  if (!isSwipeResponder(props)) {
    throw new Error("The swipeable row has no responder handlers");
  }
  return props;
}

/**
 * Whether the view that slides would take the touch over from what holds it, for a finger that has
 * moved from where it went down by (dx, dy). The capture phase comes first, as the responder system
 * does it, because that is where the gesture is worked out.
 */
export function claimsMoveBy(dx: number, dy: number): boolean {
  const responder = swipeResponder();
  const event = touchAt(startPageX + dx, startPageY + dy, 2);
  responder.onMoveShouldSetResponderCapture(event);
  return responder.onMoveShouldSetResponder(event) === true;
}
