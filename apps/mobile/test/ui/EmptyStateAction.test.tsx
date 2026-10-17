import { render, screen, userEvent } from "@testing-library/react-native";
import { AccessibilityInfo } from "react-native";
import { setUpTests } from "react-native-reanimated";

import { EmptyState } from "../../components/ui";
import { ThemeProvider } from "../../lib/theme";
import { compileKitStyles } from "../support/kitStyles";
import { registerAppStyles } from "../support/nativeWindStyles";
import { resolvedColor } from "../support/themeColor";

import type { EmptyStateProps } from "../../components/ui";

jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: { getItem: () => Promise.resolve(null), setItem: () => Promise.resolve() },
}));

setUpTests();

async function renderEmptyState(action: NonNullable<EmptyStateProps["action"]>) {
  await render(
    <ThemeProvider fixedPreference="dark">
      <EmptyState
        action={action}
        body="Add the foods and the method once, then log it by the serving."
        icon="ChefHat"
        title="No recipes yet"
      />
    </ThemeProvider>,
  );
}

describe("the action of an EmptyState", () => {
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

  it("should be a secondary button unless the screen asks for another", async () => {
    await renderEmptyState({ label: "New recipe", onPress: () => undefined });

    expect(screen.getByRole("button", { name: "New recipe" })).toHaveStyle({
      backgroundColor: resolvedColor("dark", "surface-raised"),
    });
  });

  it("should be a primary button when the screen asks for one", async () => {
    await renderEmptyState({ label: "New recipe", variant: "primary", onPress: () => undefined });

    expect(screen.getByRole("button", { name: "New recipe" })).toHaveStyle({
      backgroundColor: resolvedColor("dark", "accent"),
    });
  });

  it("should be disabled and not respond when the screen disables it", async () => {
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    const onPress = jest.fn();
    await renderEmptyState({ label: "New recipe", disabled: true, onPress });

    const button = screen.getByRole("button", { name: "New recipe" });
    await user.press(button);

    expect(button).toBeDisabled();
    expect(onPress).not.toHaveBeenCalled();
  });
});
