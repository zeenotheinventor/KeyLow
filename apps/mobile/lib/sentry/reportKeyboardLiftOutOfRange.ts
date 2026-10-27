import { captureMessage } from "@sentry/react-native";
import { AppState } from "react-native";

import { KEYBOARD_LIFT_OUT_OF_RANGE_MESSAGE } from "./keyboardLiftMessage";
import { currentRouteName } from "./trail";

export type KeyboardLiftReading = {
  rawLift: number;
  screenY: number;
  keyboardHeight: number;
  windowHeight: number;
};

// One report a session is enough to know it happens, and a keyboard that announces badly would otherwise
// send one for every announcement.
let hasReported = false;

/**
 * Reports, once a session, that the keyboard announced an edge the lift could not be right for. The report
 * says which screen, what the keyboard announced and the app state, as tags (the SDK's scrubbing keeps the
 * tags and drops anything else a message could carry). It holds numbers of points and names of our own,
 * never what a person typed or any health data.
 */
export function reportKeyboardLiftOutOfRange(reading: KeyboardLiftReading): void {
  if (hasReported) {
    return;
  }
  hasReported = true;

  captureMessage(KEYBOARD_LIFT_OUT_OF_RANGE_MESSAGE, {
    level: "warning",
    fingerprint: [KEYBOARD_LIFT_OUT_OF_RANGE_MESSAGE],
    tags: {
      route: currentRouteName(),
      appState: AppState.currentState,
      rawLift: Math.round(reading.rawLift),
      screenY: Math.round(reading.screenY),
      keyboardHeight: Math.round(reading.keyboardHeight),
      windowHeight: Math.round(reading.windowHeight),
    },
  });
}

/** Lets the next report go out, which a test needs between one and the next. */
export function resetKeyboardLiftReportForTests(): void {
  hasReported = false;
}
