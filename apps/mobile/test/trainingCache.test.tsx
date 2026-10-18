import { KeyLowProvider, keys, useMuscleState } from "@keylow/api-client";
import { TERMS_VERSION } from "@keylow/core/copy";
import {
  TRAINING_PARAMS_V1,
  buildSetSnapshot,
  muscleState,
  targetedMuscles,
} from "@keylow/core/training";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { hashKey, onlineManager } from "@tanstack/react-query";
import { act, cleanup, render, screen, waitFor } from "@testing-library/react-native";
import { Text, View } from "react-native";

import { PersistedDiaryCache } from "../components/PersistedDiaryCache";
import { createQueryClient, parseStoredCache } from "../lib/diaryCache";
import {
  createDiaryQueryClient,
  diaryBackend,
  diaryClient,
  resetDiaryBackend,
  signInDiaryClient,
  SIGNED_IN_USER_ID,
} from "./support/diaryBackend";
import { DIARY_CACHE_MAX_AGE_MS, DIARY_CACHE_STORAGE_KEY } from "../lib/diaryCache/constants";

import type { ActiveRoutine, TrainingSet } from "@keylow/api-client";
import type { QueryClient } from "@tanstack/react-query";

jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: jest.requireActual<object>(
    "@react-native-async-storage/async-storage/jest/async-storage-mock",
  ),
}));

// Both moments are on 17 October in London (BST), so they share the key of the start day.
const MORNING = "2026-10-17T07:00:00Z";
const EVENING = "2026-10-17T20:00:00Z";
const START_DAY = "2026-10-02";
const OLDER_START_DAY = "2026-10-01";
const WEEK_START = "2026-10-12";
const SAVE_INTERVAL_MS = 1000;
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const EXERCISE_ID = "77777777-7777-4777-8777-777777777777";
const RECOGNISABLE_EXERCISE_NAME = "key357-recognisable-exercise";

const snapshot = buildSetSnapshot(
  { id: EXERCISE_ID, name: RECOGNISABLE_EXERCISE_NAME, equipment: "barbell", mechanic: "compound" },
  [{ muscle_id: "chest_lower", role: "primary", weight: 1 }],
);

const trainingSets: TrainingSet[] = [
  {
    id: "99999999-9999-4999-8999-000000000001",
    session_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    exercise_id: EXERCISE_ID,
    set_type: "working",
    rir: 2,
    rpe: null,
    performed_at: "2026-10-17T06:00:00+00:00",
    snapshot,
    deleted_at: null,
  },
];

const activeRoutine: ActiveRoutine = {
  id: "88888888-8888-4888-8888-888888888888",
  name: "key357 routine",
  days: [],
};

const termsAcceptance = {
  terms_accepted_at: "2026-10-15T09:30:00+00:00",
  terms_version: TERMS_VERSION,
};

/** What an online open leaves in the cache of a phone, which the persister then stores. */
function seedTrainingReads(
  queryClient: QueryClient,
  options: { olderSetsReadHoursAgo?: number } = {},
) {
  queryClient.setQueryData(keys.profiles.termsAcceptance, termsAcceptance);
  queryClient.setQueryData(keys.profiles.timeZone, "Europe/London");
  queryClient.setQueryData(keys.training.sets(START_DAY), trainingSets);
  queryClient.setQueryData(keys.training.activeRoutine, activeRoutine);
  queryClient.setQueryData(keys.training.weekSessions(WEEK_START), []);
  if (options.olderSetsReadHoursAgo !== undefined) {
    queryClient.setQueryData(keys.training.sets(OLDER_START_DAY), trainingSets, {
      updatedAt: Date.now() - options.olderSetsReadHoursAgo * 60 * 60 * 1000,
    });
  }
}

function HeatOfTheLowerChest({ now }: { now: string }) {
  const { data } = useMuscleState(now);

  return data === undefined ? (
    <Text>Reading the heat</Text>
  ) : (
    <Text>{`Lower chest heat ${data.chest_lower.heat.toFixed(4)}`}</Text>
  );
}

