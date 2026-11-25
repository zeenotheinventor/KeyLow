import { forgetNotifiedBadges, rememberNotifiedIds } from "../../lib/achievements/notifiedBadges";
import {
  clearHealthImportState,
  setAnchor,
  setBodyAnchor,
  setLastImport,
} from "../../lib/health/healthAnchorStore";
import { asyncStorageItems, resetAsyncStorageFake } from "../support/asyncStorageFake";
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

beforeEach(() => {
  resetAsyncStorageFake();
  secureStoreItems.clear();
});

describe("forgetNotifiedBadges", () => {
  it("should remove the account's saved badge ids and leave another account's", async () => {
    await rememberNotifiedIds(OWNER, ["badge-a"]);
    await rememberNotifiedIds(OTHER, ["badge-b"]);

    await forgetNotifiedBadges(OWNER);

    expect([...asyncStorageItems.keys()]).toEqual([`kl-notified-badges:${OTHER}`]);
  });

  it("should not bring the ids back when a write was already waiting in the queue", async () => {
    const write = rememberNotifiedIds(OWNER, ["badge-a"]);

    await forgetNotifiedBadges(OWNER);
    await write;

    expect([...asyncStorageItems.keys()]).toEqual([]);
  });

  it("should resolve when the store cannot remove the key", async () => {
    await rememberNotifiedIds(OWNER, ["badge-a"]);
    const failure = jest
      .spyOn(
        jest.requireMock<{ default: { removeItem: () => Promise<void> } }>(
          "@react-native-async-storage/async-storage",
        ).default,
        "removeItem",
      )
      .mockRejectedValueOnce(new Error("storage is down"));

    await expect(forgetNotifiedBadges(OWNER)).resolves.toBeUndefined();
    failure.mockRestore();
  });
});

describe("clearHealthImportState", () => {
  it("should remove the three anchors and the last import of the user and keep another user's", async () => {
    await setAnchor(OWNER, "2026-10-03T07:30:00.000Z");
    await setBodyAnchor(OWNER, "body_fat_pct", "2026-10-03T07:30:00.000Z");
    await setBodyAnchor(OWNER, "lean_mass_kg", "2026-10-03T07:30:00.000Z");
    await setLastImport(OWNER, "2026-10-03T08:00:00.000Z");
    await setAnchor(OTHER, "2026-10-04T07:30:00.000Z");

    await clearHealthImportState(OWNER);

    expect([...secureStoreItems.keys()]).toEqual([`health-import-anchor.${OTHER}`]);
  });
});
