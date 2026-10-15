import { KeyLowProvider, keys } from "@keylow/api-client";
import { ACCEPT_TERMS_SCREEN } from "@keylow/core/copy";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { hashKey, onlineManager } from "@tanstack/react-query";
import { act, cleanup, render, screen, fireEvent, waitFor } from "@testing-library/react-native";

import { AuthGate } from "../components/AuthGate";
import { DiaryScreen } from "../components/DiaryScreen";
import { PersistedDiaryCache } from "../components/PersistedDiaryCache";
import { SignOutButton } from "../components/SignOutButton";
import { parseStoredCache } from "../lib/diaryCache";
import { DIARY_CACHE_STORAGE_KEY } from "../lib/diaryCache/constants";
import { createStoredUserIdReader } from "../lib/storedSession";
import { ThemeProvider } from "../lib/theme";
import {
  createDiaryQueryClient,
  diaryBackend,
  diaryClient,
  resetDiaryBackend,
  sampleDay,
  signInDiaryClient,
} from "./support/diaryBackend";
import { resetRouterMock, routerMock } from "./support/expoRouterMock";
import { compileKitStyles } from "./support/kitStyles";
import { registerAppStyles } from "./support/nativeWindStyles";
import { STORED_SESSION_KEY, createStoredSessionClient } from "./support/storedSessionClient";

import type { QueryClient } from "@tanstack/react-query";

jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: jest.requireActual<object>(
    "@react-native-async-storage/async-storage/jest/async-storage-mock",
  ),
}));
jest.mock(
  "expo-router",
  () => jest.requireActual<{ mockExpoRouter: unknown }>("./support/expoRouterMock").mockExpoRouter,
);
jest.mock(
  "react-native-safe-area-context",
  () =>
    jest.requireActual<{ default: unknown }>("react-native-safe-area-context/jest/mock").default,
);
// 11:20 in London on Thursday 15 October 2026.
jest.mock("../lib/useNow", () => {
  const mockNow = new Date("2026-10-15T10:20:00Z");

  return { useNow: () => mockNow };
});
// AuthGate reads the app's client from this module, which the test points at the client it builds.
const mockApp: { client: unknown; removeStoredSession: () => Promise<void> } = {
  client: undefined,
  removeStoredSession: () => Promise.resolve(),
};
jest.mock("../lib/supabase", () => ({
  get supabase() {
    return mockApp.client;
  },
  removeStoredSession: () => mockApp.removeStoredSession(),
}));

const TODAY = "2026-10-15";
const SUPABASE_GIVES_UP_MS = 40_000;
// Supabase's start stops trying the refresh after about 25 seconds.
const SUPABASE_START_ENDS_MS = 26_000;

let queryClient: QueryClient;
let stopRefreshing: () => Promise<void> = () => Promise.resolve();

