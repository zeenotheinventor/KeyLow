import {
  hasAccountDeletedNotice,
  takeAccountDeletedNotice,
} from "../../lib/accountDeletion/accountDeletedNotice";
import { finishAccountDeletion } from "../../lib/accountDeletion/finishAccountDeletion";
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
jest.mock(
  "expo-crypto",
  () => jest.requireActual<{ cryptoFake: unknown }>("../support/diaryCacheStoresFake").cryptoFake,
);

const ACCOUNT_ID = "11111111-1111-4111-8111-111111111111";

let log: string[];

function createQueryClient() {
  return {
    cancelQueries: jest.fn(() => {
      log.push("cancelQueries");
      return Promise.resolve();
    }),
    clear: jest.fn(() => {
      log.push("clear");
    }),
  };
}

function createSignOut() {
  return jest.fn(() => {
    log.push(`signOut (notice waiting: ${String(hasAccountDeletedNotice())})`);
    return Promise.resolve();
  });
}

beforeEach(() => {
  resetAsyncStorageFake();
  secureStoreItems.clear();
  log = [];
  const removeItem = asyncStorageFake.default.removeItem;
  jest.spyOn(asyncStorageFake.default, "removeItem").mockImplementation((key) => {
    log.push(`remove ${key}`);
    return removeItem(key);
  });
});

afterEach(() => {
  takeAccountDeletedNotice();
  jest.restoreAllMocks();
});

describe("finishAccountDeletion", () => {
  it("should clear the queries, remove the device data, announce, sign out and clear the marker, in that order", async () => {
    await finishAccountDeletion({
      accountId: ACCOUNT_ID,
      queryClient: createQueryClient(),
      signOut: createSignOut(),
      announce: true,
    });

    const firstRemoval = log.findIndex((entry) => entry.startsWith("remove "));
    const signOutAt = log.indexOf("signOut (notice waiting: true)");
    expect(log.slice(0, 2)).toEqual(["cancelQueries", "clear"]);
    expect(firstRemoval).toBe(2);
    expect(log).toContain("remove kl-theme");
    expect(log).toContain(`remove kl-notified-badges:${ACCOUNT_ID}`);
    expect(log.indexOf("remove keylow.diary-cache")).toBeLessThan(signOutAt);
    expect(log.indexOf("remove kl-theme")).toBeLessThan(signOutAt);
    expect(log.slice(signOutAt)).toEqual([
      "signOut (notice waiting: true)",
      "remove account.deletionPending",
    ]);
  });

  it("should call clear and never resetQueries", async () => {
    const queryClient = { ...createQueryClient(), resetQueries: jest.fn() };

    await finishAccountDeletion({
      accountId: ACCOUNT_ID,
      queryClient,
      signOut: createSignOut(),
      announce: true,
    });

    expect(queryClient.clear).toHaveBeenCalledTimes(1);
    expect(queryClient.resetQueries).not.toHaveBeenCalled();
  });

  it("should remove the stored diary cache itself, whatever the sign out does", async () => {
    asyncStorageItems.set("keylow.diary-cache", "ciphertext");
    secureStoreItems.set("keylow.diary-cache", "key");

    await finishAccountDeletion({
      accountId: ACCOUNT_ID,
      queryClient: createQueryClient(),
      signOut: createSignOut(),
      announce: false,
    });

    expect(asyncStorageItems.has("keylow.diary-cache")).toBe(false);
    expect(secureStoreItems.has("keylow.diary-cache")).toBe(false);
  });

  it("should announce nothing when it is told not to", async () => {
    await finishAccountDeletion({
      accountId: ACCOUNT_ID,
      queryClient: createQueryClient(),
      signOut: createSignOut(),
      announce: false,
    });

    expect(hasAccountDeletedNotice()).toBe(false);
    expect(log).toContain("signOut (notice waiting: false)");
  });

  it("should leave the notice waiting after the sign out", async () => {
    await finishAccountDeletion({
      accountId: ACCOUNT_ID,
      queryClient: createQueryClient(),
      signOut: createSignOut(),
      announce: true,
    });

    expect(hasAccountDeletedNotice()).toBe(true);
  });

  it("should go on to the later steps when the query client throws", async () => {
    const queryClient = {
      cancelQueries: jest.fn(() => Promise.reject(new Error("no"))),
      clear: jest.fn(() => {
        throw new Error("no");
      }),
    };
    const signOut = createSignOut();

    await expect(
      finishAccountDeletion({ accountId: ACCOUNT_ID, queryClient, signOut, announce: true }),
    ).resolves.toBeUndefined();

    expect(signOut).toHaveBeenCalledTimes(1);
    expect(log.at(-1)).toBe("remove account.deletionPending");
  });

  it("should still clear the marker when the sign out throws", async () => {
    await expect(
      finishAccountDeletion({
        accountId: ACCOUNT_ID,
        queryClient: createQueryClient(),
        signOut: () => Promise.reject(new Error("no")),
        announce: true,
      }),
    ).resolves.toBeUndefined();

    expect(log.at(-1)).toBe("remove account.deletionPending");
  });
});
