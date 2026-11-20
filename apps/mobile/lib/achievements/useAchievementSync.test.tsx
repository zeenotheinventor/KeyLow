import {
  appendFreezeEvents,
  fetchAchievementStats,
  fetchAchievementsBackfilledAt,
  recordAchievements,
  KeyLowProvider,
  useRecordAchievementEvent,
  useSupabase,
} from "@keylow/api-client";
import { MutationObserver, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, renderHook } from "@testing-library/react-native";
import { AppState } from "react-native";

import {
  acknowledgeCelebrations,
  getCelebrationState,
  resetCelebrations,
} from "./celebrationStore";
import { notifiedBadgesStorageKey, rememberNotifiedIds } from "./notifiedBadges";
import { snapshotHolding } from "./storedStatsFixture";
import { useAchievementSync } from "./useAchievementSync";
import { reminderSettingsStorageKey } from "../reminderSettings";
import { useReadsEnabled } from "../useReadsEnabled";

import type * as ApiClient from "@keylow/api-client";
import type { PropsWithChildren } from "react";
import type { AppStateStatus, NativeEventSubscription } from "react-native";

const mockStorageItems = new Map<string, string>();
jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: {
    getItem: (key: string) => Promise.resolve(mockStorageItems.get(key) ?? null),
    setItem: (key: string, value: string) => {
      mockStorageItems.set(key, value);
      return Promise.resolve();
    },
  },
}));
jest.mock("@keylow/api-client", () => ({
  ...jest.requireActual<typeof ApiClient>("@keylow/api-client"),
  useSupabase: jest.fn(),
  fetchAchievementStats: jest.fn(),
  fetchAchievementsBackfilledAt: jest.fn(),
  recordAchievements: jest.fn(),
  appendFreezeEvents: jest.fn(),
}));
jest.mock("../useReadsEnabled");

const client = { name: "the supabase client" };
const fetchStats = jest.mocked(fetchAchievementStats);
const record = jest.mocked(recordAchievements);
const appendFreezes = jest.mocked(appendFreezeEvents);
const readBackfilledAt = jest.mocked(fetchAchievementsBackfilledAt);

const SEEN = "2026-11-18T09:00:00.000Z";
const held = (id: string, overrides: { seenAt?: string | null; backfilled?: boolean } = {}) => ({
  id,
  unlockedAt: "2026-11-17T09:00:00.000Z",
  seenAt: null,
  backfilled: false,
  ...overrides,
});

let queryClient: QueryClient;
let appStateListener: (state: AppStateStatus) => void;
const removeAppStateListener = jest.fn();