let queryClient: QueryClient;
const readSignedInUserId = async () =>
  (await diaryClient.auth.getSession()).data.session?.user.id ?? null;

async function renderCache(
  child: React.ReactNode,
  options: { client?: QueryClient; readStoredUserId?: () => Promise<string | null> } = {},
) {
  queryClient = options.client ?? createDiaryQueryClient();
  await render(
    <KeyLowProvider client={diaryClient} queryClient={queryClient}>
      <PersistedDiaryCache readStoredUserId={options.readStoredUserId ?? readSignedInUserId}>
        {child}
      </PersistedDiaryCache>
    </KeyLowProvider>,
  );
}

async function storedQueryHashes(): Promise<string[]> {
  const text = await AsyncStorage.getItem(DIARY_CACHE_STORAGE_KEY);

  return text === null ? [] : parseStoredCache(text).clientState.queries.map((q) => q.queryHash);
}

// The library saves at most once a second. The clock is fake here, so letting a save run is no sleep.
async function letWaitingSavesRun() {
  await act(async () => {
    await jest.advanceTimersByTimeAsync(SAVE_INTERVAL_MS * 2);
  });
}

/** Opens the app with the training reads cached, lets them be stored, and closes the app. */
async function storeTheTrainingReadsAndCloseTheApp(
  child: React.ReactNode,
  options: Parameters<typeof seedTrainingReads>[1] = {},
) {
  await renderCache(child);
  // The cache saves what changes after it has been restored, so the reads come in once that is done.
  await letWaitingSavesRun();
  await act(() => {
    seedTrainingReads(queryClient, options);
  });
  await letWaitingSavesRun();
  await waitFor(async () => {
    expect(await storedQueryHashes()).toContain(hashKey(keys.training.activeRoutine));
  });
  await cleanup();
  await letWaitingSavesRun();
  queryClient.clear();
}

