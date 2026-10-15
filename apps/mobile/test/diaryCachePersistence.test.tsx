import { KeyLowProvider, keys } from "@keylow/api-client";
import { TERMS_VERSION } from "@keylow/core/copy";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { hashKey, onlineManager } from "@tanstack/react-query";
import { act, cleanup, render, screen, waitFor } from "@testing-library/react-native";

import { DiaryScreen } from "../components/DiaryScreen";
import { PersistedDiaryCache } from "../components/PersistedDiaryCache";
import { DIARY_CACHE_BUSTER, createQueryClient, parseStoredCache } from "../lib/diaryCache";
import { DIARY_CACHE_MAX_AGE_MS, DIARY_CACHE_STORAGE_KEY } from "../lib/diaryCache/constants";
import { ThemeProvider } from "../lib/theme";
import {
  createDiaryQueryClient,
  diaryBackend,
  diaryClient,
  requestsTo,
  resetDiaryBackend,
  sampleDay,
  signInDiaryClient,
} from "./support/diaryBackend";
import { resetRouterMock } from "./support/expoRouterMock";
import { compileKitStyles } from "./support/kitStyles";
import { registerAppStyles } from "./support/nativeWindStyles";

import type { QueryClient } from "@tanstack/react-query";
import type { PersistedClient } from "@tanstack/react-query-persist-client";

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

const TODAY = "2026-10-15";
const ALL_TABLES = ["profiles", "food_log_entries", "day_logs", "day_totals"];
const SLOW_CONNECTION_MS = 1200;

let queryClient: QueryClient;

async function renderDiary(client: QueryClient = createDiaryQueryClient()) {
  queryClient = client;
  await render(
    <ThemeProvider fixedPreference="dark">
      <KeyLowProvider client={diaryClient} queryClient={queryClient}>
        <PersistedDiaryCache>
          <DiaryScreen />
        </PersistedDiaryCache>
      </KeyLowProvider>
    </ThemeProvider>,
  );
}

async function readStoredCache(): Promise<PersistedClient | null> {
  const text = await AsyncStorage.getItem(DIARY_CACHE_STORAGE_KEY);

  return text === null ? null : parseStoredCache(text);
}

async function storedQueryHashes(): Promise<string[]> {
  const stored = await readStoredCache();

  return stored?.clientState.queries.map(({ queryHash }) => queryHash) ?? [];
}

async function waitForStoredCacheOfTheDiary() {
  await waitFor(async () => {
    const hashes = await storedQueryHashes();
    for (const queryKey of [
      keys.diary.day(TODAY),
      keys.profiles.targets,
      keys.profiles.termsAcceptance,
      keys.profiles.timeZone,
    ]) {
      expect(hashes).toContain(hashKey(queryKey));
    }
  });
}

/** Looks at today's diary with a connection, until the cache is stored, then closes the app. */
async function storeTheDiaryAndCloseTheApp() {
  await renderDiary();
  await screen.findByRole("button", { name: /^Porridge oats/ });
  await waitForStoredCacheOfTheDiary();
  await cleanup();
  queryClient.clear();
}

async function changeStoredCache(change: (stored: PersistedClient) => PersistedClient) {
  const stored = await readStoredCache();
  if (stored === null) {
    throw new Error("Nothing is stored");
  }
  await AsyncStorage.setItem(DIARY_CACHE_STORAGE_KEY, JSON.stringify(change(stored)));
}

function networkAnswersNothing() {
  for (const table of ALL_TABLES) {
    diaryBackend.hungTables.add(table);
  }
}

/** The server refusing a token that was revoked, so a read after the sign out finds nothing. */
function networkRefusesEverything() {
  for (const table of ALL_TABLES) {
    diaryBackend.failingTables.add(table);
  }
}

const porridge = () => screen.queryByRole("button", { name: /^Porridge oats/ });

