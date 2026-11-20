import { act, renderHook, waitFor } from "@testing-library/react-native";
import { AppState } from "react-native";

import {
  mockExpoNotifications,
  notificationsState,
  resetNotificationsMock,
} from "./support/expoNotificationsMock";
import {
  getCelebrationState,
  getQueuedIds,
  recordCelebrations,
  resetCelebrations,
} from "../lib/achievements/celebrationStore";
import { notifiedBadgesStorageKey } from "../lib/achievements/notifiedBadges";
import { useUnlockNotificationPoster } from "../lib/reminderScheduler/useUnlockNotificationPoster";
import { reminderSettingsStorageKey } from "../lib/reminderSettings";

import type { CelebrationDecision } from "@keylow/core";
import type { AppStateStatus } from "react-native";

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
jest.mock(
  "expo-notifications",
  () =>
    jest.requireActual<typeof import("./support/expoNotificationsMock")>(
      "./support/expoNotificationsMock",
    ).mockExpoNotifications,
);

const hatTrick: CelebrationDecision = {
  entries: [{ id: "hat-trick", isNew: true }],
  extras: null,
  notification: {
    title: "Badge earned: Hat Trick",
    body: "3-day daily streak. +10 points",
    achievementId: "hat-trick",
  },
  backfillSummary: null,
};

const levelUpAlone: CelebrationDecision = {
  entries: [],
  extras: null,
  notification: { title: "Level 2 reached", body: "You reached Sapling", achievementId: null },
  backfillSummary: null,
};

const posted = () => [...notificationsState.scheduled.values()];

// `currentState` is a plain property of the module, so the test stands a getter in its place.
function setAppState(state: AppStateStatus) {
  Object.defineProperty(AppState, "currentState", { configurable: true, get: () => state });
}

async function mountPoster() {
  const view = await renderHook(() => {
    useUnlockNotificationPoster("account-a");
  });
  // Lets the saved settings load.
  await act(async () => {
    await Promise.resolve();
  });
  return view;
}

