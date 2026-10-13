import { themes } from "@keylow/tokens";
import { render, screen, userEvent } from "@testing-library/react-native";
import { Pressable, Text } from "react-native";

import { ThemeProvider, useTheme } from "../lib/theme";
import { deviceScheme } from "./support/deviceScheme";
import { compileAppStyles, registerAppStyles } from "./support/nativeWindStyles";

import type { ThemeScheme } from "@keylow/tokens";

jest.mock(
  "react-native/Libraries/Utilities/useColorScheme",
  () =>
    jest.requireActual<typeof import("./support/deviceScheme")>("./support/deviceScheme")
      .mockDeviceSchemeHook,
);

const mockStorageItems = new Map<string, string>();

jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: {
    getItem: (key: string) => Promise.resolve(mockStorageItems.get(key) ?? null),
    setItem: (key: string, value: string) => {
      mockStorageItems.set(key, value);
      return Promise.resolve();
    },
  },
}));

// A throwaway stand-in for a themed screen. It is the seed for a story once Storybook lands.
function Swatch() {
  const { setScheme } = useTheme();

  return (
    <>
      <Text className="bg-surface text-text-primary">Swatch</Text>
      <Pressable
        accessibilityRole="button"
        onPress={() => {
          setScheme("light");
        }}
      >
        <Text>Use light</Text>
      </Pressable>
    </>
  );
}

// NativeWind resolves a colour to `rgba(r, g, b, a)`, so read the expected one from the token.
function toRgba(hex: string): string {
  const [red, green, blue] = [1, 3, 5].map((start) => parseInt(hex.slice(start, start + 2), 16));
  return `rgba(${red}, ${green}, ${blue}, 1)`;
}

function expectedStyle(scheme: ThemeScheme) {
  return {
    backgroundColor: toRgba(themes[scheme].surface),
    color: toRgba(themes[scheme]["text-primary"]),
  };
}

describe("theme classes", () => {
  let appStyles: string;

  beforeAll(async () => {
    appStyles = await compileAppStyles("bg-surface text-text-primary");
  });

  beforeEach(() => {
    mockStorageItems.clear();
    deviceScheme.current = "light";
    registerAppStyles(appStyles);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("should resolve bg-surface and text-text-primary to the dark tokens by default", async () => {
    await render(
      <ThemeProvider>
        <Swatch />
      </ThemeProvider>,
    );

    expect(await screen.findByText("Swatch")).toHaveStyle(expectedStyle("dark"));
  });

  // The stylesheet's own fallback is dark, so a light result can only come from the variables the
  // provider sets for the scheme in use. This test fails if they are missing.
  it("should resolve the same classes to the light tokens when the preference is light", async () => {
    mockStorageItems.set("kl-theme", "light");

    await render(
      <ThemeProvider>
        <Swatch />
      </ThemeProvider>,
    );

    expect(await screen.findByText("Swatch")).toHaveStyle(expectedStyle("light"));
  });

  it("should resolve the classes from the app's preference, not the device scheme", async () => {
    mockStorageItems.set("kl-theme", "light");
    deviceScheme.current = "dark";

    await render(
      <ThemeProvider>
        <Swatch />
      </ThemeProvider>,
    );

    expect(await screen.findByText("Swatch")).toHaveStyle(expectedStyle("light"));
  });

  it("should resolve the classes from the device scheme when the preference is match-device", async () => {
    mockStorageItems.set("kl-theme", "system");
    deviceScheme.current = "light";

    await render(
      <ThemeProvider>
        <Swatch />
      </ThemeProvider>,
    );

    expect(await screen.findByText("Swatch")).toHaveStyle(expectedStyle("light"));
  });

  it("should restyle the same classes when the scheme is switched", async () => {
    const user = userEvent.setup();
    await render(
      <ThemeProvider>
        <Swatch />
      </ThemeProvider>,
    );
    expect(await screen.findByText("Swatch")).toHaveStyle(expectedStyle("dark"));

    await user.press(screen.getByRole("button", { name: "Use light" }));

    expect(screen.getByText("Swatch")).toHaveStyle(expectedStyle("light"));
  });
});
