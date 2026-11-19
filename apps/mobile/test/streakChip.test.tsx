import { render, screen, userEvent } from "@testing-library/react-native";

import { StreakChip } from "../components/StreakChip";
import { ThemeProvider } from "../lib/theme";
import { compileKitStyles } from "./support/kitStyles";
import { registerAppStyles } from "./support/nativeWindStyles";

jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: { getItem: () => Promise.resolve(null), setItem: () => Promise.resolve() },
}));

describe("StreakChip", () => {
  let styles: string;

  beforeAll(async () => {
    styles = await compileKitStyles("", ["components/StreakChip"]);
  });

  beforeEach(() => {
    registerAppStyles(styles);
  });

  async function renderChip(props: Parameters<typeof StreakChip>[0]) {
    await render(
      <ThemeProvider fixedPreference="dark">
        <StreakChip {...props} />
      </ThemeProvider>,
    );
  }

  it("should show the number while the streak is kept", async () => {
    await renderChip({ state: "active", current: 12, onPress: jest.fn() });

    const chip = screen.getByRole("button", { name: "12 day streak. Open streak calendar" });
    expect(chip).toBeOnTheScreen();
    expect(screen.getByText("12")).toBeOnTheScreen();
  });

  it("should ask to complete today when the streak is at risk", async () => {
    await renderChip({ state: "at_risk", current: 12, onPress: jest.fn() });

    expect(
      screen.getByRole("button", {
        name: "12 day streak, not complete today. Open streak calendar",
      }),
    ).toBeOnTheScreen();
    expect(screen.getByText("12 · Complete today")).toBeOnTheScreen();
  });

  it("should say a freeze was used", async () => {
    await renderChip({ state: "freeze_used", current: 12, onPress: jest.fn() });

    expect(
      screen.getByRole("button", { name: "12 day streak, freeze used. Open streak calendar" }),
    ).toBeOnTheScreen();
    expect(screen.getByText("12 · Freeze used")).toBeOnTheScreen();
  });

  it("should invite a first streak when there is none", async () => {
    await renderChip({ state: "none", current: 0, onPress: jest.fn() });

    expect(screen.getByText("Start a streak")).toBeOnTheScreen();
    expect(
      screen.getByRole("button", { name: "Start a streak. Open streak calendar" }),
    ).toBeOnTheScreen();
  });

  it("should open the calendar when pressed", async () => {
    const onPress = jest.fn();
    const user = userEvent.setup();
    await renderChip({ state: "active", current: 12, onPress });

    await user.press(screen.getByRole("button", { name: /Open streak calendar/ }));

    expect(onPress).toHaveBeenCalledTimes(1);
  });
});
