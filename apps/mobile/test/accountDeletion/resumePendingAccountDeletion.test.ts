import {
  AuthApiError,
  AuthRetryableFetchError,
  AuthSessionMissingError,
} from "@supabase/supabase-js";
import { onlineManager } from "@tanstack/react-query";

import {
  hasAccountDeletedNotice,
  takeAccountDeletedNotice,
} from "../../lib/accountDeletion/accountDeletedNotice";
import {
  isDeletionInFlight,
  trackDeletionInFlight,
} from "../../lib/accountDeletion/deletionInFlight";
import { resumePendingAccountDeletion } from "../../lib/accountDeletion/resumePendingAccountDeletion";
import { signOut } from "../../lib/signOut";
import {
  asyncStorageFake,
  asyncStorageItems,
  resetAsyncStorageFake,
} from "../support/asyncStorageFake";
import { secureStoreItems } from "../support/diaryCacheStoresFake";
import { fakeSession } from "../support/supabaseMock";

import type { ResumePendingAccountDeletionOptions } from "../../lib/accountDeletion/types";
import type { Session, SupabaseClient } from "@supabase/supabase-js";

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
jest.mock("../../lib/signOut", () => ({ signOut: jest.fn(() => Promise.resolve()) }));

const ACCOUNT_ID = "11111111-1111-4111-8111-111111111111";
const OTHER_ACCOUNT_ID = "22222222-2222-4222-8222-222222222222";

type Auth = SupabaseClient["auth"];
type SessionAnswer = Awaited<ReturnType<Auth["getSession"]>>;
type UserAnswer = Awaited<ReturnType<Auth["getUser"]>>;

const sessionOf = (userId: string): Session => ({
  ...fakeSession,
  user: { ...fakeSession.user, id: userId },
});

const answerWithSession = (userId: string): SessionAnswer => ({
  data: { session: sessionOf(userId) },
  error: null,
});
const answerWithNoSession: SessionAnswer = { data: { session: null }, error: null };
const userStillThere: UserAnswer = { data: { user: fakeSession.user }, error: null };
const userNotFound: UserAnswer = {
  data: { user: null },
  error: new AuthApiError("User from sub claim in JWT does not exist", 403, "user_not_found"),
};

function createOptions(
  sessionAnswer: SessionAnswer,
  userAnswer: UserAnswer = userStillThere,
): ResumePendingAccountDeletionOptions & {
  auth: { getSession: jest.Mock; getUser: jest.Mock };
} {
  const auth = {
    getSession: jest.fn(() => Promise.resolve(sessionAnswer)),
    getUser: jest.fn(() => Promise.resolve(userAnswer)),
  };
  return {
    client: { auth },
    auth,
    queryClient: { cancelQueries: jest.fn(() => Promise.resolve()), clear: jest.fn() },
  };
}

function markPending(accountId: string = ACCOUNT_ID) {
  asyncStorageItems.set("account.deletionPending", accountId);
}

const storedThemeIsKept = () => asyncStorageItems.get("kl-theme") === "dark";

beforeEach(() => {
  resetAsyncStorageFake();
  secureStoreItems.clear();
  asyncStorageItems.set("kl-theme", "dark");
  jest.mocked(signOut).mockClear();
  onlineManager.setOnline(true);
});

afterEach(() => {
  jest.restoreAllMocks();
  takeAccountDeletedNotice();
});

