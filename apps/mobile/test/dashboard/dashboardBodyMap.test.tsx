import { KeyLowProvider, keys } from "@keylow/api-client";
import { buildSetSnapshot } from "@keylow/core/training";
import { onlineManager } from "@tanstack/react-query";
import { act, cleanup, render, screen } from "@testing-library/react-native";
import { setUpTests } from "react-native-reanimated";

import { DashboardBodyMap } from "../../components/DashboardScreen/DashboardBodyMap";
import { ThemeProvider } from "../../lib/theme";
import {
  createDiaryQueryClient,
  diaryBackend,
  diaryClient,
  requestsTo,
  resetDiaryBackend,
} from "../support/diaryBackend";
import { compileKitStyles } from "../support/kitStyles";
import { registerAppStyles } from "../support/nativeWindStyles";

import type { ActiveRoutine, TrainingSet } from "@keylow/api-client";
import type { QueryClient } from "@tanstack/react-query";

jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: { getItem: () => Promise.resolve(null), setItem: () => Promise.resolve() },
}));

// 17:55 in London on Thursday 15 October 2026. A test moves the clock with `moveClockTo`.
let mockNow = new Date("2026-10-15T16:55:00Z");
const mockClockListeners = new Set<() => void>();
jest.mock("../../lib/useNow", () => {
  const { useSyncExternalStore } = jest.requireActual<typeof import("react")>("react");

  return {
    useNow: () =>
      useSyncExternalStore(
        (listener: () => void) => {
          mockClockListeners.add(listener);

          return () => {
            mockClockListeners.delete(listener);
          };
        },
        () => mockNow,
      ),
  };
});

async function moveClockTo(instant: string) {
  await act(() => {
    mockNow = new Date(instant);
    for (const listener of mockClockListeners) {
      listener();
    }
  });
}

setUpTests();

const START_DAY = "2026-09-30";
const WEEK_START = "2026-10-12";
const LATS_EXERCISE_ID = "77777777-7777-4777-8777-777777777777";
const SQUAT_EXERCISE_ID = "66666666-6666-4666-8666-666666666666";

const latsSnapshot = buildSetSnapshot(
  { id: LATS_EXERCISE_ID, name: "Row", equipment: "barbell", mechanic: "compound" },
  [{ muscle_id: "lats", role: "primary", weight: 1 }],
);

// One hard set of rows, two hours before the clock starts.
const trainingSets: TrainingSet[] = [
  {
    id: "99999999-9999-4999-8999-000000000001",
    session_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    exercise_id: LATS_EXERCISE_ID,
    set_type: "working",
    rir: 0,
    rpe: null,
    performed_at: "2026-10-15T14:55:00+00:00",
    snapshot: latsSnapshot,
    deleted_at: null,
  },
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

/** What an online open left in the cache of the phone: the zone, the routine, the sets and the week. */
function seedCachedRows() {
  queryClient.setQueryData(keys.profiles.timeZone, "Europe/London");
  queryClient.setQueryData(keys.training.activeRoutine, legsRoutine);
  queryClient.setQueryData(keys.training.sets(START_DAY), trainingSets);
  queryClient.setQueryData(keys.training.weekSessions(WEEK_START), []);
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

describe("DashboardBodyMap", () => {
  let kitStyles: string;

  beforeAll(async () => {
    kitStyles = await compileKitStyles("", ["components/DashboardScreen"]);
  });

  beforeEach(() => {
    mockNow = new Date("2026-10-15T16:55:00Z");
    registerAppStyles(kitStyles);
    resetDiaryBackend();
    queryClient = createDiaryQueryClient();
  });

  afterEach(async () => {
    await cleanup();
    await act(() => {
      onlineManager.setOnline(true);
    });
    queryClient.clear();
  });

  describe("with the rows cached", () => {
    it("should show the warmest muscle and today's planned day from the rows", async () => {
      seedCachedRows();
      await renderCard();

      expect(
        await screen.findByLabelText(
          "Body map, Actual heat now. Warmest: lats 9 percent. Today: Legs, 16 sets planned. Open the body map",
        ),
      ).toBeOnTheScreen();
    });

    it("should still show them with no connection, from the rows alone", async () => {
      seedCachedRows();
      await act(() => {
        onlineManager.setOnline(false);
      });
      await renderCard();

      expect(await screen.findByText("Today: Legs", hidden)).toBeOnTheScreen();
      expect(screen.getByText(/^Warmest: lats/, hidden)).toBeOnTheScreen();
    });

    it("should work the heat out at the current time, so the same rows cool as the clock moves on", async () => {
      seedCachedRows();
      await renderCard();
      expect(await screen.findByText("Warmest: lats 9 %", hidden)).toBeOnTheScreen();

      await moveClockTo("2026-10-16T16:55:00Z");

      expect(screen.getByText("Warmest: lats 4 %", hidden)).toBeOnTheScreen();
    });
  });

  describe("offline with no rows saved", () => {
    it("should say the body map is not available offline, and not load for ever", async () => {
      await act(() => {
        onlineManager.setOnline(false);
      });
      await renderCard();

      expect(await screen.findByText("The body map isn't available offline.")).toBeOnTheScreen();
      expect(screen.queryByRole("status")).not.toBeOnTheScreen();
    });
  });

  describe("while the rows are on their way", () => {
    it("should be a status named for what is loading", async () => {
      diaryBackend.hungTables.add("workout_sets");
      diaryBackend.hungTables.add("routines");
      await renderCard();

      expect(await screen.findByRole("status", { name: "Loading the body map" })).toBeOnTheScreen();
    });

    it("should make no request while the terms gate is up", async () => {
      await renderCard(false);

      expect(requestsTo("workout_sets")).toBe(0);
      expect(requestsTo("routines")).toBe(0);
    });
  });

  describe("when a read fails", () => {
    it("should say so in a quiet line, with no figure and no value", async () => {
      queryClient.setQueryData(keys.profiles.timeZone, "Europe/London");
      queryClient.setQueryData(keys.training.activeRoutine, legsRoutine);
      diaryBackend.failingTables.add("workout_sets");
      await renderCard();

      expect(await screen.findByText("Couldn't load the body map")).toBeOnTheScreen();
      expect(screen.queryAllByRole("img", hidden)).toHaveLength(0);
      expect(screen.queryByLabelText(/^Body map, Actual heat now/)).not.toBeOnTheScreen();
    });
  });
});
