import { useCallback, useEffect, useRef } from "react";
import { TextInput } from "react-native";

import type { RefObject } from "react";
import type { HostInstance, ScrollView } from "react-native";

/** The one thing the hook reads from a scroll event, which every scroll view's own event has. */
export type ScrollOffsetEvent = { nativeEvent: { contentOffset: { y: number } } };

type Measurable = Pick<HostInstance, "measureInWindow">;

/** The two things the hook asks of the scroll view: where it is drawn, and a scroll to a place. */
type ScrollViewHandle = {
  getNativeScrollRef: () => Measurable | null;
  scrollTo: ScrollView["scrollTo"];
};

// How far the focused field clears the bottom edge of the scroll view once it is scrolled into view.
const ROOM_BELOW_FIELD = 16;

// React Native types the focused field as always there, but it is null while no field has focus.
function currentlyFocusedInput(): Measurable | null | undefined {
  return TextInput.State.currentlyFocusedInput();
}

/**
 * Scrolls the focused field into view when the keyboard rises. Android scrolls a field into a scroll view
 * that shrinks, but it can stop with the field's bottom edge still hidden, so the screen does it itself. It
 * reads where the field and the scroll view are in the window, so it is right wherever the scroll view is
 * in it. `keyboardLift` is how far the screen lifts for the keyboard, 0 while there is none or when the
 * platform moves the screen itself. Put the returned handler on the scroll view's `onScroll`, which is how
 * the hook knows how far the scroll view is scrolled.
 */
export function useScrollFocusedInputIntoView(
  scrollViewRef: RefObject<ScrollViewHandle | null>,
  keyboardLift: number,
) {
  const offsetY = useRef(0);

  const trackOffset = useCallback((event: ScrollOffsetEvent) => {
    offsetY.current = event.nativeEvent.contentOffset.y;
  }, []);

  useEffect(() => {
    const focusedInput = currentlyFocusedInput();
    const scrollViewHost = scrollViewRef.current?.getNativeScrollRef();
    if (keyboardLift === 0 || !focusedInput || !scrollViewHost) {
      return;
    }

    // The scroll view shrinks as the screen lifts, and a measure taken before that layout would read its old
    // height, so the measure waits a frame.
    const frame = requestAnimationFrame(() => {
      focusedInput.measureInWindow((_inputLeft, inputTop, _inputWidth, inputHeight) => {
        scrollViewHost.measureInWindow(
          (_scrollViewLeft, scrollViewTop, _scrollViewWidth, scrollViewHeight) => {
            const hiddenBelow =
              inputTop + inputHeight + ROOM_BELOW_FIELD - (scrollViewTop + scrollViewHeight);
            if (hiddenBelow > 0) {
              scrollViewRef.current?.scrollTo({
                y: offsetY.current + hiddenBelow,
                animated: false,
              });
            }
          },
        );
      });
    });

    return () => {
      cancelAnimationFrame(frame);
    };
  }, [keyboardLift, scrollViewRef]);

  return trackOffset;
}
