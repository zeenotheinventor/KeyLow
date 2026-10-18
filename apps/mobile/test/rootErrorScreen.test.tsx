import { GENERIC_ERROR, RETRY_LABEL, ROOT_ERROR } from "@keylow/core/copy";
import { captureException } from "@sentry/react-native";
import { render, screen, userEvent } from "@testing-library/react-native";
import { ExpoRoot, Stack } from "expo-router";
import { getMockContext } from "expo-router/testing-library";
import { Text } from "react-native";
import { setUpTests } from "react-native-reanimated";

import { RootErrorScreen } from "../components/RootErrorScreen";
import { compileKitStyles } from "./support/kitStyles";
import { registerAppStyles } from "./support/nativeWindStyles";
import { resolvedColor } from "./support/themeColor";

import type { ThemeScheme } from "@keylow/tokens";
import type { ComponentType } from "react";

// The screen the root layout shows in place of the whole app when a route fails to render, mounted through
// the real expo-router on small stand-in routes (a bare layout, a route that throws, a diary): the layout is
// replaced, so it has no theme, safe area or query client of the app's.

// The theme preference the app finds in storage, which a test changes to see the light scheme.
let mockStoredPreference: string | null = null;

jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: {
    getItem: (key: string) => Promise.resolve(key === "kl-theme" ? mockStoredPreference : null),
    setItem: () => Promise.resolve(),
  },
}));
// A status bar draws nothing, so the mock says which style it was asked for.
jest.mock("expo-status-bar", () => {
  const { Text: StatusText } = jest.requireActual<{ Text: ComponentType<{ children: string }> }>(
    "react-native",
  );

  return {
    StatusBar: ({ style }: { style?: string }) => (
      <StatusText>{`Status bar ${style ?? "auto"}`}</StatusText>
    ),
  };
});
jest.mock(
  "react-native-safe-area-context",
  () =>
    jest.requireActual<{ default: unknown }>("react-native-safe-area-context/jest/mock").default,
);

setUpTests();

const SECRET = "Chicken breast, 3 kcal, 190 g, user 12345";

// Whether the home route fails to render, which a test changes before it presses Try again.
let homeFails = true;

function HomeRoute() {
  if (homeFails) {
    throw new Error(SECRET);
  }

  return <Text role="heading">Home screen</Text>;
}

function DiaryRoute() {
  return <Text role="heading">Diary screen</Text>;
}

// The layout is a bare stack with nothing around it, so the screen's own providers are what the test proves.
function RootLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}

const routes = {
  _layout: { default: RootLayout, ErrorBoundary: RootErrorScreen },
  index: HomeRoute,
  "(tabs)/diary": DiaryRoute,
};

describe("root error screen", () => {
  let styles: string;
  let consoleError: jest.SpyInstance;

  beforeAll(async () => {
    styles = await compileKitStyles("", ["components/RootErrorScreen"]);
  });

  beforeEach(() => {
    mockStoredPreference = null;
    homeFails = true;
    registerAppStyles(styles);
    // React and the screen both log the error, and the test reads what was logged.
    consoleError = jest.spyOn(console, "error").mockImplementation(() => undefined);
  });

  afterEach(() => {
    consoleError.mockRestore();
  });

  const renderApp = () => render(<ExpoRoot context={getMockContext(routes)} location="/" />);

  it("should show the fixed sentence and two actions in place of a route that fails to render", async () => {
    await renderApp();

    expect(await screen.findByRole("alert")).toHaveTextContent(GENERIC_ERROR);
    expect(screen.getByRole("button", { name: RETRY_LABEL })).toBeOnTheScreen();
    expect(screen.getByRole("button", { name: ROOT_ERROR.diaryAction })).toBeOnTheScreen();
  });

  it("should never put the error's message on the screen", async () => {
    await renderApp();
    await screen.findByRole("alert");

    expect(screen.queryByText(new RegExp(SECRET))).not.toBeOnTheScreen();
    expect(screen.queryByText(/Chicken|kcal|12345/)).not.toBeOnTheScreen();
  });

  it("should log the error with console.error, so its stack can be read from the device log", async () => {
    await renderApp();
    await screen.findByRole("alert");

    const logged = consoleError.mock.calls.flat();
    expect(logged).toContainEqual(expect.objectContaining({ message: SECRET }));
  });

  it("should report the error to Sentry, which scrubs its message before it is sent", async () => {
    await renderApp();
    await screen.findByRole("alert");

    expect(captureException).toHaveBeenCalledWith(expect.objectContaining({ message: SECRET }));
  });

  it("should draw the route again on Try again", async () => {
    const user = userEvent.setup();
    await renderApp();
    await user.press(await screen.findByRole("button", { name: RETRY_LABEL }));
    expect(await screen.findByRole("alert")).toBeOnTheScreen();

    homeFails = false;
    await user.press(screen.getByRole("button", { name: RETRY_LABEL }));

    expect(await screen.findByRole("heading", { name: "Home screen" })).toBeOnTheScreen();
    expect(screen.queryByRole("alert")).not.toBeOnTheScreen();
  });

  it("should land on the Diary tab from the diary action", async () => {
    const user = userEvent.setup();
    await renderApp();

    await user.press(await screen.findByRole("button", { name: ROOT_ERROR.diaryAction }));

    expect(await screen.findByRole("heading", { name: "Diary screen" })).toBeOnTheScreen();
    expect(screen.queryByRole("alert")).not.toBeOnTheScreen();
  });

  describe.each<[ThemeScheme, string]>([
    ["dark", "light"],
    ["light", "dark"],
  ])("on the %s theme", (scheme, statusBarContent) => {
    beforeEach(() => {
      mockStoredPreference = scheme;
    });

    it("should fill the screen with the background token", async () => {
      await renderApp();

      const statusBar = await screen.findByText(/^Status bar/);
      expect(statusBar.parent).toHaveStyle({
        backgroundColor: resolvedColor(scheme, "background"),
      });
    });

    it(`should draw the status bar with ${statusBarContent} content`, async () => {
      await renderApp();

      expect(await screen.findByText(`Status bar ${statusBarContent}`)).toBeOnTheScreen();
    });
  });
});
