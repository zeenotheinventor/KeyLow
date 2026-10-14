# @keylow/expo-doctor-gate

Runs `npx expo-doctor` for the CI step "Check the Expo project health" and decides whether the run fails.

Expo publishes SDK patch releases often, and we install them in a batch, when a native build is being made anyway, because each one changes the native fingerprint. `expo-doctor` has no option that treats patch-only version mismatches as a warning. Its only switches are `EXPO_DOCTOR_SKIP_DEPENDENCY_VERSION_CHECK`, which turns the whole version check off, and `expo.install.exclude`, which hides a package from it entirely. Both would also hide a minor or major mismatch.

So this tool reads the report instead:

| Doctor report                                                                                        | Result                                                   |
| ---------------------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| Exit code 0                                                                                          | Pass                                                     |
| The version check is the only failed check and lists only "Patch version mismatches"                 | Pass with a `::warning::` annotation naming each package |
| Any other failed check, a minor, major or other/prerelease mismatch, or a report that cannot be read | Fail, with an `::error::` annotation giving the reason   |

A report is only treated as patch-only when every row parses as a package with an expected and a found version, the two share a major and minor version, and the out-of-date count matches the rows. Anything else fails, so a change in doctor's output format makes CI red instead of passing silently.

Run it from `apps/mobile`:

```sh
node --experimental-strip-types ../../tools/expo-doctor-gate/src/runDoctorGate.ts
```

`pnpm test` here runs the classifier against reports captured from real doctor runs (`test/fixtures`).

`expo-doctor` is pinned to an exact version in this package's `package.json`, so a new doctor release cannot change CI on its own. The fixtures were captured from that version. Upgrading doctor means re-capturing the fixtures from real runs and checking the tests still pass.
