import { KeyLowProvider, keys } from "@keylow/api-client";
import { buildSetSnapshot } from "@keylow/core/training";
import { onlineManager } from "@tanstack/react-query";
import { act, cleanup, render, screen, userEvent, within } from "@testing-library/react-native";
import { Pressable, Text } from "react-native";
import { setUpTests } from "react-native-reanimated";

import { DashboardBodyMap } from "../../components/DashboardScreen/DashboardBodyMap";
import { useDashboardBodyChart } from "../../lib/dashboardBodyChart";
import { resetDashboardBodyChartForTests } from "../../lib/dashboardBodyChart/testing";
import { ThemeProvider } from "../../lib/theme";
import {
  createDiaryQueryClient,
  diaryBackend,
  diaryClient,
  requestsTo,
  resetDiaryBackend,
} from "../support/diaryBackend";
import { resetRouterMock, routerMock } from "../support/expoRouterMock";
import { fillsIn, volumeFill } from "../support/figureFills";
import { compileKitStyles } from "../support/kitStyles";
import { registerAppStyles } from "../support/nativeWindStyles";

import type { ActiveRoutine, TrainingSet, WeekSession } from "@keylow/api-client";
import type { QueryClient } from "@tanstack/react-query";

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
  "expo-router",
  () => jest.requireActual<{ mockExpoRouter: unknown }>("../support/expoRouterMock").mockExpoRouter,
);

// 17:55 in London on Thursday 15 October 2026.
let mockNow = new Date("2026-10-15T16:55:00Z");
jest.mock("../../lib/useNow", () => ({ useNow: () => mockNow }));

setUpTests();

// The numbers are the encodings of core's `VOLUME_STATUSES`.
const NOT_TRAINED = 0;
const GROWING = 2;

const START_DAY = "2026-09-30";
const WEEK_START = "2026-10-12";
const LATS_EXERCISE_ID = "77777777-7777-4777-8777-777777777777";
const SQUAT_EXERCISE_ID = "66666666-6666-4666-8666-666666666666";

const latsSnapshot = buildSetSnapshot(
  { id: LATS_EXERCISE_ID, name: "Row", equipment: "barbell", mechanic: "compound" },
  [{ muscle_id: "lats", role: "primary", weight: 1 }],
);

function latsSet(id: number, performedAt: string): TrainingSet {
  return {
    id: `99999999-9999-4999-8999-${String(id).padStart(12, "0")}`,
    session_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    exercise_id: LATS_EXERCISE_ID,
    set_type: "working",
    rir: 0,
    rpe: null,
    performed_at: performedAt,
    snapshot: latsSnapshot,
    deleted_at: null,
  };
}

// Four hard sets of rows on Thursday, which take the lats to Growing this week (Monday 12 October).
const thisWeekSets: TrainingSet[] = [
  latsSet(1, "2026-10-15T14:10:00+00:00"),
  latsSet(2, "2026-10-15T14:25:00+00:00"),
  latsSet(3, "2026-10-15T14:40:00+00:00"),
  latsSet(4, "2026-10-15T14:55:00+00:00"),
];
// The same four sets the Friday before, which is last week and so counts for nothing in this one.
const lastWeekSets: TrainingSet[] = [
  latsSet(5, "2026-10-09T14:55:00+00:00"),
  latsSet(6, "2026-10-09T15:10:00+00:00"),
  latsSet(7, "2026-10-09T15:25:00+00:00"),
  latsSet(8, "2026-10-09T15:40:00+00:00"),
];

// Legs on Thursday, with 16 sets planned.
const legsRoutine: ActiveRoutine = {
  id: "88888888-8888-4888-8888-888888888888",
  name: "Push Pull Legs",
  activatedAt: null,
  days: [
    {
      id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
      name: "Legs",
      position: 0,
      weekday: 3,
      exercises: [
        {
          id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
          position: 0,
          exercise_id: SQUAT_EXERCISE_ID,
          target_sets: 16,
          target_rir: 2,
          exercise: {
            id: SQUAT_EXERCISE_ID,
            name: "Squat",
            equipment: "barbell",
            mechanic: "compound",
          },
          muscles: [{ muscle_id: "quads", role: "primary", weight: 1 }],
        },
      ],
    },
  ],
};

