import { KeyLowProvider, deleteMyAccount } from "@keylow/api-client";
import { createClient } from "@supabase/supabase-js";
import { onlineManager } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react-native";

import { takeAccountDeletedNotice } from "../../lib/accountDeletion/accountDeletedNotice";
import { useDeleteAccountOnDevice } from "../../lib/accountDeletion/useDeleteAccountOnDevice";
import { resetAsyncStorageFake } from "../support/asyncStorageFake";
import { fakeSession } from "../support/supabaseMock";
import { createTestQueryClient } from "../support/termsBackend";

import type { Database } from "@keylow/api-client";
import type { ReactNode } from "react";

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

const client = createClient<Database>("http://localhost:54321", "anon-key", {
  auth: { persistSession: false, autoRefreshToken: false },
});

function wrapper({ children }: { children: ReactNode }) {
  return (
    <KeyLowProvider client={client} queryClient={createTestQueryClient()}>
      {children}
    </KeyLowProvider>
  );
}

describe("useDeleteAccountOnDevice", () => {
  beforeAll(() => {
    jest.spyOn(client.auth, "onAuthStateChange").mockReturnValue({
      data: { subscription: { id: "subscription", callback: jest.fn(), unsubscribe: jest.fn() } },
    });
  });

  beforeEach(() => {
    resetAsyncStorageFake();
    jest.spyOn(client.auth, "getSession").mockReset();
    jest.spyOn(client.auth, "getSession").mockResolvedValue({
      data: { session: fakeSession },
      error: null,
    });
    jest.mocked(deleteMyAccount).mockReset();
    jest.mocked(deleteMyAccount).mockResolvedValue({ deleted: true, confirmedBy: "response" });
  });

  afterEach(() => {
    onlineManager.setOnline(true);
    takeAccountDeletedNotice();
  });

  afterAll(() => {
    jest.restoreAllMocks();
  });

  it("should run at once while offline, instead of waiting for a connection", async () => {
    onlineManager.setOnline(false);
    const { result } = await renderHook(() => useDeleteAccountOnDevice(), { wrapper });

    result.current.mutate();

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
    expect(deleteMyAccount).toHaveBeenCalledTimes(1);
    expect(result.current.data).toEqual({ kind: "deleted" });
  });

  it("should not retry a deletion that threw", async () => {
    const getSession = jest.spyOn(client.auth, "getSession").mockRejectedValue(new Error("no"));
    const queryClient = createTestQueryClient();
    queryClient.setDefaultOptions({ mutations: { retry: 3, retryDelay: 0, gcTime: Infinity } });
    const { result } = await renderHook(() => useDeleteAccountOnDevice(), {
      wrapper: ({ children }) => (
        <KeyLowProvider client={client} queryClient={queryClient}>
          {children}
        </KeyLowProvider>
      ),
    });

    result.current.mutate();

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });
    expect(getSession).toHaveBeenCalledTimes(1);
  });
});
