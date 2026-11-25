import {
  removeAccountDeviceData,
  removeAccountKeyedData,
} from "../../lib/accountDeletion/removeAccountDeviceData";
import {
  asyncStorageFake,
  asyncStorageItems,
  resetAsyncStorageFake,
} from "../support/asyncStorageFake";
import { secureStoreItems } from "../support/diaryCacheStoresFake";

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

const OWNER = "11111111-1111-4111-8111-111111111111";
const OTHER = "22222222-2222-4222-8222-222222222222";

// Every key a deletion removes, written out: a key renamed in the app must be renamed here on purpose.
const removedAsyncStorageKeys = [
  "kl-theme",
  "weight.chartView",
  "weight.compositionUnit",
  "dashboard.bodyChart",
  "bodyMap.renderer",
  "bodyMap.view",
  "bodyMap.hintSeen",
  "exerciseForm.mediaPreference",
  "train.suggestionsEnabled",
  "train.suggestionDismissed",
  "program.checkinSeen",
  "bodyMap.figure",
  "kl-reminders",
  "auth.recoveryRequestedAt",
  `kl-notified-badges:${OWNER}`,
];
const removedSecureStoreKeys = [
  `health-import-anchor.${OWNER}`,
  `health-import-anchor.${OWNER}.body_fat_pct`,
  `health-import-anchor.${OWNER}.lean_mass_kg`,
  `health-import-last.${OWNER}`,
];
const keptAsyncStorageKeys = [
  "sentry.fatalRestartTimes",
  "updates.lastSeenId",
  "keylow.widgets.signedOut",
  "account.deletionPending",
  `kl-notified-badges:${OTHER}`,
];
const keptSecureStoreKeys = [`health-import-anchor.${OTHER}`, `health-import-last.${OTHER}`];

function fillStores() {
  for (const key of [...removedAsyncStorageKeys, ...keptAsyncStorageKeys]) {
    asyncStorageItems.set(key, "stored");
  }
  for (const key of [...removedSecureStoreKeys, ...keptSecureStoreKeys]) {
    secureStoreItems.set(key, "stored");
  }
}

describe("removeAccountDeviceData", () => {
  beforeEach(() => {
    resetAsyncStorageFake();
    secureStoreItems.clear();
    fillStores();
  });

  it("should remove every key of the account and of the device settings", async () => {
    await removeAccountDeviceData(OWNER);

    expect(removedAsyncStorageKeys.filter((key) => asyncStorageItems.has(key))).toEqual([]);
    expect(removedSecureStoreKeys.filter((key) => secureStoreItems.has(key))).toEqual([]);
  });

  it("should keep the app plumbing, the pending marker and another account's keys", async () => {
    await removeAccountDeviceData(OWNER);

    expect(keptAsyncStorageKeys.filter((key) => !asyncStorageItems.has(key))).toEqual([]);
    expect(keptSecureStoreKeys.filter((key) => !secureStoreItems.has(key))).toEqual([]);
  });

  it("should leave the other keys removed when one removal throws, and still resolve", async () => {
    jest.spyOn(asyncStorageFake.default, "removeItem").mockImplementationOnce(() => {
      throw new Error("storage is down");
    });

    await expect(removeAccountDeviceData(OWNER)).resolves.toBeUndefined();

    expect(removedAsyncStorageKeys.filter((key) => asyncStorageItems.has(key))).toHaveLength(1);
    expect(removedSecureStoreKeys.filter((key) => secureStoreItems.has(key))).toEqual([]);
  });
});

describe("removeAccountKeyedData", () => {
  beforeEach(() => {
    resetAsyncStorageFake();
    secureStoreItems.clear();
    fillStores();
  });

  it("should remove only the badges and the health import state stored under the account's id", async () => {
    await removeAccountKeyedData(OWNER);

    expect(asyncStorageItems.has(`kl-notified-badges:${OWNER}`)).toBe(false);
    expect(removedSecureStoreKeys.filter((key) => secureStoreItems.has(key))).toEqual([]);
  });

  it("should keep every setting, every item that is not keyed by an id and another account's items", async () => {
    await removeAccountKeyedData(OWNER);

    const keptAfterwards = [
      ...removedAsyncStorageKeys.filter((key) => key !== `kl-notified-badges:${OWNER}`),
      ...keptAsyncStorageKeys,
    ];
    expect(keptAfterwards.filter((key) => !asyncStorageItems.has(key))).toEqual([]);
    expect(keptSecureStoreKeys.filter((key) => !secureStoreItems.has(key))).toEqual([]);
  });
});
