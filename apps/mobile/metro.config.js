const { execFileSync } = require("node:child_process");
const path = require("node:path");

const { getSentryExpoConfig } = require("@sentry/react-native/metro");
const { withStorybook } = require("@storybook/react-native/metro/withStorybook");
const { withNativeWind } = require("nativewind/metro");

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, "../..");

// components/ui/index.ts is generated from the kit's folders and not committed, so a start after a pull
// that added a component writes it again. `pnpm generate:lists` does the same by hand.
execFileSync(
  process.execPath,
  [
    "--experimental-strip-types",
    "--no-warnings",
    path.join(workspaceRoot, "tools", "generate-lists", "src", "run.ts"),
    "ui-barrel",
    "icon-map",
    "icon-tones",
  ],
  { stdio: "inherit" },
);

// The Expo default config with Sentry's debug ids added to every bundle and source map, so a stack from
// an update or a build maps back to the source.
const config = getSentryExpoConfig(projectRoot);

config.watchFolders = [workspaceRoot];
// The 3D body is a glb, which Metro bundles as an asset only when it knows the extension.
config.resolver.assetExts.push("glb");
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  path.resolve(workspaceRoot, "node_modules"),
];
// disableHierarchicalLookup is left unset because expo-doctor on SDK 57 rejects it. The hoisted linker, the root react override and `pnpm dedupe --check` guard against duplicate React instead.

const isStorybookEnabled = process.env.EXPO_PUBLIC_STORYBOOK === "true";

// Storybook sends usage telemetry when it starts under Metro. This turns it off unless the shell already says otherwise.
if (isStorybookEnabled) {
  process.env.STORYBOOK_DISABLE_TELEMETRY ??= "1";
}

// Without EXPO_PUBLIC_STORYBOOK=true, Storybook is left out of the bundle: its imports resolve to empty modules
// and app/storybook.tsx gets a stub in place of the Storybook screen. With it, Metro writes the story index
// (.rnstorybook/storybook.requires.ts) on every start.
const finalConfig = withStorybook(withNativeWind(config, { input: "./global.css" }), {
  enabled: isStorybookEnabled,
  configPath: path.resolve(projectRoot, ".rnstorybook"),
});

// three's CommonJS build (build/three.cjs, which react-three-fiber's native build reaches with
// require("three")) calls process.emitWarning with no check, and React Native's process has no
// emitWarning, so it throws on first render. The ES module build has no such call. Every import of
// "three" goes to it, so the app also holds one copy of three. The resolvers that NativeWind and
// Storybook set are kept and still answer every other import.
const threeModuleBuild = path.join(path.dirname(require.resolve("three")), "three.module.js");
const resolveOtherImports = finalConfig.resolver.resolveRequest;
finalConfig.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === "three") {
    return { type: "sourceFile", filePath: threeModuleBuild };
  }
  return (resolveOtherImports ?? context.resolveRequest)(context, moduleName, platform);
};

module.exports = finalConfig;