let queryClient: QueryClient;

// The body map reads its sets from 15 days before the Monday, the Dashboard's heat from 15 days before today.
const BODY_MAP_START_DAY = "2026-09-27";

/** What an online open left in the cache of the phone: the zone, the routine, the sets and the week. */
function seedCachedRows(trainingSets: TrainingSet[] = thisWeekSets) {
  seedHeatRows(trainingSets);
  queryClient.setQueryData(keys.training.sets(BODY_MAP_START_DAY), trainingSets);
  queryClient.setQueryData(keys.training.acceptedSuggestions(WEEK_START), {
    suggestions: [],
    skipped: [],
  });
}

// The volume is the week's sessions, so the sets that count are the ones a session of the week holds.
function weekSessionsOf(trainingSets: TrainingSet[]): WeekSession[] {
  const weekSets = trainingSets.filter((set) => set.performed_at >= "2026-10-12");
  return weekSets.length === 0
    ? []
    : [
        {
          id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
          local_date: "2026-10-15",
          // Legs is under way, which the card still writes as Legs with its 16 sets planned.
          routine_day_id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
          started_at: "2026-10-15T14:00:00+00:00",
          ended_at: null,
          deleted_at: null,
          sets: weekSets,
        },
      ];
}

/** What the Dashboard's heat alone left in the cache: no rows of the body map's own. */
function seedHeatRows(trainingSets: TrainingSet[] = thisWeekSets) {
  queryClient.setQueryData(keys.profiles.timeZone, "Europe/London");
  queryClient.setQueryData(keys.training.activeRoutine, legsRoutine);
  queryClient.setQueryData(keys.training.goals, null);
  queryClient.setQueryData(keys.training.sets(START_DAY), trainingSets);
  queryClient.setQueryData(keys.training.weekSessions(WEEK_START), weekSessionsOf(trainingSets));
}

async function renderCard(isReadEnabled = true) {
  await render(
    <ThemeProvider fixedPreference="dark">
      <KeyLowProvider client={diaryClient} queryClient={queryClient}>
        <DashboardBodyMap isReadEnabled={isReadEnabled} />
      </KeyLowProvider>
    </ThemeProvider>,
  );
}

const hidden = { includeHiddenElements: true };

const volumeName =
  "Body map, weekly volume, Actual this week, Monday to Sunday. 1 of 22 muscles at Growing or above. Today: Legs, 16 sets planned. Open the body map on Volume";
const heatName = /^Body map, Actual heat now\./;

// Stands in for the More row: it changes the choice the card follows, and nothing else.
function ChooseVolume() {
  const { setChart } = useDashboardBodyChart();

  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => {
        setChart("volume");
      }}
    >
      <Text>Choose weekly volume</Text>
    </Pressable>
  );
}

async function renderCardWithSwitch() {
  await render(
    <ThemeProvider fixedPreference="dark">
      <KeyLowProvider client={diaryClient} queryClient={queryClient}>
        <DashboardBodyMap isReadEnabled />
        <ChooseVolume />
      </KeyLowProvider>
    </ThemeProvider>,
  );
}

