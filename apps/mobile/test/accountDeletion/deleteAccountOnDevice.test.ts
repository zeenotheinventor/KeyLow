import { AccountDeletionError, deleteMyAccount } from "@keylow/api-client";
import { createClient } from "@supabase/supabase-js";

import {
  hasAccountDeletedNotice,
  subscribeToAccountDeletedNotice,
  takeAccountDeletedNotice,
} from "../../lib/accountDeletion/accountDeletedNotice";
import { deleteAccountOnDevice } from "../../lib/accountDeletion/deleteAccountOnDevice";
import { isDeletionInFlight } from "../../lib/accountDeletion/deletionInFlight";
import { signOut } from "../../lib/signOut";
import {
  asyncStorageFake,
  asyncStorageItems,
  resetAsyncStorageFake,
} from "../support/asyncStorageFake";
import { secureStoreItems } from "../support/diaryCacheStoresFake";
import { fakeSession } from "../support/supabaseMock";

import type { DeleteAccountOnDeviceOptions } from "../../lib/accountDeletion/types";
import type { AccountDeletionResult, Database } from "@keylow/api-client";

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
jest.mock("@keylow/api-client", () => ({
  ...jest.requireActual<object>("@keylow/api-client"),
  deleteMyAccount: jest.fn(),
}));
jest.mock("../../lib/signOut", () => ({ signOut: jest.fn(() => Promise.resolve()) }));

const ACCOUNT_ID = "11111111-1111-4111-8111-111111111111";

const deleteAccount = jest.mocked(deleteMyAccount);
const confirmed = (confirmedBy: AccountDeletionResult["confirmedBy"]): AccountDeletionResult => ({
  deleted: true,
  confirmedBy,
});

