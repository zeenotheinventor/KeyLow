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

async function renderEmptyState(props: Partial<EmptyStateProps>) {
  await render(
    <ThemeProvider fixedPreference="dark">
      <EmptyState
        action={{ label: "Add weigh-in", variant: "primary", onPress: () => undefined }}
        body="Add one now, or bring in readings from your smart scale."
        icon="Weight"
        title="No weigh-ins yet"
        {...props}
      />
    </ThemeProvider>,
  );
}

describe("the secondary action of an EmptyState", () => {
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

  it("should draw a secondary button under the primary one", async () => {
    await renderEmptyState({
      secondaryAction: { label: "Connect Health Connect", onPress: () => undefined },
    });

    const buttons = screen.getAllByRole("button");

    expect(buttons).toHaveLength(2);
    expect(screen.getByRole("button", { name: "Add weigh-in" })).toHaveStyle({
      backgroundColor: resolvedColor("dark", "accent"),
    });
    expect(screen.getByRole("button", { name: "Connect Health Connect" })).toHaveStyle({
      backgroundColor: resolvedColor("dark", "surface-raised"),
    });
    expect(buttons[0]).toBe(screen.getByRole("button", { name: "Add weigh-in" }));
  });

  it("should press each button on its own", async () => {
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    const onPrimary = jest.fn();
    const onSecondary = jest.fn();
    await renderEmptyState({
      action: { label: "Add weigh-in", variant: "primary", onPress: onPrimary },
      secondaryAction: { label: "Connect Health Connect", onPress: onSecondary },
    });

    await user.press(screen.getByRole("button", { name: "Connect Health Connect" }));

    expect(onSecondary).toHaveBeenCalledTimes(1);
    expect(onPrimary).not.toHaveBeenCalled();
  });

  it("should take an icon and stop responding when disabled", async () => {
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    const onSecondary = jest.fn();
    await renderEmptyState({
      secondaryAction: {
        label: "Connect Health Connect",
        icon: "Heart",
        disabled: true,
        onPress: onSecondary,
      },
    });

    const button = screen.getByRole("button", { name: "Connect Health Connect" });
    await user.press(button);

    expect(button).toBeDisabled();
    expect(onSecondary).not.toHaveBeenCalled();
  });

  it("should draw only the one button when there is no secondary action", async () => {
    await renderEmptyState({});

    expect(screen.getAllByRole("button")).toHaveLength(1);
  });
});
