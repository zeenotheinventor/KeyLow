import { KeyLowProvider } from "@keylow/api-client";
import { createClient } from "@supabase/supabase-js";
import { QueryClient, onlineManager } from "@tanstack/react-query";
import { cleanup, render, waitFor } from "@testing-library/react-native";
import { AppState } from "react-native";

import { PendingAccountDeletion } from "../../components/PendingAccountDeletion";
import { trackDeletionInFlight } from "../../lib/accountDeletion/deletionInFlight";
import { asyncStorageItems, resetAsyncStorageFake } from "../support/asyncStorageFake";

import type { Database } from "@keylow/api-client";
import type { AuthChangeEvent, Session } from "@supabase/supabase-js";
import type { AppStateStatus } from "react-native";

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

const client = createClient<Database>("http://localhost:54321", "anon-key", {
  auth: { persistSession: false, autoRefreshToken: false },
});
let getSession: jest.SpyInstance;
let appStateListener: ((appState: AppStateStatus) => void) | undefined;
// The provider listens too, so every listener is kept.
const authListeners: ((event: AuthChangeEvent, session: Session | null) => void | Promise<void>)[] =
  [];

async function renderRunner() {
  await render(
    <KeyLowProvider client={client} queryClient={new QueryClient()}>
      <PendingAccountDeletion />
    </KeyLowProvider>,
  );
}

const markerIsGone = () => !asyncStorageItems.has("account.deletionPending");

beforeAll(() => {
  jest.spyOn(AppState, "addEventListener").mockImplementation((_type, listener) => {
    appStateListener = listener;
    return { remove: jest.fn() };
  });
  getSession = jest
    .spyOn(client.auth, "getSession")
    .mockResolvedValue({ data: { session: null }, error: null });
  jest.spyOn(client.auth, "onAuthStateChange").mockImplementation((listener) => {
    authListeners.push(listener);
    return {
      data: {
        subscription: { id: "subscription", callback: () => undefined, unsubscribe: jest.fn() },
      },
    };
  });
});

afterAll(() => {
  jest.restoreAllMocks();
});

beforeEach(() => {
  resetAsyncStorageFake();
  onlineManager.setOnline(true);
  authListeners.length = 0;
  appStateListener = undefined;
});

afterEach(async () => {
  await cleanup();
});

describe("PendingAccountDeletion", () => {
  it("should run at start", async () => {
    asyncStorageItems.set("account.deletionPending", ACCOUNT_ID);

    await renderRunner();

    await waitFor(() => {
      expect(markerIsGone()).toBe(true);
    });
  });

  it("should run when the app comes to the foreground", async () => {
    await renderRunner();
    asyncStorageItems.set("account.deletionPending", ACCOUNT_ID);

    appStateListener?.("active");

    await waitFor(() => {
      expect(markerIsGone()).toBe(true);
    });
  });

  it("should run when the connection returns", async () => {
    onlineManager.setOnline(false);
    asyncStorageItems.set("account.deletionPending", ACCOUNT_ID);
    await renderRunner();
    expect(markerIsGone()).toBe(false);

    onlineManager.setOnline(true);

    await waitFor(() => {
      expect(markerIsGone()).toBe(true);
    });
  });

  it("should run when the session ends", async () => {
    await renderRunner();
    asyncStorageItems.set("account.deletionPending", ACCOUNT_ID);

    authListeners.forEach((listener) => {
      void listener("SIGNED_OUT", null);
    });

    await waitFor(() => {
      expect(markerIsGone()).toBe(true);
    });
  });

  it("should not run for an event that is not a sign out", async () => {
    await renderRunner();
    asyncStorageItems.set("account.deletionPending", ACCOUNT_ID);

    authListeners.forEach((listener) => {
      void listener("TOKEN_REFRESHED", null);
    });
    await new Promise((resolve) => setTimeout(resolve, 20));

    expect(markerIsGone()).toBe(false);
  });

  it("should ignore a sign out while this app's own deletion clean-up is running", async () => {
    await renderRunner();
    asyncStorageItems.set("account.deletionPending", ACCOUNT_ID);
    let finishCall: (() => void) | undefined;
    const call = trackDeletionInFlight(
      () =>
        new Promise<void>((resolve) => {
          finishCall = resolve;
        }),
    );
    const readsBefore = getSession.mock.calls.length;

    authListeners.forEach((listener) => {
      void listener("SIGNED_OUT", null);
    });
    // The clean-up ends before a deferred run would start, so only the handler itself can have ignored it.
    finishCall?.();
    await call;
    await new Promise((resolve) => setTimeout(resolve, 20));

    expect(getSession.mock.calls.length).toBe(readsBefore);
    expect(markerIsGone()).toBe(false);
  });
});
