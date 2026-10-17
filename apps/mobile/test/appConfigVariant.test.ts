import appConfig, { withAppVariant } from "../app.config";
import appJson from "../app.json";

import type { ConfigContext } from "expo/config";

const { expo } = appJson;

describe("app.config.ts", () => {
  describe("default export", () => {
    afterEach(() => {
      delete process.env.APP_VARIANT;
    });

    // Expo passes the app.json config in as `config`. A stand-in with fields of every kind shows
    // that the default export builds on it instead of starting from an empty config.
    function resolveWith(config: ConfigContext["config"]) {
      return appConfig({
        projectRoot: ".",
        staticConfigPath: "app.json",
        packageJsonPath: "package.json",
        config,
      });
    }

    const givenConfig = {
      name: "Given App",
      slug: "given-app",
      ios: { bundleIdentifier: "com.example.given" },
      android: { package: "com.example.given", versionCode: 7 },
    };

    it("should read APP_VARIANT from the environment and keep the fields it is given", () => {
      process.env.APP_VARIANT = "development";

      expect(resolveWith(givenConfig)).toEqual({
        name: "Ki-Lo Dev",
        slug: "given-app",
        ios: { bundleIdentifier: "com.example.given" },
        android: { package: "com.sojisoft.keylow.dev", versionCode: 7 },
        extra: { appVariant: "development" },
      });
    });

    it("should return the config it is given when APP_VARIANT is not set", () => {
      delete process.env.APP_VARIANT;

      expect(resolveWith(givenConfig)).toEqual(givenConfig);
    });
  });

  describe("without an app variant, the main app", () => {
    it("should resolve to exactly the static app.json config", () => {
      expect(withAppVariant(expo, undefined)).toEqual(expo);
    });

    it("should keep the main Android package and name", () => {
      const config = withAppVariant(expo, undefined);

      expect({ name: config.name, androidPackage: config.android.package }).toEqual({
        name: "Ki-Lo",
        androidPackage: "com.sojisoft.keylow",
      });
    });

    it.each(["production", "", "Development"])(
      "should ignore the unknown variant %p and resolve to the static config",
      (appVariant) => {
        expect(withAppVariant(expo, appVariant)).toEqual(expo);
      },
    );
  });

  describe("with APP_VARIANT=development, the development build", () => {
    it("should get its own Android package and a name that tells it apart", () => {
      const config = withAppVariant(expo, "development");

      expect({ name: config.name, androidPackage: config.android.package }).toEqual({
        name: "Ki-Lo Dev",
        androidPackage: "com.sojisoft.keylow.dev",
      });
    });

    it("should leave the iOS bundle identifier alone, because a new one needs a new iOS OAuth client", () => {
      expect(withAppVariant(expo, "development").ios).toEqual(expo.ios);
    });

    it("should tell the app its variant, which Sentry reports as the environment, and keep the rest of extra", () => {
      expect(withAppVariant(expo, "development").extra).toEqual({
        ...expo.extra,
        appVariant: "development",
      });
    });

    it("should change nothing except the name, the Android package and the variant", () => {
      const config = withAppVariant(expo, "development");

      expect({
        ...config,
        name: expo.name,
        android: { ...config.android, package: expo.android.package },
        extra: expo.extra,
      }).toEqual(expo);
    });

    it("should not modify the static config it was given", () => {
      withAppVariant(expo, "development");

      expect(expo.android.package).toBe("com.sojisoft.keylow");
      expect(expo.name).toBe("Ki-Lo");
    });
  });
});
