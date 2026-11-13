import { PALATE_WORDS, YOUR_FOOD } from "@keylow/core/copy";
import { render, screen, userEvent } from "@testing-library/react-native";

import PalateRoute from "../app/(tabs)/more/assistant/palate";
import { ThemeProvider } from "../lib/theme";
import { resetRouterMock, routerMock } from "./support/expoRouterMock";

jest.mock(
  "expo-router",
  () => jest.requireActual<{ mockExpoRouter: unknown }>("./support/expoRouterMock").mockExpoRouter,
);
jest.mock(
  "react-native-safe-area-context",
  () =>
    jest.requireActual<{ default: unknown }>("react-native-safe-area-context/jest/mock").default,
);
jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: { getItem: () => Promise.resolve(null), setItem: () => Promise.resolve() },
}));

// The stand-in until the palate screen is built, so the Your food row does not lead nowhere.
describe("the What you usually eat screen, for now", () => {
  beforeEach(() => {
    resetRouterMock();
  });

  async function renderPalate() {
    const user = userEvent.setup();
    await render(
      <ThemeProvider fixedPreference="dark">
        <PalateRoute />
      </ThemeProvider>,
    );
    return user;
  }

  it("should be headed What you usually eat, with Back to Assistant", async () => {
    const user = await renderPalate();

    expect(screen.getByRole("heading", { name: PALATE_WORDS.title })).toBeOnTheScreen();
    await user.press(screen.getByRole("button", { name: PALATE_WORDS.back }));
    expect(routerMock.back).toHaveBeenCalledTimes(1);
  });

  it("should say Coming soon", async () => {
    await renderPalate();

    expect(screen.getByText(YOUR_FOOD.comingSoon)).toBeOnTheScreen();
  });
});