describe("opening the diary with no connection, from a cold start", () => {
  let kitStyles: string;

  beforeAll(async () => {
    kitStyles = await compileKitStyles("", ["components/DiaryScreen"]);
  });

  beforeEach(async () => {
    registerAppStyles(kitStyles);
    resetRouterMock();
    resetDiaryBackend();
    diaryBackend.entries = sampleDay();
    await AsyncStorage.clear();
    await signInDiaryClient();
  });

  afterEach(async () => {
    await cleanup();
    await stopRefreshing();
    jest.clearAllTimers();
    jest.useRealTimers();
    await act(() => {
      onlineManager.setOnline(true);
    });
    queryClient.clear();
  });

  async function useTheDiaryOnlineThenCloseTheApp() {
    queryClient = createDiaryQueryClient();
    await render(
      <ThemeProvider fixedPreference="dark">
        <KeyLowProvider client={diaryClient} queryClient={queryClient}>
          <PersistedDiaryCache
            readStoredUserId={async () =>
              (await diaryClient.auth.getSession()).data.session?.user.id ?? null
            }
          >
            <DiaryScreen />
          </PersistedDiaryCache>
        </KeyLowProvider>
      </ThemeProvider>,
    );
    await screen.findByRole("button", { name: /^Porridge oats/ });
    await waitFor(async () => {
      const text = await AsyncStorage.getItem(DIARY_CACHE_STORAGE_KEY);
      const hashes =
        text === null ? [] : parseStoredCache(text).clientState.queries.map((q) => q.queryHash);
      for (const queryKey of [keys.diary.day(TODAY), keys.profiles.termsAcceptance]) {
        expect(hashes).toContain(hashKey(queryKey));
      }
    });
    await cleanup();
    queryClient.clear();
  }

  async function startOffline(options: { hasStoredSession: boolean }) {
    const { client, storage } = createStoredSessionClient({
      hasStoredSession: options.hasStoredSession,
      refresh: "network-down",
    });
    mockApp.client = client;
    mockApp.removeStoredSession = () => storage.removeItem(STORED_SESSION_KEY);
    stopRefreshing = () => client.auth.stopAutoRefresh();
    const readStoredUserId = createStoredUserIdReader(storage, STORED_SESSION_KEY);
    jest.useFakeTimers();
    await act(() => {
      onlineManager.setOnline(false);
    });
    routerMock.segments = ["(tabs)", "diary"];
    queryClient = createDiaryQueryClient();

    await render(
      <ThemeProvider fixedPreference="dark">
        <KeyLowProvider client={client} queryClient={queryClient}>
          <PersistedDiaryCache readStoredUserId={readStoredUserId}>
            <AuthGate readStoredUserId={readStoredUserId}>
              <DiaryScreen />
              <SignOutButton />
            </AuthGate>
          </PersistedDiaryCache>
        </KeyLowProvider>
      </ThemeProvider>,
    );

    return { storage };
  }

  it("should show today's entries at once when the access token has expired, and keep showing them once Supabase gives up refreshing", async () => {
    await useTheDiaryOnlineThenCloseTheApp();

    await startOffline({ hasStoredSession: true });

    expect(await screen.findByRole("button", { name: /^Porridge oats/ })).toBeOnTheScreen();
    expect(screen.getByRole("status", { name: /You're offline/ })).toBeOnTheScreen();
    await act(async () => {
      await jest.advanceTimersByTimeAsync(SUPABASE_GIVES_UP_MS);
    });
    expect(screen.getByRole("button", { name: /^Porridge oats/ })).toBeOnTheScreen();
    expect(routerMock.replace).not.toHaveBeenCalledWith("/(auth)/sign-in");
  });

  it("should not show the stored cache to a person whose session is another account's", async () => {
    await useTheDiaryOnlineThenCloseTheApp();
    const stored = await AsyncStorage.getItem(DIARY_CACHE_STORAGE_KEY);
    await AsyncStorage.setItem(DIARY_CACHE_STORAGE_KEY, (stored ?? "").replaceAll("1111", "9999"));

    await startOffline({ hasStoredSession: true });

    await waitFor(async () => {
      expect(await AsyncStorage.getItem(DIARY_CACHE_STORAGE_KEY)).toBeNull();
    });
    expect(screen.queryByRole("button", { name: /^Porridge oats/ })).not.toBeOnTheScreen();
    expect(queryClient.getQueryData(keys.diary.day(TODAY))).toBeUndefined();
  });

  it("should sign the person out, and empty the phone, when they sign out offline with an expired access token", async () => {
    await useTheDiaryOnlineThenCloseTheApp();
    const { storage } = await startOffline({ hasStoredSession: true });
    await screen.findByRole("button", { name: /^Porridge oats/ });
    expect(storage.items.has(STORED_SESSION_KEY)).toBe(true);
    expect(await AsyncStorage.getItem(DIARY_CACHE_STORAGE_KEY)).not.toBeNull();

    await fireEvent.press(screen.getByRole("button", { name: ACCEPT_TERMS_SCREEN.signOutLabel }));
    // Supabase finishes its start before it signs out, and offline that start is still trying the refresh.
    await act(async () => {
      await jest.advanceTimersByTimeAsync(SUPABASE_START_ENDS_MS);
    });

    await waitFor(() => {
      expect(routerMock.replace).toHaveBeenCalledWith("/(auth)/sign-in");
    });
    expect(storage.items.has(STORED_SESSION_KEY)).toBe(false);
    expect(await AsyncStorage.getItem(DIARY_CACHE_STORAGE_KEY)).toBeNull();
    expect(queryClient.getQueryData(keys.diary.day(TODAY))).toBeUndefined();
  });
});
