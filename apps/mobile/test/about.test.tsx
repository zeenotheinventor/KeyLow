import { LEGAL_URLS } from "@keylow/core/copy";
import { DATA_SOURCE_ATTRIBUTION } from "@keylow/core/foods";
import { render, screen, userEvent, within } from "@testing-library/react-native";
import { Linking } from "react-native";

import AboutRoute from "../app/about";
import { ThemeProvider } from "../lib/theme";
import { resetRouterMock, routerMock } from "./support/expoRouterMock";

jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: { getItem: () => Promise.resolve(null), setItem: () => Promise.resolve() },
}));
type MockUpdatesState = {
  isEnabled: boolean;
  isEmbeddedLaunch: boolean;
  createdAt: Date | null;
};

// The state expo-updates reports, which a test changes. The mock reads it at call time.
const mockUpdatesState: MockUpdatesState = {
  isEnabled: true,
  isEmbeddedLaunch: false,
  createdAt: new Date("2026-10-15T10:00:00Z"),
};

jest.mock("expo-updates", () => ({
  get isEnabled() {
    return mockUpdatesState.isEnabled;
  },
  get isEmbeddedLaunch() {
    return mockUpdatesState.isEmbeddedLaunch;
  },
  get createdAt() {
    return mockUpdatesState.createdAt;
  },
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

// The screen reads the device zone from Intl, so a test pins it. Without that the line depends on the runner.
function setDeviceTimeZone(timeZone: string) {
  jest.spyOn(Intl.DateTimeFormat.prototype, "resolvedOptions").mockImplementation(() => ({
    locale: "en-GB",
    calendar: "gregory",
    numberingSystem: "latn",
    timeZone,
  }));
}

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
    mockUpdatesState.isEnabled = true;
    mockUpdatesState.isEmbeddedLaunch = false;
    mockUpdatesState.createdAt = new Date("2026-10-15T10:00:00Z");
    setDeviceTimeZone("UTC");
  });

  afterEach(() => {
    delete process.env.EXPO_PUBLIC_COMMIT_SHA;
    jest.restoreAllMocks();
    // `Linking.openURL` is already a mock in the React Native jest setup, so restoring it keeps its calls. Clearing drops them.
    jest.clearAllMocks();
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
    });
  });

  describe("the Legal section", () => {
    it("should have a Legal heading", async () => {
      await renderAbout();

      expect(screen.getByRole("heading", { name: "Legal" })).toBeOnTheScreen();
    });

    it("should list Privacy Policy then Terms in the Legal list", async () => {
      await renderAbout();

      const rows = within(screen.getByLabelText("Legal")).getAllByRole("button");
      expect(rows).toHaveLength(2);
      expect(rows[0]).toHaveAccessibleName("Privacy Policy");
      expect(rows[1]).toHaveAccessibleName("Terms");
    });

    it("should come after the Data sources section", async () => {
      await renderAbout();

      const headings = screen.getAllByRole("heading");
      expect(headings.at(-2)).toHaveTextContent("Data sources");
      expect(headings.at(-1)).toHaveTextContent("Legal");
    });

    it.each([
      ["Privacy Policy", LEGAL_URLS.privacy],
      ["Terms", LEGAL_URLS.terms],
    ])("should open the %s page in the browser when its row is pressed", async (name, url) => {
      const openURL = jest.spyOn(Linking, "openURL").mockResolvedValue(true);
      const user = await renderAbout();

      await user.press(screen.getByRole("button", { name }));

      expect(openURL).toHaveBeenCalledTimes(1);
      expect(openURL).toHaveBeenCalledWith(url);
    });

    it("should stay on the screen, with nothing unhandled, when the browser cannot be opened", async () => {
      const openURL = jest.spyOn(Linking, "openURL").mockRejectedValue(new Error("no browser"));
      const user = await renderAbout();

      await user.press(screen.getByRole("button", { name: "Terms" }));

      expect(openURL).toHaveBeenCalledTimes(1);
      expect(screen.getByRole("heading", { name: "About" })).toBeOnTheScreen();
    });
  });

  describe("the version line", () => {
    it("should show the version and the commit the update was built from", async () => {
      process.env.EXPO_PUBLIC_COMMIT_SHA = "a1b2c3d4e5f60718293a4b5c6d7e8f9012345678";
      await renderAbout();

      expect(screen.getByText("Version 1.0.0 (a1b2c3d)")).toBeOnTheScreen();
    });

    it("should show only the version when the build has no commit", async () => {
      await renderAbout();

      expect(screen.getByText("Version 1.0.0")).toBeOnTheScreen();
    });

    it("should say on which day and at what time the running update was made", async () => {
      await renderAbout();

      expect(screen.getByText("Updated 15 Oct 2026, 10:00")).toBeOnTheScreen();
    });

    it("should give the update time in the device time zone", async () => {
      mockUpdatesState.createdAt = new Date("2026-10-15T23:30:00Z");
      setDeviceTimeZone("Pacific/Auckland");
      await renderAbout();

      expect(screen.getByText("Updated 16 Oct 2026, 12:30")).toBeOnTheScreen();
    });

    it("should say Built in when the app runs the bundle it shipped with", async () => {
      mockUpdatesState.isEmbeddedLaunch = true;
      await renderAbout();

      expect(screen.getByText("Built in")).toBeOnTheScreen();
    });

    it("should show no second line when updates are disabled", async () => {
      mockUpdatesState.isEnabled = false;
      await renderAbout();

      expect(screen.queryByText(/^Updated /)).not.toBeOnTheScreen();
      expect(screen.queryByText("Built in")).not.toBeOnTheScreen();
    });

    it("should add no heading", async () => {
      await renderAbout();

      // The stack header, Data sources and Legal.
      expect(screen.getAllByRole("heading")).toHaveLength(3);
    });
  });
});
