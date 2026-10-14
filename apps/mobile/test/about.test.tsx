import { DATA_SOURCE_ATTRIBUTION } from "@keylow/core/foods";
import { render, screen, userEvent } from "@testing-library/react-native";
import { Linking } from "react-native";

import AboutRoute from "../app/about";
import { ThemeProvider } from "../lib/theme";
import { resetRouterMock, routerMock } from "./support/expoRouterMock";

jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: { getItem: () => Promise.resolve(null), setItem: () => Promise.resolve() },
}));
jest.mock(
  "expo-router",
  () => jest.requireActual<{ mockExpoRouter: unknown }>("./support/expoRouterMock").mockExpoRouter,
);
jest.mock(
  "react-native-safe-area-context",
  () =>
    jest.requireActual<{ default: unknown }>("react-native-safe-area-context/jest/mock").default,
);

async function renderAbout() {
  const user = userEvent.setup();
  await render(
    <ThemeProvider>
      <AboutRoute />
    </ThemeProvider>,
  );
  return user;
}

describe("the About screen", () => {
  beforeEach(() => {
    resetRouterMock();
  });

  it("should be headed About", async () => {
    await renderAbout();

    expect(screen.getByRole("heading", { name: "About" })).toBeOnTheScreen();
  });

  it("should go back to More when Back is pressed", async () => {
    const user = await renderAbout();

    await user.press(screen.getByRole("button", { name: "Back" }));

    expect(routerMock.back).toHaveBeenCalledTimes(1);
  });

  it("should go to More when there is no screen to go back to", async () => {
    routerMock.canGoBack.mockReturnValue(false);
    const user = await renderAbout();

    await user.press(screen.getByRole("button", { name: "Back" }));

    expect(routerMock.back).not.toHaveBeenCalled();
    expect(routerMock.replace).toHaveBeenCalledWith("/(tabs)/more");
  });

  describe("the Data sources section", () => {
    it("should have a Data sources heading", async () => {
      await renderAbout();

      expect(screen.getByRole("heading", { name: "Data sources" })).toBeOnTheScreen();
    });

    it("should credit the CoFID dataset with its full Open Government Licence statement", async () => {
      await renderAbout();

      expect(screen.getByText(DATA_SOURCE_ATTRIBUTION.cofid.name)).toBeOnTheScreen();
      expect(screen.getByText(DATA_SOURCE_ATTRIBUTION.cofid.text)).toBeOnTheScreen();
      expect(
        screen.getByRole("link", { name: DATA_SOURCE_ATTRIBUTION.cofid.url }),
      ).toBeOnTheScreen();
    });

    it("should credit Open Food Facts under the Open Database Licence", async () => {
      await renderAbout();

      expect(screen.getByText(DATA_SOURCE_ATTRIBUTION.off.name)).toBeOnTheScreen();
      expect(screen.getByText(DATA_SOURCE_ATTRIBUTION.off.text)).toBeOnTheScreen();
      expect(screen.getByRole("link", { name: DATA_SOURCE_ATTRIBUTION.off.url })).toBeOnTheScreen();
    });

    it.each([
      ["CoFID", DATA_SOURCE_ATTRIBUTION.cofid.url],
      ["Open Food Facts", DATA_SOURCE_ATTRIBUTION.off.url],
    ])("should open the %s address in the browser when it is pressed", async (_source, url) => {
      const openURL = jest.spyOn(Linking, "openURL").mockResolvedValue(true);
      const user = await renderAbout();

      await user.press(screen.getByRole("link", { name: url }));

      expect(openURL).toHaveBeenCalledTimes(1);
      expect(openURL).toHaveBeenCalledWith(url);
      openURL.mockRestore();
    });

    it("should reach the 44 point touch target past its line of text", async () => {
      await renderAbout();

      expect(screen.getByRole("link", { name: DATA_SOURCE_ATTRIBUTION.off.url })).toHaveProp(
        "hitSlop",
        { top: 14, bottom: 14 },
      );
    });

    it("should stay on the screen, with nothing unhandled, when the browser cannot be opened", async () => {
      const openURL = jest.spyOn(Linking, "openURL").mockRejectedValue(new Error("no browser"));
      const user = await renderAbout();

      await user.press(screen.getByRole("link", { name: DATA_SOURCE_ATTRIBUTION.off.url }));

      expect(openURL).toHaveBeenCalledTimes(1);
      expect(screen.getByRole("heading", { name: "About" })).toBeOnTheScreen();
      openURL.mockRestore();
    });
  });
});
