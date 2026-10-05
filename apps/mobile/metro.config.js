const path = require("node:path");

const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, "../..");

const config = getDefaultConfig(projectRoot);

config.watchFolders = [workspaceRoot];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  path.resolve(workspaceRoot, "node_modules"),
];
// disableHierarchicalLookup is left unset because expo-doctor on SDK 57 rejects it. The hoisted linker, the root react override and `pnpm dedupe --check` guard against duplicate React instead.

module.exports = withNativeWind(config, { input: "./global.css" });