describe("resumePendingAccountDeletion", () => {
  it("should do nothing without a marker", async () => {
    const options = createOptions(answerWithSession(ACCOUNT_ID), userNotFound);

    await resumePendingAccountDeletion(options);

    expect(options.auth.getSession).not.toHaveBeenCalled();
    expect(storedThemeIsKept()).toBe(true);
  });

  it("should keep the marker, remove nothing and send nothing while offline", async () => {
    markPending();
    onlineManager.setOnline(false);
    const options = createOptions(answerWithSession(ACCOUNT_ID), userNotFound);

    await resumePendingAccountDeletion(options);

    expect(options.auth.getSession).not.toHaveBeenCalled();
    expect(options.auth.getUser).not.toHaveBeenCalled();
    expect(asyncStorageItems.get("account.deletionPending")).toBe(ACCOUNT_ID);
    expect(storedThemeIsKept()).toBe(true);
    expect(signOut).not.toHaveBeenCalled();
  });

  it("should keep the marker and remove nothing when the session cannot be read for want of a connection", async () => {
    markPending();
    const options = createOptions({
      data: { session: null },
      error: new AuthRetryableFetchError("fetch failed", 0),
    });

    await resumePendingAccountDeletion(options);

    expect(asyncStorageItems.get("account.deletionPending")).toBe(ACCOUNT_ID);
    expect(storedThemeIsKept()).toBe(true);
    expect(signOut).not.toHaveBeenCalled();
  });

  it("should clear the marker and do nothing else when the account is still there", async () => {
    markPending();
    const options = createOptions(answerWithSession(ACCOUNT_ID), userStillThere);

    await resumePendingAccountDeletion(options);

    expect(options.auth.getUser).toHaveBeenCalledWith("access-token");
    expect(asyncStorageItems.has("account.deletionPending")).toBe(false);
    expect(storedThemeIsKept()).toBe(true);
    expect(signOut).not.toHaveBeenCalled();
    expect(hasAccountDeletedNotice()).toBe(false);
  });

  it("should finish the clean-up and announce when the app was killed after the server deleted the account", async () => {
    markPending();
    const options = createOptions(answerWithSession(ACCOUNT_ID), userNotFound);

    await resumePendingAccountDeletion(options);

    expect(storedThemeIsKept()).toBe(false);
    expect(asyncStorageItems.has("account.deletionPending")).toBe(false);
    expect(signOut).toHaveBeenCalledTimes(1);
    expect(options.queryClient.clear).toHaveBeenCalledTimes(1);
    expect(hasAccountDeletedNotice()).toBe(true);
  });

  it("should keep the marker and touch nothing when the check cannot say", async () => {
    markPending();
    const options = createOptions(answerWithSession(ACCOUNT_ID), {
      data: { user: null },
      error: new AuthRetryableFetchError("fetch failed", 0),
    });

    await resumePendingAccountDeletion(options);

    expect(asyncStorageItems.get("account.deletionPending")).toBe(ACCOUNT_ID);
    expect(storedThemeIsKept()).toBe(true);
    expect(signOut).not.toHaveBeenCalled();
    expect(hasAccountDeletedNotice()).toBe(false);
  });

  it("should finish the clean-up without announcing when there is no session, because that proves nothing", async () => {
    markPending();
    const options = createOptions(answerWithNoSession);

    await resumePendingAccountDeletion(options);

    expect(storedThemeIsKept()).toBe(false);
    expect(asyncStorageItems.has("account.deletionPending")).toBe(false);
    expect(signOut).toHaveBeenCalledTimes(1);
    expect(hasAccountDeletedNotice()).toBe(false);
  });

  it("should finish the clean-up without announcing when the refresh was refused", async () => {
    markPending();
    const options = createOptions({
      data: { session: null },
      error: new AuthApiError(
        "Invalid Refresh Token: Refresh Token Not Found",
        400,
        "refresh_token_not_found",
      ),
    });

    await resumePendingAccountDeletion(options);

    expect(storedThemeIsKept()).toBe(false);
    expect(asyncStorageItems.has("account.deletionPending")).toBe(false);
    expect(hasAccountDeletedNotice()).toBe(false);
  });

  it("should finish the clean-up without announcing when the check finds the session already signed out", async () => {
    markPending();
    const options = createOptions(answerWithSession(ACCOUNT_ID), {
      data: { user: null },
      error: new AuthSessionMissingError(),
    });
    // auth-js removes the stored session and sends SIGNED_OUT on its own here, which runs the runner again.
    options.auth.getUser.mockImplementationOnce(() => {
      options.auth.getSession.mockResolvedValue(answerWithNoSession);
      void resumePendingAccountDeletion(options);
      return Promise.resolve({ data: { user: null }, error: new AuthSessionMissingError() });
    });

    await resumePendingAccountDeletion(options);

    expect(storedThemeIsKept()).toBe(false);
    expect(asyncStorageItems.has("account.deletionPending")).toBe(false);
    expect(hasAccountDeletedNotice()).toBe(false);
  });

  it("should remove only what is stored under the marked account's id, and leave the signed in person's settings and session", async () => {
    markPending(OTHER_ACCOUNT_ID);
    for (const key of [
      "kl-theme",
      "weight.chartView",
      "bodyMap.view",
      "kl-reminders",
      "program.checkinSeen",
      "train.suggestionDismissed",
      "bodyMap.figure",
      "auth.recoveryRequestedAt",
      `kl-notified-badges:${ACCOUNT_ID}`,
    ]) {
      asyncStorageItems.set(key, "stored");
    }
    asyncStorageItems.set(`kl-notified-badges:${OTHER_ACCOUNT_ID}`, '["badge-a"]');
    secureStoreItems.set(`health-import-anchor.${OTHER_ACCOUNT_ID}`, "anchor");
    secureStoreItems.set(`health-import-last.${OTHER_ACCOUNT_ID}`, "last");
    secureStoreItems.set(`health-import-anchor.${ACCOUNT_ID}`, "anchor");
    const options = createOptions(answerWithSession(ACCOUNT_ID), userNotFound);

    await resumePendingAccountDeletion(options);

    expect(asyncStorageItems.has(`kl-notified-badges:${OTHER_ACCOUNT_ID}`)).toBe(false);
    expect(secureStoreItems.has(`health-import-anchor.${OTHER_ACCOUNT_ID}`)).toBe(false);
    expect(secureStoreItems.has(`health-import-last.${OTHER_ACCOUNT_ID}`)).toBe(false);
    expect([...asyncStorageItems.keys()].sort()).toEqual(
      [
        "kl-theme",
        "weight.chartView",
        "bodyMap.view",
        "kl-reminders",
        "program.checkinSeen",
        "train.suggestionDismissed",
        "bodyMap.figure",
        "auth.recoveryRequestedAt",
        `kl-notified-badges:${ACCOUNT_ID}`,
      ].sort(),
    );
    expect([...secureStoreItems.keys()]).toEqual([`health-import-anchor.${ACCOUNT_ID}`]);
    expect(options.auth.getUser).not.toHaveBeenCalled();
    expect(options.queryClient.clear).not.toHaveBeenCalled();
    expect(signOut).not.toHaveBeenCalled();
    expect(hasAccountDeletedNotice()).toBe(false);
  });

  it("should keep a marker that a deletion of this app's own wrote while it removed the other account's data", async () => {
    markPending(OTHER_ACCOUNT_ID);
    asyncStorageItems.set(`kl-notified-badges:${OTHER_ACCOUNT_ID}`, '["badge-a"]');
    let wasInFlight = false;
    const removeItem = asyncStorageFake.default.removeItem;
    jest.spyOn(asyncStorageFake.default, "removeItem").mockImplementationOnce((key) => {
      wasInFlight = isDeletionInFlight();
      asyncStorageItems.set("account.deletionPending", ACCOUNT_ID);
      return removeItem(key);
    });
    const options = createOptions(answerWithSession(ACCOUNT_ID), userNotFound);

    await resumePendingAccountDeletion(options);

    expect(wasInFlight).toBe(true);
    expect(asyncStorageItems.get("account.deletionPending")).toBe(ACCOUNT_ID);
  });

  it("should not announce an answer that was asked before this app's own deletion and came after it finished", async () => {
    markPending();
    const options = createOptions(answerWithSession(ACCOUNT_ID), userNotFound);
    // The deletion of this app's own finishes while the check is out: it has announced and cleared the marker.
    options.auth.getUser.mockImplementationOnce(() => {
      asyncStorageItems.delete("account.deletionPending");
      return Promise.resolve(userNotFound);
    });

    await resumePendingAccountDeletion(options);

    expect(signOut).not.toHaveBeenCalled();
    expect(hasAccountDeletedNotice()).toBe(false);
  });

  it("should neither announce nor clear the marker while this app's deletion call is in flight", async () => {
    markPending();
    const options = createOptions(answerWithNoSession);
    let finishCall: (() => void) | undefined;
    const call = trackDeletionInFlight(
      () =>
        new Promise<void>((resolve) => {
          finishCall = resolve;
        }),
    );

    await resumePendingAccountDeletion(options);
    finishCall?.();
    await call;

    expect(options.auth.getSession).not.toHaveBeenCalled();
    expect(asyncStorageItems.get("account.deletionPending")).toBe(ACCOUNT_ID);
    expect(storedThemeIsKept()).toBe(true);
    expect(signOut).not.toHaveBeenCalled();
    expect(hasAccountDeletedNotice()).toBe(false);
  });
});
