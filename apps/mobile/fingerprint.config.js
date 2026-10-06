// Read by the @expo/fingerprint CLI (the mobile-fingerprint job in ci.yml) and by expo-updates when
// it resolves the `fingerprint` runtimeVersion policy for builds and `eas update`, so one file keeps
// both on the same hash. expo-updates passes no skips of its own, so without this file the hash
// covers every key of the Expo config.
//
// Skip only the EAS project metadata (`owner`, `extra.eas`, `updates.url`). It says who owns the
// project and where updates are fetched from. It is plain configuration, not native code, so an
// edit to it does not make a JavaScript update incompatible with an installed build. Everything
// else that reaches a native build (plugins, bundle identifier, scheme, icons) still counts.
module.exports = {
  sourceSkips: ["ExpoConfigEASProject"],
};