function Wrapper({ children }: PropsWithChildren) {
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

// `currentState` is a plain property of the module, so the test stands a getter in its place.
const setAppState = (state: AppStateStatus) => {
  Object.defineProperty(AppState, "currentState", { configurable: true, get: () => state });
};

const settle = () =>
  act(async () => {
    await jest.advanceTimersByTimeAsync(0);
  });
const advance = (milliseconds: number) =>
  act(async () => {
    await jest.advanceTimersByTimeAsync(milliseconds);
  });
const succeedAMutation = () =>
  act(async () => {
    await new MutationObserver(queryClient, { mutationFn: () => Promise.resolve("done") }).mutate();
  });
const mountAndSettle = async () => {
  const view = await renderHook(
    () => {
      useAchievementSync("account-a");
    },
    { wrapper: Wrapper },
  );
  await settle();
  return view;
};
const foreground = (state: AppStateStatus = "active") =>
  act(async () => {
    appStateListener(state);
    await jest.advanceTimersByTimeAsync(0);
  });

describe("useAchievementSync", () => {
  beforeEach(() => {
    jest.useFakeTimers({ now: new Date("2026-11-19T22:00:00Z") });
    queryClient = new QueryClient();
    resetCelebrations();
    mockStorageItems.clear();
    jest.mocked(useSupabase).mockReturnValue(client as unknown as ReturnType<typeof useSupabase>);
    jest.mocked(useReadsEnabled).mockReturnValue(true);
    fetchStats.mockReset().mockResolvedValue(snapshotHolding());
    record.mockReset().mockResolvedValue([]);
    appendFreezes.mockReset().mockResolvedValue(undefined);
    readBackfilledAt.mockReset().mockResolvedValue("2026-11-01T09:00:00.000Z");
    removeAppStateListener.mockReset();
    jest
      .spyOn(AppState, "addEventListener")
      .mockImplementation((_type, listener): NativeEventSubscription => {
        appStateListener = listener;
        return { remove: removeAppStateListener };
      });
    setAppState("active");
  });

  afterEach(async () => {
    await cleanup();
    queryClient.clear();
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  describe("when a run happens", () => {
    it("should run once when the app opens signed in", async () => {
      await mountAndSettle();

      expect(fetchStats).toHaveBeenCalledTimes(1);
      expect(fetchStats).toHaveBeenCalledWith(client);
    });

    it("should run nothing while the terms gate keeps reads off", async () => {
      jest.mocked(useReadsEnabled).mockReturnValue(false);

      await mountAndSettle();
      await succeedAMutation();
      await advance(5000);

      expect(fetchStats).not.toHaveBeenCalled();
    });

    it("should run once after one successful write, once the debounce has passed", async () => {
      await mountAndSettle();
      fetchStats.mockClear();

      await succeedAMutation();
      await advance(1999);
      expect(fetchStats).not.toHaveBeenCalled();
      await advance(1);

      expect(fetchStats).toHaveBeenCalledTimes(1);
    });

    it("should run once for five writes inside the debounce", async () => {
      await mountAndSettle();
      fetchStats.mockClear();

      for (let write = 0; write < 5; write += 1) {
        await succeedAMutation();
        await advance(500);
      }
      await advance(2000);

      expect(fetchStats).toHaveBeenCalledTimes(1);
    });

    it("should not run for a write that failed", async () => {
      await mountAndSettle();
      fetchStats.mockClear();

      await act(async () => {
        await new MutationObserver(queryClient, {
          mutationFn: () => Promise.reject(new Error("offline")),
        })
          .mutate()
          .catch(() => undefined);
      });
      await advance(5000);

      expect(fetchStats).not.toHaveBeenCalled();
    });

    it("should run after the assistant's changes are refreshed, which is how its writes arrive", async () => {
      queryClient.setQueryData(["assistant", "changes"], []);
      await mountAndSettle();
      fetchStats.mockClear();

      await act(async () => {
        await queryClient.invalidateQueries({ queryKey: ["assistant", "changes"] });
      });
      await advance(2000);

      expect(fetchStats).toHaveBeenCalledTimes(1);
    });

    it("should run at once, with no debounce, when the app returns to the foreground", async () => {
      await mountAndSettle();
      fetchStats.mockClear();

      await foreground("active");

      expect(fetchStats).toHaveBeenCalledTimes(1);
    });

    it("should not run when the app goes to the background", async () => {
      await mountAndSettle();
      fetchStats.mockClear();

      await foreground("background");

      expect(fetchStats).not.toHaveBeenCalled();
    });

    it("should run again when the app is foregrounded after midnight", async () => {
      await mountAndSettle();
      fetchStats.mockClear();

      appendFreezes.mockClear();
      jest.setSystemTime(new Date("2026-11-20T00:05:00Z"));
      await foreground("active");

      expect(fetchStats).toHaveBeenCalledTimes(1);
      expect(appendFreezes).toHaveBeenCalledWith(client, [
        {
          kind: "earned",
          reason: "first_use",
          reference: "first-bite",
          count: 1,
          date: "2026-11-20",
        },
      ]);
    });

    it("should run once more after a run that a trigger overlapped, and no more", async () => {
      await mountAndSettle();
      fetchStats.mockClear();
      let finishRead: (snapshot: ReturnType<typeof snapshotHolding>) => void = () => undefined;
      fetchStats.mockReturnValueOnce(
        new Promise((resolve) => {
          finishRead = resolve;
        }),
      );

      await foreground();
      await foreground();
      await foreground();
      expect(fetchStats).toHaveBeenCalledTimes(1);
      await act(async () => {
        finishRead(snapshotHolding());
        await jest.advanceTimersByTimeAsync(0);
      });

      expect(fetchStats).toHaveBeenCalledTimes(2);
    });

    it("should stop listening and drop the queue when the user signs out", async () => {
      record.mockResolvedValue(["first-bite"]);
      const view = await mountAndSettle();
      expect(getCelebrationState().entries).toHaveLength(1);

      await view.unmount();

      expect(removeAppStateListener).toHaveBeenCalledTimes(1);
      expect(getCelebrationState().entries).toEqual([]);
    });
  });

  describe("a run that outlives its user", () => {
    it("should write nothing and queue nothing when the user signs out while the stats are being read", async () => {
      let finishRead: (snapshot: ReturnType<typeof snapshotHolding>) => void = () => undefined;
      fetchStats.mockReturnValueOnce(
        new Promise((resolve) => {
          finishRead = resolve;
        }),
      );
      record.mockResolvedValue(["first-bite"]);
      const view = await mountAndSettle();

      await view.unmount();
      await act(async () => {
        finishRead(snapshotHolding());
        await jest.advanceTimersByTimeAsync(0);
      });

      expect(record).not.toHaveBeenCalled();
      expect(appendFreezes).not.toHaveBeenCalled();
      expect(getCelebrationState().entries).toEqual([]);
    });

    it("should queue nothing when the user signs out while the badges are being recorded", async () => {
      let finishRecord: (ids: string[]) => void = () => undefined;
      record.mockReturnValueOnce(
        new Promise((resolve) => {
          finishRecord = resolve;
        }),
      );
      const view = await mountAndSettle();

      await view.unmount();
      await act(async () => {
        finishRecord(["first-bite"]);
        await jest.advanceTimersByTimeAsync(0);
      });

      expect(appendFreezes).not.toHaveBeenCalled();
      expect(getCelebrationState().entries).toEqual([]);
    });
  });

  describe("what a run writes", () => {
    it("should record the ids the engine earned and not mark it a backfill once the profile is backfilled", async () => {
      await mountAndSettle();

      expect(record).toHaveBeenCalledWith(client, expect.arrayContaining(["first-bite"]), false);
      expect(appendFreezes).toHaveBeenCalledWith(client, [
        {
          kind: "earned",
          reason: "first_use",
          reference: "first-bite",
          count: 1,
          date: "2026-11-19",
        },
      ]);
    });

    it("should tell the engine a reminder is on when the device has one switched on", async () => {
      mockStorageItems.set(reminderSettingsStorageKey, JSON.stringify({ foodEnabled: true }));

      await mountAndSettle();

      expect(record).toHaveBeenCalledWith(client, expect.arrayContaining(["nudge-me"]), false);
    });

    it("should refresh the achievement reads after something was recorded", async () => {
      record.mockResolvedValue(["first-bite"]);
      const invalidate = jest.spyOn(queryClient, "invalidateQueries");

      await mountAndSettle();

      expect(invalidate).toHaveBeenCalledWith({ queryKey: ["achievements"] });
    });
  });

  describe("the celebration queue", () => {
    it("should queue an id the database recorded as new, with the notification and whether the app was open", async () => {
      record.mockResolvedValue(["first-bite"]);

      await mountAndSettle();

      expect(getCelebrationState()).toEqual({
        entries: [{ id: "first-bite", isNew: true }],
        extras: { freezes: 1, levelName: null },
        notification: {
          title: "Badge earned: First Bite",
          body: "Logging your first food. +10 points. +1 freeze",
          achievementId: "first-bite",
        },
        wasActive: true,
        backfillSummary: null,
      });
    });

    it("should record that the app was in the background when the run finished", async () => {
      setAppState("background");
      record.mockResolvedValue(["first-bite"]);

      await mountAndSettle();

      expect(getCelebrationState().wasActive).toBe(false);
    });

    it("should queue an id once however many runs see it unseen", async () => {
      record.mockResolvedValueOnce(["first-bite"]);
      await mountAndSettle();
      fetchStats.mockResolvedValue(snapshotHolding([held("first-bite")]));

      await foreground();
      await foreground();

      expect(getCelebrationState().entries).toEqual([{ id: "first-bite", isNew: true }]);
    });

    it("should not queue it again once the screen has acknowledged it", async () => {
      record.mockResolvedValueOnce(["first-bite"]);
      await mountAndSettle();
      await act(async () => {
        acknowledgeCelebrations(["first-bite"]);
        await Promise.resolve();
      });
      fetchStats.mockResolvedValue(snapshotHolding([held("first-bite")]));

      await foreground();

      expect(getCelebrationState().entries).toEqual([]);
    });

    it("should not queue an unseen badge this device sent a notification for, after a restart", async () => {
      // The restart: the notification was posted by an earlier process, so the in-memory store starts empty.
      await rememberNotifiedIds("account-a", ["first-bite"]);
      fetchStats.mockResolvedValue(snapshotHolding([held("first-bite")]));

      await mountAndSettle();

      expect(getCelebrationState().entries).toEqual([]);
    });

    it("should forget a notified badge once the person has seen it, so it can never be held back", async () => {
      await rememberNotifiedIds("account-a", ["first-bite", "hat-trick"]);
      fetchStats.mockResolvedValue(
        snapshotHolding([held("first-bite", { seenAt: SEEN }), held("hat-trick")]),
      );

      await mountAndSettle();

      expect(
        JSON.parse(mockStorageItems.get(notifiedBadgesStorageKey("account-a")) ?? "[]"),
      ).toEqual(["hat-trick"]);
    });

    it("should keep the notified badges when reads go off and on again, as the terms gate does", async () => {
      await rememberNotifiedIds("account-a", ["first-bite"]);
      fetchStats.mockResolvedValue(snapshotHolding([held("first-bite")]));
      const { rerender } = await mountAndSettle();

      jest.mocked(useReadsEnabled).mockReturnValue(false);
      await rerender(undefined);
      jest.mocked(useReadsEnabled).mockReturnValue(true);
      await rerender(undefined);
      await settle();
      await foreground();

      expect(getCelebrationState().entries).toEqual([]);
    });

    it("should not hold back for this account a badge another account was notified of", async () => {
      await rememberNotifiedIds("account-b", ["first-bite"]);
      fetchStats.mockResolvedValue(snapshotHolding([held("first-bite")]));

      await mountAndSettle();

      expect(getCelebrationState().entries).toEqual([{ id: "first-bite", isNew: false }]);
    });

    it("should not queue as new an id another device already recorded and the person has seen", async () => {
      fetchStats.mockResolvedValue(snapshotHolding([held("first-bite", { seenAt: SEEN })]));
      record.mockResolvedValue([]);

      await mountAndSettle();

      expect(getCelebrationState().entries).toEqual([]);
      expect(getCelebrationState().notification).toBeNull();
    });

    it("should queue an unseen row from another device or the web, as not new and with no notification", async () => {
      fetchStats.mockResolvedValue(snapshotHolding([held("first-bite")]));

      await mountAndSettle();

      expect(getCelebrationState().entries).toEqual([{ id: "first-bite", isNew: false }]);
      expect(getCelebrationState().notification).toBeNull();
    });

    it("should queue nothing but the summary card for a row the web backfilled", async () => {
      fetchStats.mockResolvedValue(
        snapshotHolding([
          held("first-bite", { backfilled: true }),
          held("hat-trick", { backfilled: true }),
        ]),
      );

      await mountAndSettle();

      expect(getCelebrationState().entries).toEqual([]);
      expect(getCelebrationState().notification).toBeNull();
      expect(getCelebrationState().backfillSummary).toBe(2);
    });

    it("should leave the queue untouched when the stats cannot be read", async () => {
      record.mockResolvedValueOnce(["first-bite"]);
      await mountAndSettle();
      const before = getCelebrationState();
      fetchStats.mockRejectedValue(new Error("offline"));
      record.mockClear();

      await foreground();

      expect(getCelebrationState()).toBe(before);
      expect(record).not.toHaveBeenCalled();
    });

    it("should try again on the next trigger after a failed run, and queue no write for it", async () => {
      fetchStats.mockRejectedValueOnce(new Error("offline"));
      await mountAndSettle();
      expect(record).not.toHaveBeenCalled();

      await foreground();

      expect(fetchStats).toHaveBeenCalledTimes(2);
      expect(record).toHaveBeenCalledTimes(1);
    });

    it("should keep the celebration when the freeze ledger write fails after the badges were recorded", async () => {
      record.mockResolvedValue(["first-bite"]);
      appendFreezes.mockRejectedValueOnce(new Error("offline"));

      await mountAndSettle();

      expect(getCelebrationState().entries).toEqual([{ id: "first-bite", isNew: true }]);
    });
  });

  describe("the first backfill", () => {
    beforeEach(() => {
      readBackfilledAt.mockResolvedValue(null);
    });

    it("should record as a backfill, queue nothing, send nothing and store the summary", async () => {
      record.mockResolvedValue(["first-bite", "hat-trick", "set-the-course"]);

      await mountAndSettle();

      expect(record).toHaveBeenCalledWith(client, expect.arrayContaining(["first-bite"]), true);
      expect(getCelebrationState()).toEqual({
        entries: [],
        extras: null,
        notification: null,
        wasActive: true,
        backfillSummary: 3,
      });
    });

    it("should still record a backfill with nothing earned, because that is what marks it done", async () => {
      record.mockResolvedValue([]);

      await mountAndSettle();

      expect(record).toHaveBeenCalledWith(client, expect.any(Array), true);
      expect(getCelebrationState().backfillSummary).toBeNull();
    });
  });

  describe("an achievement event write", () => {
    it("should lead to exactly one more run, and no loop", async () => {
      const upsert = jest.fn(() => Promise.resolve({ error: null }));
      const eventClient = {
        from: jest.fn(() => ({ upsert })),
        auth: { onAuthStateChange: () => ({ data: { subscription: { unsubscribe: jest.fn() } } }) },
      };
      const view = await renderHook(
        () => {
          useAchievementSync("account-a");
          return useRecordAchievementEvent();
        },
        {
          // A stub that answers only what the provider and the event write call.
          wrapper: ({ children }: PropsWithChildren) => (
            <KeyLowProvider
              client={eventClient as unknown as ReturnType<typeof useSupabase>}
              queryClient={queryClient}
            >
              {children}
            </KeyLowProvider>
          ),
        },
      );
      await settle();
      expect(fetchStats).toHaveBeenCalledTimes(1);

      await act(async () => {
        view.result.current("week_view_opened");
        await jest.advanceTimersByTimeAsync(0);
      });
      await advance(2000);
      await advance(20000);

      expect(eventClient.from).toHaveBeenCalledWith("achievement_events");
      expect(upsert).toHaveBeenCalledTimes(1);
      expect(upsert).toHaveBeenCalledWith(
        { kind: "week_view_opened", ref: null },
        { onConflict: "user_id,kind,ref", ignoreDuplicates: true },
      );
      expect(fetchStats).toHaveBeenCalledTimes(2);
    });
  });
});
