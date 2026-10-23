import { CAMERA_PERMISSION } from "@keylow/core/copy";
import { themes } from "@keylow/tokens";

import appJson from "../app.json";

// Typed by hand because the app has no Node type definitions.
const { existsSync, readFileSync } = jest.requireActual<{
  existsSync: (path: string) => boolean;
  readFileSync: (path: string) => {
    readUInt32BE: (offset: number) => number;
    readUInt8: (offset: number) => number;
  };
}>("node:fs");

const PNG_WIDTH_OFFSET = 16;
const PNG_HEIGHT_OFFSET = 20;
const PNG_COLOR_TYPE_OFFSET = 25;
const PNG_COLOR_TYPE_RGB = 2;
const PNG_COLOR_TYPE_RGBA = 6;

function readPngHeader(path: string) {
  const bytes = readFileSync(path);
  return {
    width: bytes.readUInt32BE(PNG_WIDTH_OFFSET),
    height: bytes.readUInt32BE(PNG_HEIGHT_OFFSET),
    colorType: bytes.readUInt8(PNG_COLOR_TYPE_OFFSET),
  };
}

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
  describe("identity", () => {
    it("should name the app Ki-Lo", () => {
      expect(expo.name).toBe("Ki-Lo");
    });

    it("should keep the identifiers that the rename ruling froze", () => {
      expect({
        slug: expo.slug,
        scheme: expo.scheme,
        iosBundleIdentifier: expo.ios.bundleIdentifier,
        androidPackage: expo.android.package,
        owner: expo.owner,
        easProjectId: expo.extra.eas.projectId,
        updatesUrl: expo.updates.url,
      }).toEqual({
        slug: "keylow",
        scheme: "keylow",
        iosBundleIdentifier: "com.sojisoft.keylow",
        androidPackage: "com.sojisoft.keylow",
        owner: "sojisoft",
        easProjectId: "cd8bec0b-6864-4b6f-97ef-e07d1a381b3a",
        updatesUrl: "https://u.expo.dev/cd8bec0b-6864-4b6f-97ef-e07d1a381b3a",
      });
    });

    // The system prompt and the scanner's own screen ask for the camera, so they say the same thing, in
    // the app's own name.
    it("should ask for the camera in the words the scanner's own camera screen uses", () => {
      expect(pluginOptions("expo-camera")?.cameraPermission).toBe(CAMERA_PERMISSION.ask.body);
    });
  });

  describe("health data (M5)", () => {
    it("should ask Health Connect for the weight, body fat and lean mass read permissions and nothing else from it", () => {
      const healthPermissions = expo.android.permissions.filter((permission) =>
        permission.startsWith("android.permission.health."),
      );

      expect(healthPermissions).toEqual([
        "android.permission.health.READ_WEIGHT",
        "android.permission.health.READ_BODY_FAT",
        "android.permission.health.READ_LEAN_BODY_MASS",
      ]);
    });

    it("should list the Health Connect plugin so the permission rationale activity reaches the manifest", () => {
      expect(plugins.map(pluginName)).toContain("react-native-health-connect");
    });

    it("should set the Android minimum SDK that Health Connect requires", () => {
      const options = pluginOptions("expo-build-properties");
      const android = isRecord(options?.android) ? options.android : {};

      expect(android.minSdkVersion).toBeGreaterThanOrEqual(26);
    });

    it("should explain in plain words why the app reads Apple Health, in the app's own name", () => {
      const reason = String(
        pluginOptions("@kingstinct/react-native-healthkit")?.NSHealthShareUsageDescription,
      );

      expect(reason).toContain("Ki-Lo");
      expect(reason).toContain("weight");
      expect(reason).not.toContain("KeyLow");
    });

    it("should not claim the HealthKit background delivery entitlement, which the app has no use for yet", () => {
      expect(pluginOptions("@kingstinct/react-native-healthkit")?.background).toBe(false);
    });

    it("should not ask for permission to write to Apple Health, because the app only reads weight", () => {
      expect(
        pluginOptions("@kingstinct/react-native-healthkit")?.NSHealthUpdateUsageDescription,
      ).toBe(false);
    });
  });

  describe("reminders", () => {
    it("should list the notifications plugin so the scheduling and permission pieces reach the native project", () => {
      expect(plugins.map(pluginName)).toContain("expo-notifications");
    });

    it("should give the Android notification a 96 pixel icon with a transparent background", () => {
      const iconPath = pluginOptions("expo-notifications")?.icon;

      expect(iconPath).toBe("./assets/notification-icon.png");
      const path = `${__dirname}/../${String(iconPath)}`;
      expect(existsSync(path)).toBe(true);
      const { width, height, colorType } = readPngHeader(path);
      expect([width, height, colorType]).toEqual([96, 96, PNG_COLOR_TYPE_RGBA]);
    });

    it("should tint the Android notification icon with the accent colour of the design tokens", () => {
      expect(String(pluginOptions("expo-notifications")?.color).toLowerCase()).toBe(
        themes.dark.accent.toLowerCase(),
      );
    });
  });

  describe("icons", () => {
    it("should ship an opaque square 1024 pixel iOS icon, because the App Store rejects an alpha channel", () => {
      expect(readPngHeader(expo.icon)).toEqual({
        width: 1024,
        height: 1024,
        colorType: PNG_COLOR_TYPE_RGB,
      });
    });

    it.each([
      ["foreground", expo.android.adaptiveIcon.foregroundImage],
      ["monochrome", expo.android.adaptiveIcon.monochromeImage],
    ])("should ship a square 1024 pixel Android adaptive %s layer", (_layer, path) => {
      const { width, height } = readPngHeader(path);

      expect({ width, height }).toEqual({ width: 1024, height: 1024 });
    });

    it("should paint the Android adaptive background with the dark background token", () => {
      expect(expo.android.adaptiveIcon.backgroundColor.toLowerCase()).toBe(
        themes.dark.background.toLowerCase(),
      );
    });

    // Expo prefers a background image over the colour, so a leftover image would hide the token.
    it("should not set an Android adaptive background image", () => {
      expect("backgroundImage" in expo.android.adaptiveIcon).toBe(false);
    });
  });

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
  // such resource and fails to link.
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
