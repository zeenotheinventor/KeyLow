import { act } from "@testing-library/react-native";
import { DeviceEventEmitter } from "react-native";
import { State } from "react-native-gesture-handler";
import { getByGestureTestId } from "react-native-gesture-handler/jest-utils";

/**
 * A finger that goes down on the gesture with the given test id, and moves far enough sideways or up and down for
 * the gesture to fail before it takes hold, as a vertical swipe does. The gesture handler's own test utility
 * cannot send a failure that has no active state before it, because it fills the missing state in.
 */
export async function failBeforeTakingHold(testId: string): Promise<void> {
  const { handlerTag } = getByGestureTestId(testId);
  const send = (state: State, oldState: State) =>
    act(() => {
      DeviceEventEmitter.emit("onGestureHandlerStateChange", {
        handlerTag,
        state,
        oldState,
        translationX: 0,
        translationY: 12,
        velocityX: 0,
        velocityY: 0,
        x: 0,
        y: 0,
        absoluteX: 0,
        absoluteY: 0,
        numberOfPointers: 1,
      });
    });
  await send(State.BEGAN, State.UNDETERMINED);
  await send(State.FAILED, State.BEGAN);
}
