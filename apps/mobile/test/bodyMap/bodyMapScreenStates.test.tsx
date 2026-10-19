import { KeyLowProvider, keys } from "@keylow/api-client";
import { buildSetSnapshot } from "@keylow/core/training";
import { onlineManager } from "@tanstack/react-query";
import { act, cleanup, render, screen, userEvent, waitFor } from "@testing-library/react-native";
import { setUpTests } from "react-native-reanimated";

import { BodyMapScreen } from "../../components/BodyMapScreen";
import { ThemeProvider } from "../../lib/theme";
import {
  createDiaryQueryClient,
  diaryBackend,
  diaryClient,
  requestsTo,
  resetDiaryBackend,
} from "../support/diaryBackend";
import { resetRouterMock } from "../support/expoRouterMock";
import { fillsIn, heatFill } from "../support/figureFills";
import { compileKitStyles } from "../support/kitStyles";
import { registerAppStyles } from "../support/nativeWindStyles";

import type { ActiveRoutine, TrainingSet } from "@keylow/api-client";
import type { QueryClient } from "@tanstack/react-query";

jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: { getItem: () => Promise.resolve(null), setItem: () => Promise.resolve() },
}));
jest.mock(
  "expo-router",
  () => jest.requireActual<{ mockExpoRouter: unknown }>("../support/expoRouterMock").mockExpoRouter,
);
jest.mock(
  "react-native-safe-area-context",
  () =>
    jest.requireActual<{ default: unknown }>("react-native-safe-area-context/jest/mock").default,
);
// 19:00 in London on Thursday 15 October 2026.
jest.mock("../../lib/useNow", () => ({
  useNow: () => new Date("2026-10-15T18:00:00Z"),
}));

setUpTests();

// The sets are read from 15 days before the Monday of the week.
const SETS_WINDOW_START = "2026-09-27";
const WEEK_START = "2026-10-12";
const LATS_EXERCISE_ID = "77777777-7777-4777-8777-777777777777";

const noRoutineDays: ActiveRoutine = {
  id: "88888888-8888-4888-8888-888888888888",
  name: "Push Pull Legs",
  activatedAt: null,
  days: [],
};

// One hard set of rows, three hours before the clock.
const latsSet: TrainingSet = {
  id: "99999999-9999-4999-8999-000000000001",
  session_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  exercise_id: LATS_EXERCISE_ID,
  set_type: "working",
  rir: 0,
  rpe: null,
  performed_at: "2026-10-15T15:00:00+00:00",
  snapshot: buildSetSnapshot(
    { id: LATS_EXERCISE_ID, name: "Row", equipment: "barbell", mechanic: "compound" },
    [{ muscle_id: "lats", role: "primary", weight: 1 }],
  ),
  deleted_at: null,
};

let queryClient: QueryClient;

/** What an online open left in the cache of the phone: the zone, the routine, the week and the sets. */
function seedCachedRows(sets: TrainingSet[]) {
  queryClient.setQueryData(keys.profiles.timeZone, "Europe/London");
  queryClient.setQueryData(keys.training.activeRoutine, noRoutineDays);
  queryClient.setQueryData(keys.training.goals, null);
  queryClient.setQueryData(keys.training.weekSessions(WEEK_START), []);
  queryClient.setQueryData(keys.training.sets(SETS_WINDOW_START), sets);
}

async function renderScreen() {
  await render(
    <ThemeProvider fixedPreference="dark">
      <KeyLowProvider client={diaryClient} queryClient={queryClient}>
        <BodyMapScreen />
      </KeyLowProvider>
    </ThemeProvider>,
  );
}

