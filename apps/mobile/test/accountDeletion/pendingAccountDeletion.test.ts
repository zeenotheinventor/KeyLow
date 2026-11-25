import {
  clearPendingAccountDeletion,
  markAccountDeletionPending,
  readPendingAccountDeletion,
} from "../../lib/accountDeletion/pendingAccountDeletion";
import {
  asyncStorageFake,
  asyncStorageItems,
  resetAsyncStorageFake,
} from "../support/asyncStorageFake";

jest.mock(
  "@react-native-async-storage/async-storage",
  () =>
    jest.requireActual<typeof import("../support/asyncStorageFake")>("../support/asyncStorageFake")
      .asyncStorageFake,
);

const ACCOUNT_ID = "11111111-1111-4111-8111-111111111111";

describe("the pending account deletion marker", () => {
  beforeEach(() => {
    resetAsyncStorageFake();
  });

  it("should hold the account id and nothing else under account.deletionPending", async () => {
    await markAccountDeletionPending(ACCOUNT_ID);

    expect([...asyncStorageItems]).toEqual([["account.deletionPending", ACCOUNT_ID]]);
    expect(await readPendingAccountDeletion()).toBe(ACCOUNT_ID);
  });

  it("should read as null when nothing is stored", async () => {
    expect(await readPendingAccountDeletion()).toBeNull();
  });

  it("should read as null when the stored value is not a uuid", async () => {
    asyncStorageItems.set("account.deletionPending", "not-an-id");

    expect(await readPendingAccountDeletion()).toBeNull();
  });

  it("should be removed by clearing it", async () => {
    await markAccountDeletionPending(ACCOUNT_ID);

    await clearPendingAccountDeletion();

    expect(await readPendingAccountDeletion()).toBeNull();
  });

  it("should swallow a store that throws, on every call", async () => {
    const failure = () => Promise.reject(new Error("storage is down"));
    jest.spyOn(asyncStorageFake.default, "getItem").mockImplementationOnce(failure);
    jest.spyOn(asyncStorageFake.default, "setItem").mockImplementationOnce(failure);
    jest.spyOn(asyncStorageFake.default, "removeItem").mockImplementationOnce(failure);

    expect(await readPendingAccountDeletion()).toBeNull();
    await expect(markAccountDeletionPending(ACCOUNT_ID)).resolves.toBeUndefined();
    await expect(clearPendingAccountDeletion()).resolves.toBeUndefined();
  });
});