describe("the training reads in the persisted cache", () => {
  beforeEach(async () => {
    jest.useFakeTimers();
    resetDiaryBackend();
    await AsyncStorage.clear();
    await signInDiaryClient();
    await act(() => {
      onlineManager.setOnline(false);
    });
  });

  afterEach(async () => {
    await cleanup();
    await letWaitingSavesRun();
    await act(() => {
      onlineManager.setOnline(true);
    });
    queryClient.clear();
    jest.useRealTimers();
  });

  describe("what is stored", () => {
    it("should be the sets, the active routine and the week's sessions, with the newest sets only", async () => {
      await storeTheTrainingReadsAndCloseTheApp(<View />, { olderSetsReadHoursAgo: 30 });

      const hashes = await storedQueryHashes();
      expect(hashes).toEqual(
        expect.arrayContaining([
          hashKey(keys.training.sets(START_DAY)),
          hashKey(keys.training.activeRoutine),
          hashKey(keys.training.weekSessions(WEEK_START)),
        ]),
      );
      expect(hashes).not.toContain(hashKey(keys.training.sets(OLDER_START_DAY)));
    });
  });

  describe("a cold start with no connection", () => {
    it("should show heat worked out at the current moment from the stored rows, and ask the network for nothing", async () => {
      await storeTheTrainingReadsAndCloseTheApp(<HeatOfTheLowerChest now={MORNING} />);
      const heatAt = (now: string) =>
        muscleState(
          trainingSets,
          now,
          TRAINING_PARAMS_V1,
          targetedMuscles({ routine: activeRoutine }),
        ).chest_lower.heat.toFixed(4);
      expect(heatAt(EVENING)).not.toBe(heatAt(MORNING));
      diaryBackend.requests = [];

      await renderCache(<HeatOfTheLowerChest now={EVENING} />);

      expect(await screen.findByText(`Lower chest heat ${heatAt(EVENING)}`)).toBeOnTheScreen();
      expect(diaryBackend.requests).toEqual([]);
    });
  });

  describe("whose cache it is", () => {
    it("should not read the stored training reads for another account, and remove them", async () => {
      await storeTheTrainingReadsAndCloseTheApp(<View />);

      await renderCache(<HeatOfTheLowerChest now={EVENING} />, {
        readStoredUserId: () => Promise.resolve("22222222-2222-4222-8222-222222222222"),
      });

      await waitFor(async () => {
        expect(await AsyncStorage.getItem(DIARY_CACHE_STORAGE_KEY)).toBeNull();
      });
      expect(queryClient.getQueryData(keys.training.sets(START_DAY))).toBeUndefined();
      expect(queryClient.getQueryData(keys.training.activeRoutine)).toBeUndefined();
      expect(screen.queryByText(/Lower chest heat/)).not.toBeOnTheScreen();
    });

    it("should give the stored training reads back to the account that stored them", async () => {
      await storeTheTrainingReadsAndCloseTheApp(<View />);

      await renderCache(<View />, { readStoredUserId: () => Promise.resolve(SIGNED_IN_USER_ID) });

      await waitFor(() => {
        expect(queryClient.getQueryData(keys.training.activeRoutine)).toEqual(activeRoutine);
      });
    });
  });

  describe("signing out", () => {
    it("should remove the training reads from the stored cache and from memory, with the rest", async () => {
      await storeTheTrainingReadsAndCloseTheApp(<View />);
      await renderCache(<View />);
      await waitFor(() => {
        expect(queryClient.getQueryData(keys.training.activeRoutine)).toEqual(activeRoutine);
      });

      await act(async () => {
        await diaryClient.auth.signOut();
      });

      await waitFor(async () => {
        expect(await AsyncStorage.getItem(DIARY_CACHE_STORAGE_KEY)).toBeNull();
      });
      expect(queryClient.getQueryData(keys.training.sets(START_DAY))).toBeUndefined();
      expect(queryClient.getQueryData(keys.training.activeRoutine)).toBeUndefined();
      expect(queryClient.getQueryData(keys.training.weekSessions(WEEK_START))).toBeUndefined();
      // A save that was already waiting for its turn must not bring the cache back.
      await letWaitingSavesRun();
      expect(await AsyncStorage.getItem(DIARY_CACHE_STORAGE_KEY)).toBeNull();
    });
  });

  describe("how old the training reads may be", () => {
    it("should drop a week of sessions stored more than a week ago, and keep the others", async () => {
      await storeTheTrainingReadsAndCloseTheApp(<View />);
      const text = await AsyncStorage.getItem(DIARY_CACHE_STORAGE_KEY);
      const stored = parseStoredCache(text ?? "");
      await AsyncStorage.setItem(
        DIARY_CACHE_STORAGE_KEY,
        JSON.stringify({
          ...stored,
          clientState: {
            ...stored.clientState,
            queries: stored.clientState.queries.map((query) =>
              query.queryHash === hashKey(keys.training.weekSessions(WEEK_START))
                ? {
                    ...query,
                    state: { ...query.state, dataUpdatedAt: Date.now() - WEEK_MS - 1000 },
                  }
                : query,
            ),
          },
        }),
      );

      await renderCache(<View />);

      await waitFor(() => {
        expect(queryClient.getQueryData(keys.training.activeRoutine)).toEqual(activeRoutine);
      });
      expect(queryClient.getQueryData(keys.training.weekSessions(WEEK_START))).toBeUndefined();
    });
  });
});

describe("the query client of the phone, for the training reads", () => {
  it("should hold the training reads in memory for as long as they may be stored", () => {
    const phoneClient = createQueryClient();

    for (const queryKey of [
      keys.training.sets(START_DAY),
      keys.training.activeRoutine,
      keys.training.weekSessions(WEEK_START),
    ]) {
      expect(phoneClient.getQueryDefaults(queryKey).gcTime).toBe(DIARY_CACHE_MAX_AGE_MS);
    }
  });
});
