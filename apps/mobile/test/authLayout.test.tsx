import { themes } from "@keylow/tokens";
import { render, screen } from "@testing-library/react-native";
import { Text } from "react-native";

import AuthLayout from "../app/(auth)/_layout";
import { ThemeProvider } from "../lib/theme";

import type { ThemeScheme } from "@keylow/tokens";

jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: { getItem: () => Promise.resolve(null), setItem: () => Promise.resolve() },
}));

type StackOptions = { headerShown?: boolean; contentStyle?: { backgroundColor?: string } };

// Stands for the navigator, and says what it was told about its header and the colour behind its screens.
jest.mock("expo-router", () => ({
  Stack: ({ screenOptions }: { screenOptions?: StackOptions }) => {
    const { Text: StackText } = jest.requireActual<{ Text: typeof Text }>("react-native");

    return (
      <StackText>{`Header ${String(screenOptions?.headerShown)} on ${screenOptions?.contentStyle?.backgroundColor}`}</StackText>
    );
  },
}));

describe("auth layout", () => {
  it.each<ThemeScheme>(["dark", "light"])(
    "should hide the header and put the %s background behind the screens, so a change between them never shows white",
    async (scheme) => {
      await render(
        <ThemeProvider fixedPreference={scheme}>
          <AuthLayout />
        </ThemeProvider>,
      );

      expect(screen.getByText(`Header false on ${themes[scheme].background}`)).toBeOnTheScreen();
    },
  );
});
