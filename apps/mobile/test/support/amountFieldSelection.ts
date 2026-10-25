import { TextInput } from "react-native";

/**
 * Listens, for each test of the file or block it is called in, for a text field being focused and having its
 * text selected. The jest preset's `TextInput` has `focus` but no `setSelection`, so a screen that selects
 * the amount on a chip press would throw without the one given here on the prototype, which is taken away
 * again after each test.
 */
export function trackFieldSelection() {
  const focus = jest.fn();
  const setSelection = jest.fn();

  beforeEach(() => {
    focus.mockClear();
    setSelection.mockClear();
    jest.spyOn(TextInput.prototype, "focus").mockImplementation(focus);
    TextInput.prototype.setSelection = setSelection;
  });

  afterEach(() => {
    jest.spyOn(TextInput.prototype, "focus").mockRestore();
    Reflect.deleteProperty(TextInput.prototype, "setSelection");
  });

  return {
    focus,
    setSelection,
    /** True when the field was focused first and its text selected afterwards, the order a keystroke needs. */
    focusedThenSelected: () => {
      const [focusedAt] = focus.mock.invocationCallOrder;
      const [selectedAt] = setSelection.mock.invocationCallOrder;
      return focusedAt !== undefined && selectedAt !== undefined && focusedAt < selectedAt;
    },
  };
}
