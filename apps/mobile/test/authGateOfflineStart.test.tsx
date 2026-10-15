import { KeyLowProvider } from "@keylow/api-client";
import { act, cleanup, render, screen, waitFor } from "@testing-library/react-native";
import { Text } from "react-native";

import { AuthGate } from "../components/AuthGate";
import { ThemeProvider } from "../lib/theme";
import { createDiaryQueryClient } from "./support/diaryBackend";
import { resetRouterMock, routerMock } from "./support/expoRouterMock";
import { createStoredUserIdReader } from "../lib/storedSession";
import { STORED_SESSION_KEY, createStoredSessionClient } from "./support/storedSessionClient";

import type { RefreshOutcome } from "./support/storedSessionClient";
import type { QueryClient } from "@tanstack/react-query";

jest.mock(
  "expo-router",
  () => jest.requireActual<{ mockExpoRouter: unknown }>("./support/expoRouterMock").mockExpoRouter,
);
jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: { getItem: () => Promise.resolve(null), setItem: () => Promise.resolve() },
}));

// AuthGate reads the app's client from this module, which the test points at the client it builds.
const mockApp: { client: unknown } = { client: undefined };
jest.mock("../lib/supabase", () => ({
  get supabase() {
    return mockApp.client;
  },
}));

let queryClient: QueryClient;
let stopRefreshing: () => Promise<void> = () => Promise.resolve();

type GateOptions = {
  hasStoredSession: boolean;
  refresh: RefreshOutcome;
  /** Whether the gate is given the reader of the phone's own storage, as the app gives it. */
  readsStorage: boolean;
  /** Where the app is when the gate decides. */
  segments?: string[];
};

async function renderGateOver({
  hasStoredSession,
  refresh,
  readsStorage,
  segments = ["(tabs)", "diary"],
}: GateOptions) {
  const { client, storage } = createStoredSessionClient({ hasStoredSession, refresh });
  mockApp.client = client;
  stopRefreshing = () => client.auth.stopAutoRefresh();
  routerMock.segments = segments;
  queryClient = createDiaryQueryClient();
  const readStoredUserId = createStoredUserIdReader(storage, STORED_SESSION_KEY);

  await render(
    <ThemeProvider fixedPreference="dark">
      <KeyLowProvider client={client} queryClient={queryClient}>
        <AuthGate {...(readsStorage ? { readStoredUserId } : {})}>
          <Text>Protected content</Text>
        </AuthGate>
      </KeyLowProvider>
    </ThemeProvider>,
  );
}

// Supabase tries a refresh it cannot send for about 25 seconds before it answers. Fake timers let a test see
// both what the gate does while it waits and what it does with the answer.
const SUPABASE_GIVES_UP_MS = 40_000;

async function letSupabaseGiveUp() {
  await act(async () => {
    await jest.advanceTimersByTimeAsync(SUPABASE_GIVES_UP_MS);
  });
}

const SIGN_IN = "/(auth)/sign-in";

describe("AuthGate at a start whose stored session has an expired access token", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    resetRouterMock();
  });

  afterEach(async () => {
    await cleanup();
    await stopRefreshing();
    queryClient.clear();
    jest.useRealTimers();
  });

  describe("with no connection", () => {
    it("should treat the person as signed in from the stored session, without waiting for Supabase", async () => {
      // On the sign-in screen a signed in person is sent to the app, which is the earliest sign of the decision.
      await renderGateOver({
        hasStoredSession: true,
        refresh: "network-down",
        readsStorage: true,
        segments: ["(auth)", "sign-in"],
      });

      await waitFor(() => {
        expect(routerMock.replace).toHaveBeenCalledWith("/(tabs)/dashboard");
      });
    });

    it("should treat the person as signed in when Supabase gives up refreshing for lack of a connection", async () => {
      await renderGateOver({
        hasStoredSession: true,
        refresh: "network-down",
        readsStorage: false,
        segments: ["(auth)", "sign-in"],
      });
      expect(routerMock.replace).not.toHaveBeenCalled();

      await letSupabaseGiveUp();

      expect(routerMock.replace).toHaveBeenCalledWith("/(tabs)/dashboard");
    });

    it("should keep the person signed in after Supabase has given up, when the stored session opened the screens first", async () => {
      await renderGateOver({ hasStoredSession: true, refresh: "network-down", readsStorage: true });

      await letSupabaseGiveUp();

      expect(routerMock.replace).not.toHaveBeenCalled();
    });

    it("should send the person to sign-in when no session is stored", async () => {
      await renderGateOver({
        hasStoredSession: false,
        refresh: "network-down",
        readsStorage: true,
      });

      await letSupabaseGiveUp();

      expect(routerMock.replace).toHaveBeenCalledWith(SIGN_IN);
    });
  });

  describe("with a connection", () => {
    it("should refresh the session and keep the person signed in", async () => {
      await renderGateOver({ hasStoredSession: true, refresh: "refreshes", readsStorage: true });

      expect(await screen.findByText("Protected content")).toBeOnTheScreen();
      expect(routerMock.replace).not.toHaveBeenCalledWith(SIGN_IN);
    });

    it("should send the person to sign-in when the server refuses the refresh token, though a session is stored", async () => {
      await renderGateOver({
        hasStoredSession: true,
        refresh: "refresh-token-invalid",
        readsStorage: true,
      });

      await waitFor(() => {
        expect(routerMock.replace).toHaveBeenCalledWith(SIGN_IN);
      });
    });
  });
});
