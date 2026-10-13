import { themes } from "@keylow/tokens";

import appJson from "../app.json";

// Typed by hand because the app has no Node type definitions.
const { existsSync } = jest.requireActual<{ existsSync: (path: string) => boolean }>("node:fs");

const { expo } = appJson;

type PluginEntry = string | [string, Record<string, unknown>];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isPluginEntry(value: unknown): value is PluginEntry {
  return (
    typeof value === "string" ||
    (Array.isArray(value) && typeof value[0] === "string" && isRecord(value[1]))
  );
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

const allPlugins: unknown[] = expo.plugins;
const plugins = allPlugins.filter(isPluginEntry);

function pluginName(entry: PluginEntry): string {
  return typeof entry === "string" ? entry : entry[0];
}

function pluginOptions(name: string): Record<string, unknown> | undefined {
  const entry = plugins.find((candidate) => pluginName(candidate) === name);
  return typeof entry === "object" ? entry[1] : undefined;
}

describe("app.json", () => {
  it("should let the native appearance follow the device so the app can choose its own scheme", () => {
    expect(expo.userInterfaceStyle).toBe("automatic");
  });

  it("should paint the Android window with the dark background token", () => {
    expect(expo.android.backgroundColor.toLowerCase()).toBe(themes.dark.background.toLowerCase());
  });

  it("should paint the splash with the dark background token so there is no white flash", () => {
    const splash = pluginOptions("expo-splash-screen");

    expect(String(splash?.backgroundColor).toLowerCase()).toBe(
      themes.dark.background.toLowerCase(),
    );
  });

  // The splash style names a drawable made from this image. Without one the Android build has no
  // such resource and fails to link, so the artwork (KEY-91) replaces a blank placeholder.
  it("should give the splash an image that exists, so the Android splash drawable is generated", () => {
    const splash = pluginOptions("expo-splash-screen");

    expect(existsSync(String(splash?.image))).toBe(true);
  });

  it("should list the system UI plugin so the root background and appearance reach the native project", () => {
    expect(plugins.map(pluginName)).toContain("expo-system-ui");
  });

  describe("embedded Geist", () => {
    const fonts = pluginOptions("expo-font")?.fonts;
    const fontPaths = isStringArray(fonts) ? fonts : [];

    it("should embed one file for each of the three weights", () => {
      expect(fontPaths.map((path) => path.split("/").pop())).toEqual([
        "Geist-Regular.ttf",
        "Geist-Medium.ttf",
        "Geist-SemiBold.ttf",
      ]);
    });

    it.each(fontPaths)("should point at a font file that exists: %s", (path) => {
      expect(existsSync(path)).toBe(true);
    });
  });
});
