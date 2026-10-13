import { themes } from "@keylow/tokens";
import { render, screen, userEvent, waitFor } from "@testing-library/react-native";
import { Appearance, Pressable, Text } from "react-native";

import { ThemeProvider, useTheme } from "../lib/theme";
import { deviceScheme } from "./support/deviceScheme";

import type { Theme } from "../lib/theme";

const mockStorageItems = new Map<string, string>();
const mockGetItem = jest.fn((key: string) => Promise.resolve(mockStorageItems.get(key) ?? null));
const mockSetItem = jest.fn((key: string, value: string) => {
  mockStorageItems.set(key, value);
  return Promise.resolve();
});

jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: {
    getItem: (key: string) => mockGetItem(key),
    setItem: (key: string, value: string) => mockSetItem(key, value),
  },
}));

jest.mock(
  "react-native/Libraries/Utilities/useColorScheme",
  () =>
    jest.requireActual<typeof import("./support/deviceScheme")>("./support/deviceScheme")
      .mockDeviceSchemeHook,
);

const storageKey = "kl-theme";

function noop(): void {
  // The probe needs a callback, and these tests do not read the theme from it.
}

// Shows what the hook returns, and offers one button per preference.
function ThemeProbe({ onTheme }: { onTheme: (theme: Theme) => void }) {
  const theme = useTheme();
  onTheme(theme);

  return (
    <>
      <Text>{`scheme:${theme.scheme}`}</Text>
      <Text>{`preference:${theme.preference}`}</Text>
      {(["dark", "light", "system"] as const).map((preference) => (
        <Pressable
          key={preference}
          accessibilityRole="button"
          onPress={() => {
            theme.setScheme(preference);
          }}
        >
          <Text>{`Use ${preference}`}</Text>
        </Pressable>
      ))}
    </>
  );
}

async function renderProbe() {
  let latestTheme: Theme | undefined;
  await render(
    <ThemeProvider>
      <ThemeProbe
        onTheme={(theme) => {
          latestTheme = theme;
        }}
      />
    </ThemeProvider>,
  );
  await screen.findByText(/^scheme:/);

  return () => {
    if (latestTheme === undefined) {
      throw new Error("The probe has not rendered");
    }
    return latestTheme;
  };
}

