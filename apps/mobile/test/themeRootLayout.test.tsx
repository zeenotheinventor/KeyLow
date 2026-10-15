import "./support/gestureHandler";

import { themes } from "@keylow/tokens";
import { render, screen } from "@testing-library/react-native";
import { Text } from "react-native";

import RootLayout from "../app/_layout";
import { useTheme } from "../lib/theme";
import { resetRouterMock } from "./support/expoRouterMock";
import { compileKitStyles } from "./support/kitStyles";
import { registerAppStyles } from "./support/nativeWindStyles";
import { resetSupabaseMock } from "./support/supabaseMock";
import { resolvedColor } from "./support/themeColor";

import type { ComponentType, ReactNode } from "react";

// Metro compiles the stylesheet. Jest cannot read it.
jest.mock(
  "react-native-safe-area-context",
  () =>
    jest.requireActual<{ default: unknown }>("react-native-safe-area-context/jest/mock").default,
);
jest.mock("../global.css", () => ({}));
// The theme preference the app finds in storage, which a test changes to see the light scheme.
let mockStoredPreference: string | null = null;

jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: {
    // Only the theme preference is stored. Any other key, such as the diary cache's, is empty.
    getItem: (key: string) => Promise.resolve(key === "kl-theme" ? mockStoredPreference : null),
    setItem: () => Promise.resolve(),
    removeItem: () => Promise.resolve(),
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

type StackOptions = { contentStyle?: { backgroundColor?: string } };

// Stands for the navigator and the screens in it, which read the theme. It says what the stack was told
// the colour behind its screens is.
function MockStack({ screenOptions }: { screenOptions?: StackOptions; children?: ReactNode }) {
  return (
    <Text>{`Screens in ${useTheme().scheme} on ${screenOptions?.contentStyle?.backgroundColor}`}</Text>
  );
}
// The layout declares the options of a screen with `Stack.Screen`, which draws nothing.
MockStack.Screen = function MockScreen() {
  return null;
};

jest.mock("expo-router", () => ({
  ...jest.requireActual<{ mockExpoRouter: object }>("./support/expoRouterMock").mockExpoRouter,
  Stack: MockStack,
}));
jest.mock("../lib/supabase", () => ({
  supabase: jest.requireActual<{ mockSupabaseClient: unknown }>("./support/supabaseMock")
    .mockSupabaseClient,
}));

describe("root layout", () => {
  let styles: string;

  beforeAll(async () => {
    styles = await compileKitStyles("", ["components/RootNavigator"]);
  });

  beforeEach(() => {
    mockStoredPreference = null;
    registerAppStyles(styles);
    resetRouterMock();
    resetSupabaseMock();
  });

  it("should give the screens the theme, dark by default", async () => {
    await render(<RootLayout />);

    expect(await screen.findByText(/^Screens in dark/)).toBeOnTheScreen();
  });

  describe.each([
    ["dark", "light"],
    ["light", "dark"],
  ] as const)("on the %s theme", (scheme, content) => {
    beforeEach(() => {
      mockStoredPreference = scheme;
    });

    it(`should draw the status bar with ${content} content`, async () => {
      await render(<RootLayout />);

      expect(await screen.findByText(`Status bar ${content}`)).toBeOnTheScreen();
    });

    it("should put the background token behind the screens", async () => {
      await render(<RootLayout />);

      expect(
        await screen.findByText(`Screens in ${scheme} on ${themes[scheme].background}`),
      ).toBeOnTheScreen();
    });

    it("should fill the root with the background token", async () => {
      await render(<RootLayout />);

      const statusBar = await screen.findByText(`Status bar ${content}`);
      expect(statusBar.parent).toHaveStyle({
        backgroundColor: resolvedColor(scheme, "background"),
      });
    });
  });
});