describe("the body map screen's states", () => {
  let kitStyles: string;

  beforeAll(async () => {
    kitStyles = await compileKitStyles("", [
      "components/BodyMapScreen",
      "components/BodyMapCard",
      "components/BodyMapLegend",
      "components/ViewLabel",
    ]);
  });

  beforeEach(() => {
    registerAppStyles(kitStyles);
    resetRouterMock();
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

  describe("with sets logged", () => {
    it("should warm the muscle that was trained, from the cached rows", async () => {
      seedCachedRows([latsSet]);
      await renderScreen();

      const back = fillsIn(await screen.findByRole("img", { name: /, back$/ }), "back");

      expect(back.get("lats")).not.toEqual(heatFill("dark", 0));
      expect(back.get("traps_upper")).toEqual(heatFill("dark", 0));
    });

    it("should show the legend and no empty state", async () => {
      seedCachedRows([latsSet]);
      await renderScreen();

      expect(await screen.findByRole("group", { name: "Heat legend" })).toBeOnTheScreen();
      expect(screen.queryByText("Nothing to show yet")).not.toBeOnTheScreen();
    });

    it("should work with no connection, from the rows the phone holds", async () => {
      seedCachedRows([latsSet]);
      // The phone keeps the answer to the terms too, as the gate's own query is persisted.
      queryClient.setQueryData(keys.profiles.termsAcceptance, diaryBackend.terms);
      await act(() => {
        onlineManager.setOnline(false);
      });
      await renderScreen();

      expect(await screen.findByRole("img", { name: /, front$/ })).toBeOnTheScreen();
      expect(screen.queryByText("The body map isn't available offline.")).not.toBeOnTheScreen();
    });
  });

  describe("with nothing logged in the last 14 days", () => {
    beforeEach(() => {
      seedCachedRows([]);
    });

    it("should say so under the view label, which still reads Actual", async () => {
      await renderScreen();

      expect(await screen.findByRole("status", { name: "Actual" })).toBeOnTheScreen();
      expect(screen.getByText("Nothing logged in the last 14 days")).toBeOnTheScreen();
    });

    it("should draw both figures at rest", async () => {
      await renderScreen();

      for (const side of ["front", "back"] as const) {
        const figure = await screen.findByRole("img", { name: `Body map, Actual, heat, ${side}` });
        const fills = fillsIn(figure, side);
        expect(fills.size).toBeGreaterThan(0);
        for (const fill of fills.values()) {
          expect(fill).toEqual(heatFill("dark", 0));
        }
      }
    });

    it("should show the empty state: Nothing to show yet, and why", async () => {
      await renderScreen();

      expect(await screen.findByRole("heading", { name: "Nothing to show yet" })).toBeOnTheScreen();
      expect(
        screen.getByText(
          "Log a session and the muscles you train warm up here, then cool over a day or two as they recover.",
        ),
      ).toBeOnTheScreen();
    });

    it("should hide the legend, which has nothing to colour", async () => {
      await renderScreen();
      await screen.findByRole("heading", { name: "Nothing to show yet" });

      expect(screen.queryByRole("group", { name: "Heat legend" })).not.toBeOnTheScreen();
    });

    it("should have no Start a session button, because the Train tab it would open is not mounted", async () => {
      await renderScreen();
      await screen.findByRole("heading", { name: "Nothing to show yet" });

      expect(screen.queryByRole("button", { name: "Start a session" })).not.toBeOnTheScreen();
      expect(screen.queryByText("Start a session")).not.toBeOnTheScreen();
    });

    it("should leave nothing to press but Back, so no figure is interactive", async () => {
      await renderScreen();
      await screen.findByRole("heading", { name: "Nothing to show yet" });

      expect(screen.getAllByRole("button")).toHaveLength(1);
      expect(screen.getByRole("button", { name: "Back" })).toBeOnTheScreen();
    });
  });

  describe("while the rows are on their way", () => {
    it("should be a status named for what is loading, with the header already there", async () => {
      queryClient.setQueryData(keys.profiles.timeZone, "Europe/London");
      diaryBackend.hungTables.add("workout_sets");
      diaryBackend.hungTables.add("routines");
      await renderScreen();

      expect(await screen.findByRole("status", { name: "Loading the body map" })).toBeOnTheScreen();
      expect(screen.getByRole("heading", { name: "Body map" })).toBeOnTheScreen();
      expect(screen.queryAllByRole("img")).toHaveLength(0);
    });

    it("should make no request while the terms gate is up", async () => {
      diaryBackend.terms = { terms_accepted_at: null, terms_version: null };
      queryClient.setQueryData(keys.profiles.timeZone, "Europe/London");
      await renderScreen();

      await waitFor(() => {
        expect(screen.getByRole("status", { name: "Loading the body map" })).toBeOnTheScreen();
      });
      expect(requestsTo("workout_sets")).toBe(0);
      expect(requestsTo("routines")).toBe(0);
    });
  });

  describe("offline with no rows saved", () => {
    it("should say the body map is not available offline, and not load for ever", async () => {
      queryClient.setQueryData(keys.profiles.timeZone, "Europe/London");
      await act(() => {
        onlineManager.setOnline(false);
      });
      await renderScreen();

      expect(await screen.findByText("The body map isn't available offline.")).toBeOnTheScreen();
      expect(screen.queryByRole("status", { name: "Loading the body map" })).not.toBeOnTheScreen();
    });
  });

  describe("when a read fails", () => {
    beforeEach(() => {
      queryClient.setQueryData(keys.profiles.timeZone, "Europe/London");
      queryClient.setQueryData(keys.training.activeRoutine, noRoutineDays);
      queryClient.setQueryData(keys.training.goals, null);
      queryClient.setQueryData(keys.training.weekSessions(WEEK_START), []);
      diaryBackend.failingTables.add("workout_sets");
    });

    it("should say the training did not load, with no figure and no value", async () => {
      await renderScreen();

      expect(await screen.findByText("Your training did not load")).toBeOnTheScreen();
      expect(
        screen.getByText("Your sessions are safe. Check your connection, then try again."),
      ).toBeOnTheScreen();
      expect(screen.queryAllByRole("img")).toHaveLength(0);
    });

    it("should read again when Try again is pressed", async () => {
      await renderScreen();
      await screen.findByText("Your training did not load");
      const readsBefore = requestsTo("workout_sets");
      const user = userEvent.setup();

      await user.press(screen.getByRole("button", { name: "Try again" }));

      await waitFor(() => {
        expect(requestsTo("workout_sets")).toBeGreaterThan(readsBefore);
      });
    });
  });
});
