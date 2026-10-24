// The `eas-build-pre-install` hook in package.json runs this on the EAS builder, in the app directory.
// It copies the commit of the build into `.env.local`, which Expo CLI reads when it bundles the app, so the
// About screen of a fresh APK shows the commit it was built from. `.env.local` is git-ignored and is not a
// fingerprint source, unlike the Expo config and `eas.json`, where a commit would change the runtime version
// on every merge. This never fails the build: it does nothing when the variable is absent or is not a commit,
// a write that fails only logs a warning, and a `.env.local` that is already there is never touched.
const { writeFileSync } = require("node:fs");
const path = require("node:path");

const commit = process.env.EAS_BUILD_GIT_COMMIT_HASH ?? "";

// Exactly 40 hex characters, so nothing else (a second line, say) can end up in the file.
if (/^[0-9a-f]{40}$/i.test(commit)) {
  try {
    writeFileSync(path.join(process.cwd(), ".env.local"), `EXPO_PUBLIC_COMMIT_SHA=${commit}\n`, {
      flag: "wx",
    });
    console.log("wrote EXPO_PUBLIC_COMMIT_SHA to .env.local");
  } catch (error) {
    console.warn(
      `could not write EXPO_PUBLIC_COMMIT_SHA to .env.local (${error.code ?? "unknown"})`,
    );
  }
}