describe("posting the unlock notification", () => {
  beforeEach(() => {
    resetNotificationsMock();
    resetCelebrations();
    mockStorageItems.clear();
    notificationsState.permission = "granted";
    setAppState("background");
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("should remember the badges it posted for, so a restart does not toast them", async () => {
    await mountPoster();

    await act(() => {
      recordCelebrations(hatTrick, false);
    });

    await waitFor(() => {
      expect(
        JSON.parse(mockStorageItems.get(notifiedBadgesStorageKey("account-a")) ?? "[]"),
      ).toEqual(["hat-trick"]);
    });
  });

  it("should post the core's title and body once when a run records an unlock while the app is not active", async () => {
    await mountPoster();

    await act(() => {
      recordCelebrations(hatTrick, false);
    });

    await waitFor(() => {
      expect(posted()).toHaveLength(1);
    });
    expect(posted()[0]?.content).toMatchObject({
      title: "Badge earned: Hat Trick",
      body: "3-day daily streak. +10 points",
      data: { kind: "unlock", achievementId: "hat-trick" },
    });
  });

  it("should acknowledge the entries of the run it posted for, so the toast does not repeat them", async () => {
    await mountPoster();

    await act(() => {
      recordCelebrations(hatTrick, false);
    });

    await waitFor(() => {
      expect(getCelebrationState().entries).toEqual([]);
    });
  });

  it("should post a level-up with no badge once, and not again on a later render", async () => {
    const { rerender } = await mountPoster();

    await act(() => {
      recordCelebrations(levelUpAlone, false);
    });
    await waitFor(() => {
      expect(posted()).toHaveLength(1);
    });
    await rerender(undefined);
    await act(async () => {
      await Promise.resolve();
    });

    expect(posted()).toHaveLength(1);
    expect(posted()[0]?.content.data).toEqual({ kind: "unlock", achievementId: null });
  });

  it("should post one notification for a run that earned several badges", async () => {
    await mountPoster();

    await act(() => {
      recordCelebrations(
        {
          entries: [
            { id: "hat-trick", isNew: true },
            { id: "first-bite", isNew: true },
          ],
          extras: null,
          notification: {
            title: "2 badges earned: Hat Trick and First Bite",
            body: "+20 points",
            achievementId: "hat-trick",
          },
          backfillSummary: null,
        },
        false,
      );
    });

    await waitFor(() => {
      expect(posted()).toHaveLength(1);
    });
  });

  it("should post nothing while the app is active, and leave the entries for the toast", async () => {
    setAppState("active");
    await mountPoster();

    await act(() => {
      recordCelebrations(hatTrick, true);
    });

    expect(posted()).toEqual([]);
    expect(getCelebrationState().entries).toHaveLength(1);
  });

  it("should post nothing when the app is in the background but the run finished with the app in front", async () => {
    await mountPoster();

    await act(() => {
      recordCelebrations(hatTrick, true);
    });
    await act(async () => {
      await Promise.resolve();
    });

    expect(posted()).toEqual([]);
    expect(getCelebrationState().entries).toHaveLength(1);
  });

  it("should post nothing when the run finished in the background but the app is in front by now", async () => {
    setAppState("active");
    await mountPoster();

    await act(() => {
      recordCelebrations(hatTrick, false);
    });
    await act(async () => {
      await Promise.resolve();
    });

    // Not even asked, so the early check is what stopped it, not the one after the permission.
    expect(mockExpoNotifications.getPermissionsAsync).not.toHaveBeenCalled();
    expect(posted()).toEqual([]);
    expect(getCelebrationState().entries).toHaveLength(1);
  });

  it("should post nothing, and keep the entries for the toast, when the app comes to the front while the permission is read", async () => {
    let answer: (value: { status: "granted"; granted: true; canAskAgain: false }) => void = () =>
      undefined;
    mockExpoNotifications.getPermissionsAsync.mockReturnValueOnce(
      new Promise((resolve) => {
        answer = resolve;
      }),
    );
    await mountPoster();
    await act(() => {
      recordCelebrations(hatTrick, false);
    });

    setAppState("active");
    await act(async () => {
      answer({ status: "granted", granted: true, canAskAgain: false });
      await Promise.resolve();
    });

    expect(posted()).toEqual([]);
    expect(getCelebrationState().entries).toHaveLength(1);
  });

  it("should post and acknowledge nothing when the account changes while the permission is read", async () => {
    let answer: (value: { status: "granted"; granted: true; canAskAgain: false }) => void = () =>
      undefined;
    mockExpoNotifications.getPermissionsAsync.mockReturnValueOnce(
      new Promise((resolve) => {
        answer = resolve;
      }),
    );
    await mountPoster();
    await act(() => {
      recordCelebrations(hatTrick, false);
    });

    await act(() => {
      resetCelebrations();
    });
    await act(async () => {
      answer({ status: "granted", granted: true, canAskAgain: false });
      await Promise.resolve();
    });

    expect(posted()).toEqual([]);
    expect(getQueuedIds()).toEqual([]);
  });

  it("should post nothing when Badges and levels is off, and leave the entries for the toast", async () => {
    mockStorageItems.set(reminderSettingsStorageKey, JSON.stringify({ badgesEnabled: false }));
    await mountPoster();

    await act(() => {
      recordCelebrations(hatTrick, false);
    });

    expect(posted()).toEqual([]);
    expect(getCelebrationState().entries).toHaveLength(1);
  });

  it("should leave a held badge for the toast when it posts for the badges this device recorded", async () => {
    await mountPoster();

    await act(() => {
      recordCelebrations(
        {
          ...hatTrick,
          entries: [
            { id: "hat-trick", isNew: true },
            { id: "first-bite", isNew: false },
          ],
        },
        false,
      );
    });

    await waitFor(() => {
      expect(posted()).toHaveLength(1);
    });
    expect(getCelebrationState().entries).toEqual([{ id: "first-bite", isNew: false }]);
  });

  it("should not post a notification that was not posted, such as one the switch was off for, when a later run arrives", async () => {
    mockStorageItems.set(reminderSettingsStorageKey, JSON.stringify({ badgesEnabled: false }));
    const view = await mountPoster();
    await act(() => {
      recordCelebrations(levelUpAlone, false);
    });
    expect(getCelebrationState().notification).toBeNull();

    mockStorageItems.set(reminderSettingsStorageKey, JSON.stringify({ badgesEnabled: true }));
    await view.rerender({});
    await act(() => {
      recordCelebrations(
        { entries: [], extras: null, notification: null, backfillSummary: 5 },
        false,
      );
    });
    await act(async () => {
      await Promise.resolve();
    });

    expect(posted()).toEqual([]);
  });

  it("should drop a level-up that came while the app was in front, so a later background run cannot post it", async () => {
    setAppState("active");
    await mountPoster();
    await act(() => {
      recordCelebrations(levelUpAlone, true);
    });

    expect(getCelebrationState().notification).toBeNull();
  });

  it("should post nothing for a backfill run, which has no notification, and not acknowledge its summary", async () => {
    await mountPoster();

    await act(() => {
      recordCelebrations(
        { entries: [], extras: null, notification: null, backfillSummary: 12 },
        false,
      );
    });

    expect(posted()).toEqual([]);
    expect(getCelebrationState().backfillSummary).toBe(12);
  });

  it("should post nothing for held badges this device did not record, which carry no notification", async () => {
    await mountPoster();

    await act(() => {
      recordCelebrations(
        {
          entries: [{ id: "hat-trick", isNew: false }],
          extras: null,
          notification: null,
          backfillSummary: null,
        },
        false,
      );
    });

    expect(posted()).toEqual([]);
    expect(getCelebrationState().entries).toHaveLength(1);
  });

  it("should post nothing, and keep the entries for the toast, when notifications are not allowed", async () => {
    notificationsState.permission = "denied";
    await mountPoster();

    await act(() => {
      recordCelebrations(hatTrick, false);
    });
    await act(async () => {
      await Promise.resolve();
    });

    expect(posted()).toEqual([]);
    expect(getCelebrationState().entries).toHaveLength(1);
  });

  it("should keep the entries for the toast when the notification cannot be posted", async () => {
    jest.spyOn(console, "warn").mockImplementation(() => undefined);
    mockExpoNotifications.scheduleNotificationAsync.mockRejectedValueOnce(new Error("no"));
    await mountPoster();

    await act(() => {
      recordCelebrations(hatTrick, false);
    });
    await act(async () => {
      await Promise.resolve();
    });

    expect(getCelebrationState().entries).toHaveLength(1);
  });
});
