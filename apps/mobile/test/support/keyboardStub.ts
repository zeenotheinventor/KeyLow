import { act } from "@testing-library/react-native";
import { Keyboard, Platform, View } from "react-native";

type KeyboardListener = Parameters<typeof Keyboard.addListener>[1];

// The keyboard's announcement, with the edges a lifted view reads.
const keyboardEvent = (screenY: number, height: number) => ({
  duration: 0,
  easing: "keyboard" as const,
  endCoordinates: { screenX: 0, screenY, width: 390, height },
});

// What `Keyboard.addListener` hands back. A listener only ever calls `remove` on it, so that is all it
// has, and the full emitter subscription is not built.
export function subscription(remove: () => void) {
  return { remove } as ReturnType<typeof Keyboard.addListener>;
}

// Stands in for the keyboard and for the window a view is measured in. The view's bottom edge is
// `dockBottom` points down the window, and the keyboard's top edge is `keyboardTop`.
export function stubKeyboard(dockBottom: number, { deferMeasure = false } = {}) {
  const listeners = new Map<string, KeyboardListener>();
  const unansweredMeasures: (() => void)[] = [];
  jest.spyOn(Keyboard, "addListener").mockImplementation((eventName, listener) => {
    listeners.set(eventName, listener);
    return subscription(() => listeners.delete(eventName));
  });
  // Every view shares one mocked measure, on the class, so the measured view's is the one set here. A real
  // measure answers later, so `deferMeasure` holds the answers until the test lets them through.
  jest
    .spyOn(View.prototype, "measureInWindow")
    .mockImplementation((callback: (...edges: number[]) => void) => {
      const answer = () => {
        callback(0, dockBottom - 64, 390, 64);
      };
      if (deferMeasure) {
        unansweredMeasures.push(answer);
      } else {
        answer();
      }
    });
  const showName = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
  const hideName = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";
  const announce = (eventName: string, keyboardTop: number, height = 300) =>
    act(() => {
      listeners.get(eventName)?.(keyboardEvent(keyboardTop, height));
    });
  return {
    // The keyboard is 300 points tall unless a test says otherwise.
    show: (keyboardTop: number, height?: number) => announce(showName, keyboardTop, height),
    hide: () => announce(hideName, 0),
    // iOS also announces the keyboard changing height while it is shown.
    changeFrame: (keyboardTop: number) => announce("keyboardWillChangeFrame", keyboardTop),
    answerMeasures: () =>
      act(() => {
        // Answered newest first, as the slow ones can come back after the fast.
        unansweredMeasures
          .splice(0)
          .reverse()
          .forEach((answer) => {
            answer();
          });
      }),
  };
}