describe("ThemeProvider", () => {
  let setColorScheme: jest.SpiedFunction<typeof Appearance.setColorScheme>;

  beforeEach(() => {
    mockStorageItems.clear();
    deviceScheme.current = "light";
    mockGetItem.mockClear();
    mockSetItem.mockClear();
    setColorScheme = jest.spyOn(Appearance, "setColorScheme");
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("should default to dark on a fresh install", async () => {
    const getTheme = await renderProbe();

    expect(screen.getByText("scheme:dark")).toBeOnTheScreen();
    expect(screen.getByText("preference:dark")).toBeOnTheScreen();
    expect(getTheme().colors).toEqual(themes.dark);
  });

  it("should read the stored light preference", async () => {
    mockStorageItems.set(storageKey, "light");

    const getTheme = await renderProbe();

    expect(screen.getByText("scheme:light")).toBeOnTheScreen();
    expect(getTheme().colors).toEqual(themes.light);
  });

  it("should read the stored match-device preference", async () => {
    mockStorageItems.set(storageKey, "system");

    await renderProbe();

    expect(screen.getByText("preference:system")).toBeOnTheScreen();
  });

  it.each(["dark", "light"] as const)(
    "should follow the device when it is %s and the preference is match-device",
    async (deviceSchemeName) => {
      mockStorageItems.set(storageKey, "system");
      deviceScheme.current = deviceSchemeName;

      const getTheme = await renderProbe();

      expect(screen.getByText(`scheme:${deviceSchemeName}`)).toBeOnTheScreen();
      expect(getTheme().colors).toEqual(themes[deviceSchemeName]);
    },
  );

  it("should ignore the device scheme when the preference is dark", async () => {
    deviceScheme.current = "light";

    await renderProbe();

    expect(screen.getByText("scheme:dark")).toBeOnTheScreen();
  });

  it("should fall back to dark when the stored value is not a preference", async () => {
    mockStorageItems.set(storageKey, "sepia");

    await renderProbe();

    expect(screen.getByText("preference:dark")).toBeOnTheScreen();
  });

  it("should fall back to dark when the stored preference cannot be read", async () => {
    mockGetItem.mockRejectedValueOnce(new Error("storage unavailable"));

    await renderProbe();

    expect(screen.getByText("preference:dark")).toBeOnTheScreen();
  });

  it("should render nothing until the stored preference has been read", async () => {
    mockGetItem.mockReturnValueOnce(new Promise(() => undefined));

    await render(
      <ThemeProvider>
        <Text>App content</Text>
      </ThemeProvider>,
    );

    expect(screen.queryByText("App content")).not.toBeOnTheScreen();
  });

  it("should switch scheme and colours when the preference changes", async () => {
    const user = userEvent.setup();
    const getTheme = await renderProbe();

    await user.press(screen.getByRole("button", { name: "Use light" }));

    expect(screen.getByText("scheme:light")).toBeOnTheScreen();
    expect(getTheme().colors).toEqual(themes.light);
  });

  it("should persist the preference under kl-theme", async () => {
    const user = userEvent.setup();
    await renderProbe();

    await user.press(screen.getByRole("button", { name: "Use light" }));

    await waitFor(() => {
      expect(mockStorageItems.get(storageKey)).toBe("light");
    });
  });

  it("should keep the preference when it cannot be saved", async () => {
    mockSetItem.mockRejectedValueOnce(new Error("storage full"));
    const user = userEvent.setup();
    await renderProbe();

    await user.press(screen.getByRole("button", { name: "Use light" }));

    expect(screen.getByText("scheme:light")).toBeOnTheScreen();
  });

  it("should keep the native colour scheme in step with the preference", async () => {
    const user = userEvent.setup();
    await renderProbe();
    expect(setColorScheme).toHaveBeenLastCalledWith("dark");

    await user.press(screen.getByRole("button", { name: "Use light" }));
    expect(setColorScheme).toHaveBeenLastCalledWith("light");

    await user.press(screen.getByRole("button", { name: "Use system" }));
    expect(["dark", "light"]).not.toContain(setColorScheme.mock.lastCall?.[0]);
  });
});

describe("ThemeProvider with a fixed preference", () => {
  let setColorScheme: jest.SpiedFunction<typeof Appearance.setColorScheme>;

  beforeEach(() => {
    mockStorageItems.clear();
    mockStorageItems.set(storageKey, "dark");
    mockGetItem.mockClear();
    mockSetItem.mockClear();
    setColorScheme = jest.spyOn(Appearance, "setColorScheme");
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  async function renderFixedProbe() {
    await render(
      <ThemeProvider fixedPreference="light">
        <ThemeProbe onTheme={noop} />
      </ThemeProvider>,
    );
  }

  it("should use the fixed preference on the first render, without waiting for storage", async () => {
    await renderFixedProbe();

    expect(screen.getByText("scheme:light")).toBeOnTheScreen();
    expect(screen.getByText("preference:light")).toBeOnTheScreen();
  });

  it("should not read the stored preference", async () => {
    await renderFixedProbe();

    expect(mockGetItem).not.toHaveBeenCalled();
  });

  it("should ignore a request to change the preference", async () => {
    const user = userEvent.setup();
    await renderFixedProbe();

    await user.press(screen.getByRole("button", { name: "Use dark" }));

    expect(screen.getByText("scheme:light")).toBeOnTheScreen();
    expect(mockSetItem).not.toHaveBeenCalled();
    expect(mockStorageItems.get(storageKey)).toBe("dark");
  });

  it("should leave the native colour scheme alone", async () => {
    const user = userEvent.setup();
    await renderFixedProbe();

    await user.press(screen.getByRole("button", { name: "Use dark" }));

    expect(setColorScheme).not.toHaveBeenCalled();
  });

  it("should follow the device when the fixed preference is match-device", async () => {
    deviceScheme.current = "light";

    await render(
      <ThemeProvider fixedPreference="system">
        <ThemeProbe onTheme={noop} />
      </ThemeProvider>,
    );

    expect(screen.getByText("scheme:light")).toBeOnTheScreen();
  });
});

describe("useTheme", () => {
  it("should throw when used outside the ThemeProvider", async () => {
    jest.spyOn(console, "error").mockImplementation(() => undefined);

    await expect(render(<ThemeProbe onTheme={noop} />)).rejects.toThrow(
      "useTheme must be used inside a ThemeProvider",
    );

    jest.restoreAllMocks();
  });
});