function createTestClient(userId: string | null = ACCOUNT_ID) {
  const client = createClient<Database>("http://localhost:54321", "anon-key", {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  jest.spyOn(client.auth, "getSession").mockResolvedValue(
    userId === null
      ? { data: { session: null }, error: null }
      : {
          data: { session: { ...fakeSession, user: { ...fakeSession.user, id: userId } } },
          error: null,
        },
  );
  return client;
}

function createOptions(userId: string | null = ACCOUNT_ID): DeleteAccountOnDeviceOptions {
  return {
    client: createTestClient(userId),
    queryClient: { cancelQueries: jest.fn(() => Promise.resolve()), clear: jest.fn() },
  };
}

beforeEach(() => {
  resetAsyncStorageFake();
  secureStoreItems.clear();
  jest.mocked(signOut).mockClear();
  deleteAccount.mockReset();
  deleteAccount.mockResolvedValue(confirmed("response"));
});

afterEach(() => {
  jest.restoreAllMocks();
  takeAccountDeletedNotice();
});

describe("deleteAccountOnDevice", () => {
  it.each(["response", "check"] as const)(
    "should finish the clean-up and resolve deleted when the deletion is confirmed by the %s",
    async (confirmedBy) => {
      asyncStorageItems.set("kl-theme", "dark");
      deleteAccount.mockResolvedValue(confirmed(confirmedBy));
      const options = createOptions();

      const result = await deleteAccountOnDevice(options);

      expect(result).toEqual({ kind: "deleted" });
      expect(asyncStorageItems.has("kl-theme")).toBe(false);
      expect(asyncStorageItems.has("account.deletionPending")).toBe(false);
      expect(hasAccountDeletedNotice()).toBe(true);
      expect(signOut).toHaveBeenCalledTimes(1);
      expect(options.queryClient.clear).toHaveBeenCalledTimes(1);
    },
  );

  it("should write the marker before it sends the deletion", async () => {
    let markerWhenSent: string | undefined;
    deleteAccount.mockImplementation(() => {
      markerWhenSent = asyncStorageItems.get("account.deletionPending");
      return Promise.resolve(confirmed("response"));
    });

    await deleteAccountOnDevice(createOptions());

    expect(markerWhenSent).toBe(ACCOUNT_ID);
  });

  it("should keep the marker, touch nothing and resolve unconfirmed when the phone cannot tell", async () => {
    asyncStorageItems.set("kl-theme", "dark");
    deleteAccount.mockRejectedValue(new AccountDeletionError("unconfirmed"));
    const options = createOptions();

    const result = await deleteAccountOnDevice(options);

    expect(result).toEqual({ kind: "unconfirmed" });
    expect(asyncStorageItems.get("account.deletionPending")).toBe(ACCOUNT_ID);
    expect(asyncStorageItems.get("kl-theme")).toBe("dark");
    expect(signOut).not.toHaveBeenCalled();
    expect(options.queryClient.clear).not.toHaveBeenCalled();
    expect(hasAccountDeletedNotice()).toBe(false);
  });

  it.each(["rate_limited", "invalid_request", "internal_error", "unauthorized", "failed"] as const)(
    "should clear the marker, touch nothing and resolve notDeleted with %s when the server answered",
    async (code) => {
      asyncStorageItems.set("kl-theme", "dark");
      deleteAccount.mockRejectedValue(new AccountDeletionError(code));

      const result = await deleteAccountOnDevice(createOptions());

      expect(result).toEqual({ kind: "notDeleted", code });
      expect(asyncStorageItems.has("account.deletionPending")).toBe(false);
      expect(asyncStorageItems.get("kl-theme")).toBe("dark");
      expect(signOut).not.toHaveBeenCalled();
      expect(hasAccountDeletedNotice()).toBe(false);
    },
  );

  it("should keep the marker and resolve unconfirmed when the failure is not the deletion's own", async () => {
    deleteAccount.mockRejectedValue(new Error("something else"));

    const result = await deleteAccountOnDevice(createOptions());

    expect(result).toEqual({ kind: "unconfirmed" });
    expect(asyncStorageItems.get("account.deletionPending")).toBe(ACCOUNT_ID);
  });

  it("should send nothing and resolve notDeleted unauthorized when there is no session and no marker", async () => {
    const result = await deleteAccountOnDevice(createOptions(null));

    expect(result).toEqual({ kind: "notDeleted", code: "unauthorized" });
    expect(deleteAccount).not.toHaveBeenCalled();
    expect(asyncStorageItems.has("account.deletionPending")).toBe(false);
  });

  it("should send nothing, keep the marker and resolve unconfirmed on a retry with no session", async () => {
    asyncStorageItems.set("account.deletionPending", ACCOUNT_ID);

    const result = await deleteAccountOnDevice(createOptions(null));

    expect(result).toEqual({ kind: "unconfirmed" });
    expect(deleteAccount).not.toHaveBeenCalled();
    expect(asyncStorageItems.get("account.deletionPending")).toBe(ACCOUNT_ID);
  });

  it("should count as in flight while the deletion is waiting for the server, and not after", async () => {
    let finish: (() => void) | undefined;
    let wasInFlight = false;
    deleteAccount.mockImplementation(
      () =>
        new Promise((resolve) => {
          wasInFlight = isDeletionInFlight();
          finish = () => {
            resolve(confirmed("response"));
          };
        }),
    );

    const pending = deleteAccountOnDevice(createOptions());
    await new Promise((resolve) => setImmediate(resolve));
    expect(wasInFlight).toBe(true);
    finish?.();
    await pending;

    expect(isDeletionInFlight()).toBe(false);
  });

  it("should not count as in flight after a failure", async () => {
    deleteAccount.mockRejectedValue(new AccountDeletionError("unconfirmed"));

    await deleteAccountOnDevice(createOptions());

    expect(isDeletionInFlight()).toBe(false);
  });

  it("should be one deletion when two calls overlap: one marker, one request, one clean-up, one announcement", async () => {
    const options = createOptions();
    const announcements = jest.fn();
    const stopListening = subscribeToAccountDeletedNotice(announcements);
    const setItem = jest.spyOn(asyncStorageFake.default, "setItem");

    const first = deleteAccountOnDevice(options);
    const second = deleteAccountOnDevice(options);
    const results = await Promise.all([first, second]);

    stopListening();
    expect(results).toEqual([{ kind: "deleted" }, { kind: "deleted" }]);
    expect(second).toBe(first);
    expect(deleteAccount).toHaveBeenCalledTimes(1);
    expect(setItem.mock.calls.filter(([key]) => key === "account.deletionPending")).toHaveLength(1);
    expect(signOut).toHaveBeenCalledTimes(1);
    expect(options.queryClient.clear).toHaveBeenCalledTimes(1);
    expect(announcements).toHaveBeenCalledTimes(1);
  });

  it("should take a new call once the open one has settled", async () => {
    await deleteAccountOnDevice(createOptions());
    await deleteAccountOnDevice(createOptions());

    expect(deleteAccount).toHaveBeenCalledTimes(2);
  });
});
