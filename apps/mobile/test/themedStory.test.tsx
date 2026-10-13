import { render, screen } from "@testing-library/react-native";
import { useEffect } from "react";
import { Text } from "react-native";

import { ThemedStory } from "../.rnstorybook/ThemedStory";
import { useTheme } from "../lib/theme";

import type { ThemeScheme } from "@keylow/tokens";

// The real provider renders nothing until the device reports its insets.
jest.mock(
  "react-native-safe-area-context",
  () =>
    jest.requireActual<{ default: unknown }>("react-native-safe-area-context/jest/mock").default,
);
const mockSetItem = jest.fn<Promise<void>, [string, string]>(() => Promise.resolve());

jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: {
    getItem: () => Promise.resolve(null),
    setItem: (key: string, value: string) => mockSetItem(key, value),
  },
}));

function SchemeProbe() {
  const { scheme } = useTheme();

  return <Text>{`Scheme: ${scheme}`}</Text>;
}

async function renderStory(scheme: ThemeScheme) {
  await render(
    <ThemedStory scheme={scheme}>
      <SchemeProbe />
    </ThemedStory>,
  );
}

describe("ThemedStory", () => {
  beforeEach(() => {
    mockSetItem.mockClear();
  });

  it.each<ThemeScheme>(["dark", "light"])(
    "should show its story in the %s scheme",
    async (scheme) => {
      await renderStory(scheme);

      expect(await screen.findByText(`Scheme: ${scheme}`)).toBeOnTheScreen();
    },
  );

  it("should switch the story to the other scheme when the scheme changes", async () => {
    await renderStory("dark");
    await screen.findByText("Scheme: dark");

    await screen.rerender(
      <ThemedStory scheme="light">
        <SchemeProbe />
      </ThemedStory>,
    );

    expect(await screen.findByText("Scheme: light")).toBeOnTheScreen();
  });

  it("should not save the scheme as the app's preference", async () => {
    await renderStory("dark");

    await screen.rerender(
      <ThemedStory scheme="light">
        <SchemeProbe />
      </ThemedStory>,
    );

    expect(await screen.findByText("Scheme: light")).toBeOnTheScreen();
    expect(mockSetItem).not.toHaveBeenCalled();
  });

  it("should keep the story mounted when the scheme changes", async () => {
    let mountCount = 0;
    function MountCounter() {
      useEffect(() => {
        mountCount += 1;
      }, []);

      return <SchemeProbe />;
    }
    await render(
      <ThemedStory scheme="dark">
        <MountCounter />
      </ThemedStory>,
    );

    await screen.rerender(
      <ThemedStory scheme="light">
        <MountCounter />
      </ThemedStory>,
    );

    expect(await screen.findByText("Scheme: light")).toBeOnTheScreen();
    expect(mountCount).toBe(1);
  });
});
