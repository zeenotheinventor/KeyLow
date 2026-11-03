import { render, screen, userEvent } from "@testing-library/react-native";
import { impactAsync } from "expo-haptics";
import { setUpTests } from "react-native-reanimated";

import { ChipGroup } from "../../components/ui";
import { ThemeProvider } from "../../lib/theme";

jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: { getItem: () => Promise.resolve(null), setItem: () => Promise.resolve() },
}));

setUpTests();

const mockImpact = jest.mocked(impactAsync);

type Reply = "ask-again" | "other";

const replyOptions = [
  { value: "ask-again", label: "Ask again" },
  { value: "other", label: "Another reply" },
] as const;

function renderReplies(onChipPress: (value: Reply) => void) {
  return render(
    <ThemeProvider fixedPreference="dark">
      <ChipGroup
        label="Quick replies"
        layout="wrap"
        options={replyOptions}
        selection="action"
        onChipPress={onChipPress}
      />
    </ThemeProvider>,
  );
}

describe("ChipGroup as quick replies, with selection action", () => {
  beforeEach(() => {
    mockImpact.mockClear();
  });

  it("should draw buttons in a plain group, not radios in a radio group", async () => {
    await renderReplies(() => undefined);

    expect(screen.getByLabelText("Quick replies")).toHaveProp("role", "group");
    expect(screen.queryByRole("radiogroup")).not.toBeOnTheScreen();
    expect(screen.queryByRole("radio")).not.toBeOnTheScreen();
    expect(screen.getAllByRole("button")).toHaveLength(2);
  });

  it("should draw no chip as selected or checked, before or after a press", async () => {
    const user = userEvent.setup();
    await renderReplies(() => undefined);

    await user.press(screen.getByRole("button", { name: "Ask again" }));

    for (const button of screen.getAllByRole("button")) {
      expect(button).not.toBeSelected();
      expect(button.props["aria-checked"]).toBeUndefined();
      expect(button.props["aria-selected"]).toBeUndefined();
    }
  });

  it("should hand the pressed chip's value to onChipPress every time it is pressed", async () => {
    const user = userEvent.setup();
    const onChipPress = jest.fn();
    await renderReplies(onChipPress);

    await user.press(screen.getByRole("button", { name: "Ask again" }));
    await user.press(screen.getByRole("button", { name: "Ask again" }));

    expect(onChipPress).toHaveBeenCalledTimes(2);
    expect(onChipPress).toHaveBeenCalledWith("ask-again");
  });
});