describe("DashboardBodyMap with the chart chosen in More", () => {
  let kitStyles: string;

  beforeAll(async () => {
    kitStyles = await compileKitStyles("", [
      "components/DashboardScreen",
      "components/BodyMapLegend",
    ]);
  });

  beforeEach(() => {
    mockStorageItems.clear();
    mockNow = new Date("2026-10-15T16:55:00Z");
    registerAppStyles(kitStyles);
    resetDiaryBackend();
    resetRouterMock();
    resetDashboardBodyChartForTests();
    queryClient = createDiaryQueryClient();
  });

  afterEach(async () => {
    await cleanup();
    await act(() => {
      onlineManager.setOnline(true);
    });
    queryClient.clear();
  });

  describe("on a fresh install", () => {
    it("should show the Heat card, as it always has", async () => {
      seedCachedRows();
      await renderCard();

      expect(await screen.findByLabelText(heatName)).toBeOnTheScreen();
      expect(screen.queryByLabelText(/weekly volume/)).not.toBeOnTheScreen();
    });

    it("should open the body map on Heat when the card is pressed", async () => {
      const user = userEvent.setup();
      seedCachedRows();
      await renderCard();

      await user.press(await screen.findByLabelText(heatName));

      expect(routerMock.push).toHaveBeenCalledWith("/body-map");
    });
  });

  describe("with Weekly volume chosen", () => {
    beforeEach(() => {
      mockStorageItems.set("dashboard.bodyChart", "volume");
    });

    it("should show this week's volume from the cached rows, with today's plan", async () => {
      seedCachedRows();
      await renderCard();

      expect(await screen.findByLabelText(volumeName)).toBeOnTheScreen();
      expect(screen.getByText("Actual · this week", hidden)).toBeOnTheScreen();
    });

    it("should colour the muscles as the body map screen colours Volume Actual at the same moment", async () => {
      seedCachedRows();
      await renderCard();
      const card = await screen.findByLabelText(volumeName);
      const back = within(card).getByRole("img", {
        name: "Body map, Actual, weekly sets, back",
        ...hidden,
      });

      expect(fillsIn(back, "back").get("lats")).toEqual(volumeFill("dark", GROWING));
      expect(fillsIn(back, "back").get("traps_mid")).toEqual(volumeFill("dark", NOT_TRAINED));
    });

    it("should open the body map on Volume when the card is pressed", async () => {
      const user = userEvent.setup();
      seedCachedRows();
      await renderCard();

      await user.press(await screen.findByLabelText(volumeName));

      expect(routerMock.push).toHaveBeenCalledWith("/body-map?scale=volume");
    });

    it("should show the empty form, not the Heat card's 14 day message, when nothing was logged since Monday", async () => {
      seedCachedRows(lastWeekSets);
      await renderCard();

      expect(
        await screen.findByLabelText(
          "Body map, weekly volume, Actual this week, Monday to Sunday. No sets yet this week. Today: Legs, 16 sets planned. Open the body map on Volume",
        ),
      ).toBeOnTheScreen();
      expect(screen.queryByText(/Nothing logged in the last/, hidden)).not.toBeOnTheScreen();
    });

    it("should move the bands when a set is logged, from the rows already held, with no new request", async () => {
      seedCachedRows(lastWeekSets);
      await renderCard();
      await screen.findByLabelText(/No sets yet this week/);
      const requestsBefore = requestsTo("workout_sets");

      await act(() => {
        queryClient.setQueryData(keys.training.sets(BODY_MAP_START_DAY), thisWeekSets);
        queryClient.setQueryData(
          keys.training.weekSessions(WEEK_START),
          weekSessionsOf(thisWeekSets),
        );
      });

      expect(await screen.findByLabelText(volumeName)).toBeOnTheScreen();
      expect(requestsTo("workout_sets")).toBe(requestsBefore);
    });

    it("should still show with no connection, from the rows the Dashboard's heat left", async () => {
      seedHeatRows();
      await act(() => {
        onlineManager.setOnline(false);
      });
      await renderCard();

      expect(await screen.findByLabelText(volumeName)).toBeOnTheScreen();
    });

    it("should say the body map is not available offline when nothing is cached", async () => {
      await act(() => {
        onlineManager.setOnline(false);
      });
      await renderCard();

      expect(await screen.findByText("The body map isn't available offline.")).toBeOnTheScreen();
    });

    it("should say it could not load when a read fails", async () => {
      queryClient.setQueryData(keys.profiles.timeZone, "Europe/London");
      queryClient.setQueryData(keys.training.activeRoutine, legsRoutine);
      queryClient.setQueryData(keys.training.goals, null);
      diaryBackend.failingTables.add("workout_sets");
      await renderCard();

      expect(await screen.findByText("Couldn't load the body map")).toBeOnTheScreen();
    });

    it("should say it could not load when only today's read fails, with this week's volume rows all cached", async () => {
      // The Heat read starts its sets 15 days before today, a key the body map's rows never use, so it is
      // the one read left to fail here.
      queryClient.setQueryData(keys.profiles.timeZone, "Europe/London");
      queryClient.setQueryData(keys.training.activeRoutine, legsRoutine);
      queryClient.setQueryData(keys.training.goals, null);
      queryClient.setQueryData(keys.training.sets(BODY_MAP_START_DAY), thisWeekSets);
      queryClient.setQueryData(
        keys.training.weekSessions(WEEK_START),
        weekSessionsOf(thisWeekSets),
      );
      queryClient.setQueryData(keys.training.acceptedSuggestions(WEEK_START), {
        suggestions: [],
        skipped: [],
      });
      diaryBackend.failingTables.add("workout_sets");
      await renderCard();

      expect(await screen.findByText("Couldn't load the body map")).toBeOnTheScreen();
    });

    it("should draw the week of the profile's zone, not the UTC week, when the two differ", async () => {
      // Sunday 20:00 UTC is Monday 09:00 in Auckland, so the week is the one that starts on Monday
      // 12 October there, and UTC is still in the week that began on the 5th.
      mockNow = new Date("2026-10-11T20:00:00Z");
      const mondaySets = [
        latsSet(11, "2026-10-11T19:10:00+00:00"),
        latsSet(12, "2026-10-11T19:25:00+00:00"),
        latsSet(13, "2026-10-11T19:40:00+00:00"),
        latsSet(14, "2026-10-11T19:55:00+00:00"),
      ];
      queryClient.setQueryData(keys.profiles.timeZone, "Pacific/Auckland");
      queryClient.setQueryData(keys.training.activeRoutine, legsRoutine);
      queryClient.setQueryData(keys.training.goals, null);
      // Fifteen days before Monday 12 October, for the body map's rows and for the heat's, which start on the same day.
      queryClient.setQueryData(keys.training.sets("2026-09-27"), mondaySets);
      queryClient.setQueryData(keys.training.weekSessions("2026-10-12"), [
        {
          ...weekSessionsOf(thisWeekSets)[0],
          local_date: "2026-10-12",
          started_at: "2026-10-11T19:00:00+00:00",
          sets: mondaySets,
        },
      ]);
      queryClient.setQueryData(keys.training.acceptedSuggestions("2026-10-12"), {
        suggestions: [],
        skipped: [],
      });
      // The fake backend holds none of these rows, and its profile is in London, so a refetch would replace
      // the cached ones, and the zone, with its own.
      for (const table of [
        "profiles",
        "workout_sets",
        "workout_sessions",
        "routines",
        "accepted_suggestions",
      ]) {
        diaryBackend.hungTables.add(table);
      }
      await renderCard();

      expect(await screen.findByLabelText(/1 of 22 muscles at Growing or above/)).toBeOnTheScreen();
    });

    it("should make no request while the terms gate is up", async () => {
      await renderCard(false);

      expect(requestsTo("workout_sets")).toBe(0);
    });
  });

  describe("while the choice is being read", () => {
    it("should show the skeleton and never draw the wrong chart first", async () => {
      seedCachedRows();
      mockStorageItems.set("dashboard.bodyChart", "volume");
      const realGetItem = jest.requireMock<{
        default: { getItem: (key: string) => Promise<string | null> };
      }>("@react-native-async-storage/async-storage").default.getItem;
      let answer: (value: string | null) => void = () => undefined;
      jest
        .spyOn(
          jest.requireMock<{ default: { getItem: (key: string) => Promise<string | null> } }>(
            "@react-native-async-storage/async-storage",
          ).default,
          "getItem",
        )
        .mockImplementation((key) =>
          key === "dashboard.bodyChart"
            ? new Promise<string | null>((resolve) => {
                answer = resolve;
              })
            : realGetItem(key),
        );
      await renderCard();

      expect(await screen.findByRole("status", { name: "Loading the body map" })).toBeOnTheScreen();
      expect(screen.queryByLabelText(heatName)).not.toBeOnTheScreen();

      await act(() => {
        answer("volume");
      });

      expect(await screen.findByLabelText(volumeName)).toBeOnTheScreen();
      expect(screen.queryByLabelText(heatName)).not.toBeOnTheScreen();
    });
  });

  describe("when the choice changes while the dashboard is up", () => {
    it("should change the card to Weekly volume with no reload", async () => {
      const user = userEvent.setup();
      seedCachedRows();
      await renderCardWithSwitch();
      await screen.findByLabelText(heatName);

      await user.press(screen.getByRole("button", { name: "Choose weekly volume" }));

      expect(await screen.findByLabelText(volumeName)).toBeOnTheScreen();
      expect(screen.queryByLabelText(heatName)).not.toBeOnTheScreen();
    });
  });
});