describe("the persisted diary cache", () => {
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
    jest.restoreAllMocks();
    await cleanup();
    await act(() => {
      onlineManager.setOnline(true);
    });
    queryClient.clear();
  });

  describe("a cold start with a stored cache", () => {
    it("should show today's entries before the network has answered anything", async () => {
      await storeTheDiaryAndCloseTheApp();
      networkAnswersNothing();

      await renderDiary();

      expect(await screen.findByRole("button", { name: /^Porridge oats/ })).toBeOnTheScreen();
      await waitFor(() => {
        expect(requestsTo("food_log_entries")).toBeGreaterThan(0);
      });
    });

    it("should show today's entries with no connection at all, and ask the network for nothing", async () => {
      await storeTheDiaryAndCloseTheApp();
      await act(() => {
        onlineManager.setOnline(false);
      });
      diaryBackend.requests = [];

      await renderDiary();

      expect(await screen.findByRole("button", { name: /^Porridge oats/ })).toBeOnTheScreen();
      expect(screen.getByText("You're offline")).toBeOnTheScreen();
      expect(diaryBackend.requests).toEqual([]);
    });

    it.each([
      ["another version of the app", `${DIARY_CACHE_BUSTER}-older`],
      ["an app that stamped none", ""],
    ])("should not read a cache that %s stored", async (_name, buster) => {
      await storeTheDiaryAndCloseTheApp();
      await changeStoredCache((stored) => ({ ...stored, buster }));
      networkAnswersNothing();

      await renderDiary();

      await waitFor(() => {
        expect(requestsTo("profiles")).toBeGreaterThan(0);
      });
      expect(porridge()).not.toBeOnTheScreen();
      expect(await AsyncStorage.getItem(DIARY_CACHE_STORAGE_KEY)).toBeNull();
    });

    it("should still read a cache that was stored six days ago", async () => {
      await storeTheDiaryAndCloseTheApp();
      await changeStoredCache((stored) => ({
        ...stored,
        timestamp: Date.now() - 6 * 24 * 60 * 60 * 1000,
      }));
      networkAnswersNothing();

      await renderDiary();

      expect(await screen.findByRole("button", { name: /^Porridge oats/ })).toBeOnTheScreen();
    });

    it("should not read a cache that was stored more than a week ago", async () => {
      await storeTheDiaryAndCloseTheApp();
      await changeStoredCache((stored) => ({
        ...stored,
        timestamp: Date.now() - DIARY_CACHE_MAX_AGE_MS - 1000,
      }));
      networkAnswersNothing();

      await renderDiary();

      await waitFor(() => {
        expect(requestsTo("profiles")).toBeGreaterThan(0);
      });
      expect(porridge()).not.toBeOnTheScreen();
    });

    it("should start from the network, and log none of the damaged cache, when it cannot be read", async () => {
      await AsyncStorage.setItem(DIARY_CACHE_STORAGE_KEY, '{"buster": "Porridge oats 187 kcal');
      const errors = jest.spyOn(console, "error").mockImplementation(() => undefined);
      const warnings = jest.spyOn(console, "warn").mockImplementation(() => undefined);

      await renderDiary();

      expect(await screen.findByRole("button", { name: /^Porridge oats/ })).toBeOnTheScreen();
      expect(JSON.stringify([...errors.mock.calls, ...warnings.mock.calls])).not.toContain(
        "Porridge",
      );
    });
  });

  describe("an account that has to accept the Terms", () => {
    it("should not read the stored cache into memory, nor show a word of it", async () => {
      await storeTheDiaryAndCloseTheApp();
      // The stored acceptance is for an older version of the Terms, as after an app update.
      await changeStoredCache((stored) => ({
        ...stored,
        clientState: {
          ...stored.clientState,
          queries: stored.clientState.queries.map((query) =>
            query.queryHash === hashKey(keys.profiles.termsAcceptance)
              ? {
                  ...query,
                  state: {
                    ...query.state,
                    data: {
                      terms_accepted_at: "2026-01-01T00:00:00+00:00",
                      terms_version: `${TERMS_VERSION}-older`,
                    },
                  },
                }
              : query,
          ),
        },
      }));
      networkAnswersNothing();

      await renderDiary();

      await waitFor(() => {
        expect(requestsTo("profiles")).toBeGreaterThan(0);
      });
      expect(queryClient.getQueryData(keys.diary.day(TODAY))).toBeUndefined();
      expect(queryClient.getQueryData(keys.profiles.targets)).toBeUndefined();
      expect(porridge()).not.toBeOnTheScreen();
      expect(await AsyncStorage.getItem(DIARY_CACHE_STORAGE_KEY)).toBeNull();
    });
  });

  describe("what is stored", () => {
    it("should be the diary, the targets and the profile reads, and not a food search", async () => {
      const client = createDiaryQueryClient();
      client.setQueryData(keys.foods.search("oats"), [{ name: "Porridge oats" }]);
      await renderDiary(client);
      await screen.findByRole("button", { name: /^Porridge oats/ });

      await waitForStoredCacheOfTheDiary();

      const hashes = await storedQueryHashes();
      expect(hashes).not.toContain(hashKey(keys.foods.search("oats")));
      expect(hashes).toEqual(
        expect.arrayContaining([
          hashKey(keys.diary.week("2026-10-12")),
          hashKey(keys.diary.day(TODAY)),
        ]),
      );
    });
  });

  describe("signing out", () => {
    it("should empty the stored cache and the one in memory, and leave them empty", async () => {
      await renderDiary();
      await screen.findByRole("button", { name: /^Porridge oats/ });
      await waitForStoredCacheOfTheDiary();
      networkRefusesEverything();

      await act(async () => {
        await diaryClient.auth.signOut();
      });

      await waitFor(async () => {
        expect(await AsyncStorage.getItem(DIARY_CACHE_STORAGE_KEY)).toBeNull();
      });
      expect(queryClient.getQueryData(keys.diary.day(TODAY))).toBeUndefined();
      // A save that was already waiting for its turn must not bring the cache back.
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, SLOW_CONNECTION_MS));
      });
      expect(await AsyncStorage.getItem(DIARY_CACHE_STORAGE_KEY)).toBeNull();
    });

    it("should leave nothing in memory when the sign out comes before the stored cache has been read", async () => {
      await storeTheDiaryAndCloseTheApp();
      const stored = await AsyncStorage.getItem(DIARY_CACHE_STORAGE_KEY);
      let finishReading: () => void = () => undefined;
      const slowRead = new Promise<void>((resolve) => {
        finishReading = resolve;
      });
      jest.mocked(AsyncStorage.getItem).mockImplementationOnce(async () => {
        await slowRead;
        return stored;
      });
      networkAnswersNothing();
      await renderDiary();

      await act(async () => {
        await diaryClient.auth.signOut();
      });
      await act(async () => {
        finishReading();
        await slowRead;
      });

      await waitFor(() => {
        expect(queryClient.getQueryData(keys.diary.day(TODAY))).toBeUndefined();
      });
      expect(await AsyncStorage.getItem(DIARY_CACHE_STORAGE_KEY)).toBeNull();
    });

    it("should keep the stored cache when the app starts with no session it can read, as offline once the access token has expired", async () => {
      await storeTheDiaryAndCloseTheApp();
      // The app is closed, so nothing hears this. The next start finds a client with no session.
      await diaryClient.auth.signOut();
      await act(() => {
        onlineManager.setOnline(false);
      });

      await renderDiary();

      expect(await screen.findByRole("button", { name: /^Porridge oats/ })).toBeOnTheScreen();
      expect(await AsyncStorage.getItem(DIARY_CACHE_STORAGE_KEY)).not.toBeNull();
    });
  });
});

describe("the query client of the phone", () => {
  it("should hold the stored queries in memory for as long as they may be stored, and others for the default", () => {
    const phoneClient = createQueryClient();

    expect(phoneClient.getQueryDefaults(keys.diary.day(TODAY)).gcTime).toBe(DIARY_CACHE_MAX_AGE_MS);
    expect(phoneClient.getQueryDefaults(keys.profiles.targets).gcTime).toBe(DIARY_CACHE_MAX_AGE_MS);
    expect(phoneClient.getQueryDefaults(keys.foods.search("oats")).gcTime).toBeUndefined();
  });
});
