import { act, screen } from "@testing-library/react-native";
import { ScrollView, TextInput } from "react-native";

type Edges = (left: number, top: number, width: number, height: number) => void;

/** A view that answers where it is in the window, as a native one does. */
export const viewAt = (top: number, height: number) => ({
  measureInWindow: (answer: Edges) => {
    answer(0, top, 390, height);
  },
});

/** Makes a field that is `height` points tall and `top` points down the window the one with focus. */
export function focusFieldAt(top: number, height: number) {
  jest
    .spyOn(TextInput.State, "currentlyFocusedInput")
    // The state types its field as a whole host view. A screen only measures it, so a stand-in that
    // can be measured is all it is given.
    .mockReturnValue(
      viewAt(top, height) as unknown as ReturnType<typeof TextInput.State.currentlyFocusedInput>,
    );
}

/** Holds the frames a screen asks for until a test lets them run, as the screen would. */
export function holdFrames() {
  const waiting = new Map<number, () => void>();
  let lastHandle = 0;
  jest.spyOn(globalThis, "requestAnimationFrame").mockImplementation((callback) => {
    lastHandle += 1;
    waiting.set(lastHandle, () => {
      callback(0);
    });
    return lastHandle;
  });
  jest.spyOn(globalThis, "cancelAnimationFrame").mockImplementation((handle) => {
    if (typeof handle === "number") {
      waiting.delete(handle);
    }
  });
  return {
    run: () =>
      act(() => {
        waiting.forEach((frame) => {
          frame();
        });
        waiting.clear();
      }),
  };
}

/**
 * Makes every scroll view `height` points tall and `top` points down the window, and returns the scroll
 * to a place that they are asked for. Jest's scroll view has no native view to measure, so it is given one.
 */
export function stubScrollViewAt(top: number, height: number) {
  jest
    .spyOn(ScrollView.prototype, "getNativeScrollRef")
    // Typed as a whole host view, though a screen only measures it, so a stand-in that can be measured is given.
    .mockImplementation(
      () => viewAt(top, height) as unknown as ReturnType<ScrollView["getNativeScrollRef"]>,
    );
  return jest.spyOn(ScrollView.prototype, "scrollTo");
}

/** The screen's one scroll view. It has no role to query by, so it is found by its host type. */
export function scrollViewOnScreen() {
  const [scrollView] = screen.root?.queryAll((node) => node.type === "RCTScrollView") ?? [];
  if (scrollView === undefined) {
    throw new Error("There is no scroll view on the screen");
  }
  return scrollView;
}
