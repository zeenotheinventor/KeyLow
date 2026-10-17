import { render, screen, userEvent } from "@testing-library/react-native";
import { createRef } from "react";
import { AccessibilityInfo, View } from "react-native";
import { setUpTests } from "react-native-reanimated";

import { GroupedList, ListRow } from "../../components/ui";
import { ThemeProvider } from "../../lib/theme";
import { compileKitStyles } from "../support/kitStyles";
import { registerAppStyles } from "../support/nativeWindStyles";

// The footer row closes a card of rows with an action, as the recipe editor's Add ingredient does.

jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: { getItem: () => Promise.resolve(null), setItem: () => Promise.resolve() },
}));

setUpTests();

// Icons are decoration and have no role to query by, so their drawings are counted.
const drawings = () => screen.root?.queryAll((node) => node.type === "RNSVGSvgView") ?? [];

async function renderFooter(onPress?: () => void, disabled = false) {
  await render(
    <ThemeProvider fixedPreference="dark">
      <GroupedList hidesTitle title="Ingredients">
        <ListRow
          disabled={disabled}
          icon="Plus"
          title="Add ingredient"
          variant="footer"
          onPress={onPress}
        />
      </GroupedList>
    </ThemeProvider>,
  );
}

describe("the footer ListRow", () => {
  let kitStyles: string;

  beforeAll(async () => {
    kitStyles = await compileKitStyles();
  });

  beforeEach(() => {
    jest.useFakeTimers();
    registerAppStyles(kitStyles);
    jest.spyOn(AccessibilityInfo, "isReduceMotionEnabled").mockResolvedValue(false);
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it("should be a button named by its title, and press", async () => {
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    const onPress = jest.fn();
    await renderFooter(onPress);

    await user.press(screen.getByRole("button", { name: "Add ingredient" }));

    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it("should draw its icon and no chevron, because it acts and goes nowhere", async () => {
    await renderFooter(() => undefined);

    expect(drawings()).toHaveLength(1);
  });

  it("should be 52 points tall with 16 either side, where the usual row is 56 and 12", async () => {
    await renderFooter(() => undefined);

    const button = screen.getByRole("button", { name: "Add ingredient" });
    expect(button).toHaveStyle({ minHeight: 52, paddingLeft: 16 });
  });

  it("should hand its button to a ref, so a screen reader's focus can be sent to it", async () => {
    const ref = createRef<View>();
    await render(
      <ThemeProvider fixedPreference="dark">
        <ListRow
          ref={ref}
          icon="Plus"
          title="Add ingredient"
          variant="footer"
          onPress={jest.fn()}
        />
      </ThemeProvider>,
    );

    expect(ref.current).not.toBeNull();
  });

  it("should dim and stop responding when disabled", async () => {
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    const onPress = jest.fn();
    await renderFooter(onPress, true);

    await user.press(screen.getByRole("button", { name: "Add ingredient" }));

    expect(screen.getByRole("button", { name: "Add ingredient" })).toBeDisabled();
    expect(onPress).not.toHaveBeenCalled();
  });
});
