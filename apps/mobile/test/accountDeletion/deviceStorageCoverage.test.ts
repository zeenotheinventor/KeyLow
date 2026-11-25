import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

import { deviceStorage } from "../../lib/accountDeletion/deviceStorage";

jest.mock(
  "@react-native-async-storage/async-storage",
  () =>
    jest.requireActual<typeof import("../support/asyncStorageFake")>("../support/asyncStorageFake")
      .asyncStorageFake,
);
jest.mock(
  "expo-secure-store",
  () =>
    jest.requireActual<{ secureStoreFake: unknown }>("../support/diaryCacheStoresFake")
      .secureStoreFake,
);

const libDirectory = path.join(__dirname, "..", "..", "lib");

function sourceFilesUnder(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      return sourceFilesUnder(entryPath);
    }
    return entryPath.endsWith(".ts") && !/\.(test|stories)\.ts$/.test(entryPath) ? [entryPath] : [];
  });
}

// A constant or function named like a storage key (`fooStorageKey`, `FOO_STORAGE_KEY`), or a top level
// arrow function named `<something>Key` that takes a `userId` (the health anchor store's key builders).
const storageKeyDeclaration =
  /^(?:export )?(?:const|function) (\w*(?:StorageKey|_STORAGE_KEY))\b|^const (\w+Key) = \(userId\b/gm;

function declaredStorageKeyNames(): string[] {
  return sourceFilesUnder(libDirectory).flatMap((file) =>
    [...readFileSync(file, "utf8").matchAll(storageKeyDeclaration)].map(
      (match) => match[1] ?? match[2] ?? "",
    ),
  );
}

describe("the device storage map", () => {
  it("should classify every storage key the app declares, so a new key forces a decision", () => {
    const unclassified = declaredStorageKeyNames().filter((name) => !(name in deviceStorage));

    expect(unclassified).toEqual([]);
  });

  it("should not hold an entry for a key the app no longer declares", () => {
    const declared = new Set(declaredStorageKeyNames());

    const stale = Object.keys(deviceStorage).filter((name) => !declared.has(name));

    expect(stale).toEqual([]);
  });

  it("should find the keys it is meant to guard, so the scan itself cannot go quiet", () => {
    expect(declaredStorageKeyNames()).toEqual(
      expect.arrayContaining([
        "themeStorageKey",
        "notifiedBadgesStorageKey",
        "anchorKey",
        "DIARY_CACHE_STORAGE_KEY",
        "SIGNED_OUT_STORAGE_KEY",
        "authStorageKey",
      ]),
    );
  });

  it.each([
    ["themeStorageKey", "removedOnDeletion"],
    ["weightChartViewStorageKey", "removedOnDeletion"],
    ["compositionUnitStorageKey", "removedOnDeletion"],
    ["dashboardBodyChartStorageKey", "removedOnDeletion"],
    ["bodyMapRendererStorageKey", "removedOnDeletion"],
    ["bodyMapViewStorageKey", "removedOnDeletion"],
    ["bodyMapHintStorageKey", "removedOnDeletion"],
    ["formMediaPreferenceStorageKey", "removedOnDeletion"],
    ["suggestionsPreferenceStorageKey", "removedOnDeletion"],
    ["suggestionDismissedStorageKey", "removedOnDeletion"],
    ["checkinSeenStorageKey", "removedOnDeletion"],
    ["bodyFigureStorageKey", "removedOnDeletion"],
    ["reminderSettingsStorageKey", "removedOnDeletion"],
    ["recoveryRequestStorageKey", "removedOnDeletion"],
    ["notifiedBadgesStorageKey", "removedOnDeletion"],
    ["anchorKey", "removedOnDeletion"],
    ["bodyAnchorKey", "removedOnDeletion"],
    ["lastImportKey", "removedOnDeletion"],
    ["authStorageKey", "removedOnSignOut"],
    ["DIARY_CACHE_STORAGE_KEY", "removedOnSignOut"],
    ["SNAPSHOT_STORAGE_KEY", "removedOnSignOut"],
    ["PENDING_UNDO_STORAGE_KEY", "removedOnSignOut"],
    ["scheduledRemindersStorageKey", "removedOnSignOut"],
    ["fatalRestartStorageKey", "appPlumbing"],
    ["lastSeenUpdateIdStorageKey", "appPlumbing"],
    ["SIGNED_OUT_STORAGE_KEY", "appPlumbing"],
    ["pendingAccountDeletionStorageKey", "appPlumbing"],
  ])("should file %s as %s", (name, expectedClass) => {
    expect(deviceStorage[name]?.class).toBe(expectedClass);
  });
});
