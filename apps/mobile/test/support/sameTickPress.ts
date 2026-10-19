import { act } from "@testing-library/react-native";

import type { TestInstance } from "test-renderer";

// Presses that arrive before React has drawn anything between them, which awaited presses never do. A press is
// the host element's click, so the handler runs again inside the same act, as a double tap's would.
type ClickHandler = (event: { stopPropagation: () => void; nativeEvent: object }) => void;

const isClickHandler = (value: unknown): value is ClickHandler => typeof value === "function";

/** Presses each button once, in the order given, all inside one act: the same tick. */
export async function pressInTheSameMoment(...buttons: readonly TestInstance[]) {
  const handlers = buttons.map(({ props }) => {
    const { onClick } = props;
    if (!isClickHandler(onClick)) {
      throw new Error("The button has no click handler");
    }
    return onClick;
  });
  await act(() => {
    for (const onClick of handlers) {
      onClick({ stopPropagation: () => undefined, nativeEvent: {} });
    }
  });
}

/** Presses one button twice inside one act. */
export async function pressTwiceInTheSameMoment(button: TestInstance) {
  await pressInTheSameMoment(button, button);
}
