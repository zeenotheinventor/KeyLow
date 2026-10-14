import type { ConfigContext } from "expo/config";

// app.json stays the single source of the app's configuration. This file only layers the
// development build variant on top of it, so a build without APP_VARIANT resolves to app.json
// exactly. The main app, `eas update` in CI and the fingerprint CI job all run without it.
//
// The development build (EAS profile `development`, which sets APP_VARIANT) gets its own Android
// package and name so it installs beside the main app. iOS is left alone: there are no iOS builds
// yet, and a new bundle identifier would need a new iOS OAuth client in Google Cloud.
export function withAppVariant<Config extends { android?: object }>(
  config: Config,
  appVariant: unknown,
) {
  if (appVariant !== "development") {
    return config;
  }

  return {
    ...config,
    name: "Ki-Lo Dev",
    android: { ...config.android, package: "com.sojisoft.keylow.dev" },
  };
}

export default ({ config }: ConfigContext) => withAppVariant(config, process.env.APP_VARIANT);
