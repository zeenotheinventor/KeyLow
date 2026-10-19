import { KeyLowProvider } from "@keylow/api-client";
import {
  ROUTINE_MAKE_ACTIVE_FAILED,
  ROUTINE_RESTORE_FAILED,
  ROUTINES_SCREEN,
} from "@keylow/core/copy";
import { onlineManager } from "@tanstack/react-query";
import { act, cleanup, render, screen, userEvent, waitFor } from "@testing-library/react-native";
import { AccessibilityInfo } from "react-native";
import { setUpTests } from "react-native-reanimated";

import { ArchivedRoutinesScreen } from "../components/ArchivedRoutinesScreen";
import { RoutinesScreen } from "../components/RoutinesScreen";
import { TrainScreen } from "../components/TrainScreen";
import { ToastProvider } from "../components/ui";
import { ThemeProvider } from "../lib/theme";
import { createDiaryQueryClient, diaryBackend } from "./support/diaryBackend";
import { resetRouterMock } from "./support/expoRouterMock";
import { compileKitStyles } from "./support/kitStyles";
import { registerAppStyles } from "./support/nativeWindStyles";
import {
  resetRoutineStatusBackend,
  routineStatusBackend,
  routineStatusClient,
  storedRoutine,
} from "./support/routineStatusBackend";
import { pressTwiceInTheSameMoment } from "./support/sameTickPress";
import { resetTrainBackend } from "./support/trainBackend";

import type { StoredRoutine } from "./support/routineStatusBackend";
import type { QueryClient } from "@tanstack/react-query";

// Making a routine active and restoring an archived one, through the real screens, hooks and plan
// wiring over a fake database that answers as the real one does.

jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: { getItem: () => Promise.resolve(null), setItem: () => Promise.resolve() },
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

// The clock the screens read, which a test moves with `setNow`.
let mockNow = new Date("2026-10-15T16:55:00Z");
jest.mock("../lib/useNow", () => ({ useNow: () => mockNow }));

setUpTests();

const makeActiveButton = (routineName: string) => ({ name: `Make active, ${routineName}` });
const restoreButton = (routineName: string) => ({ name: `Restore ${routineName}` });

let queryClient: QueryClient;

async function renderScreen(screenElement: React.JSX.Element) {
  await render(
    <ThemeProvider fixedPreference="dark">
      <KeyLowProvider client={routineStatusClient} queryClient={queryClient}>
        <ToastProvider>{screenElement}</ToastProvider>
      </KeyLowProvider>
    </ThemeProvider>,
  );
  return userEvent.setup();
}

const pushPullLegs = () =>
  storedRoutine(
    "Push Pull Legs",
    [
      { name: "Push", weekday: 0, exercises: [3, 3, 3, 3, 4] },
      { name: "Pull", weekday: 1, exercises: [3, 3, 3, 3, 3] },
      { name: "Legs", weekday: 3, exercises: [3, 3, 3, 3, 4] },
      { name: "Push", weekday: 5, exercises: [3, 3, 3, 3, 4] },
    ],
    { isActive: true, activatedAt: "2026-10-01T08:00:00+00:00" },
  );

const upperLower = () =>
  storedRoutine("Upper Lower", [
    { name: "Upper", weekday: 0, exercises: [3, 3, 3, 3, 3] },
    { name: "Lower", weekday: 1, exercises: [3, 3, 3, 3, 3] },
    { name: "Upper", weekday: 3, exercises: [3, 3, 3, 3, 3] },
    { name: "Lower", weekday: 4, exercises: [3, 3, 3, 3, 3] },
  ]);

const startingStrength = () =>
  storedRoutine(
    "Starting strength",
    [
      { name: "A", weekday: 0, exercises: [5] },
      { name: "B", weekday: 2, exercises: [5] },
      { name: "C", weekday: 4, exercises: [5] },
    ],
    { isArchived: true },
  );

function seed(routines: StoredRoutine[]) {
  routineStatusBackend.routines = routines;
}

describe("a routine's status", () => {
  let kitStyles: string;

  beforeAll(async () => {
    kitStyles = await compileKitStyles("", [
      "components/RoutinesScreen",
      "components/ArchivedRoutinesScreen",
      "components/RoutinesView",
      "components/ArchivedRoutinesView",
      "components/RoutineCard",
      "components/RoutineRow",
      "components/TrainScreen",
      "components/TodayCard",
      "app",
    ]);
  });

  beforeEach(() => {
    registerAppStyles(kitStyles);
    resetTrainBackend();
    resetRoutineStatusBackend();
    resetRouterMock();
    mockNow = new Date("2026-10-15T16:55:00Z");
    queryClient = createDiaryQueryClient();
  });

  afterEach(async () => {
    await cleanup();
    await act(() => {
      onlineManager.setOnline(true);
    });
    queryClient.clear();
  });

  describe("making a routine active", () => {
    async function askToMakeUpperLowerActive() {
      seed([pushPullLegs(), upperLower()]);
      const user = await renderScreen(<RoutinesScreen />);
      await user.press(await screen.findByRole("button", makeActiveButton("Upper Lower")));
      await screen.findByRole("heading", { name: "Make Upper Lower active?" });
      return user;
    }

    it("should ask first, with today's date and the routine that stays saved", async () => {
      await askToMakeUpperLowerActive();

      expect(
        screen.getByText(
          "It plans from today, Thursday 15 October. Push Pull Legs stays saved, and the sessions you logged keep their days.",
        ),
      ).toBeOnTheScreen();
      expect(routineStatusBackend.activations).toEqual([]);
    });

    it("should write today in the profile's time zone", async () => {
      // 23:30 UTC on Thursday is 00:30 on Friday in London, which is BST.
      mockNow = new Date("2026-10-15T23:30:00Z");

      await askToMakeUpperLowerActive();

      expect(screen.getByText(/It plans from today, Friday 16 October\./)).toBeOnTheScreen();
    });

    it("should make the routine active, and move the one that was to Other routines", async () => {
      const user = await askToMakeUpperLowerActive();

      await user.press(screen.getByRole("button", { name: ROUTINES_SCREEN.makeActiveAction }));

      expect(await screen.findByRole("heading", { name: "Upper Lower" })).toBeOnTheScreen();
      expect(
        await screen.findByRole("button", makeActiveButton("Push Pull Legs")),
      ).toBeOnTheScreen();
      expect(screen.queryByRole("button", makeActiveButton("Upper Lower"))).not.toBeOnTheScreen();
      expect(
        screen.queryByRole("heading", { name: "Make Upper Lower active?" }),
      ).not.toBeOnTheScreen();
      expect(routineStatusBackend.activations).toEqual([
        routineStatusBackend.routines.find((routine) => routine.name === "Upper Lower")?.id,
      ]);
    });

    it("should change nothing when Cancel is pressed", async () => {
      const user = await askToMakeUpperLowerActive();

      await user.press(screen.getByRole("button", { name: "Cancel" }));

      await waitFor(() => {
        expect(
          screen.queryByRole("heading", { name: "Make Upper Lower active?" }),
        ).not.toBeOnTheScreen();
      });
      expect(routineStatusBackend.activations).toEqual([]);
      expect(screen.getByRole("heading", { name: "Push Pull Legs" })).toBeOnTheScreen();
    });

    it("should make it active once when Make active is pressed twice in the same moment", async () => {
      await askToMakeUpperLowerActive();
      let release = () => {};
      routineStatusBackend.holdWrites = new Promise((resolve) => {
        release = resolve;
      });
      const confirm = screen.getByRole("button", { name: ROUTINES_SCREEN.makeActiveAction });

      await pressTwiceInTheSameMoment(confirm);
      release();

      expect(await screen.findByRole("heading", { name: "Upper Lower" })).toBeOnTheScreen();
      expect(routineStatusBackend.activations).toHaveLength(1);
    });

    it("should keep the question open when Cancel is pressed while the answer is on its way", async () => {
      const user = await askToMakeUpperLowerActive();
      let release = () => {};
      routineStatusBackend.holdWrites = new Promise((resolve) => {
        release = resolve;
      });
      await user.press(screen.getByRole("button", { name: ROUTINES_SCREEN.makeActiveAction }));
      await waitFor(() => {
        expect(routineStatusBackend.activations).toHaveLength(1);
      });

      await user.press(screen.getByRole("button", { name: "Cancel" }));

      expect(screen.getByRole("heading", { name: "Make Upper Lower active?" })).toBeOnTheScreen();
      release();
      expect(await screen.findByRole("heading", { name: "Upper Lower" })).toBeOnTheScreen();
      expect(routineStatusBackend.activations).toHaveLength(1);
    });

    it("should keep the routine that was active, and say so, when the write fails", async () => {
      const user = await askToMakeUpperLowerActive();
      routineStatusBackend.failWrites = true;

      await user.press(screen.getByRole("button", { name: ROUTINES_SCREEN.makeActiveAction }));

      expect(
        await screen.findByRole("status", { name: ROUTINE_MAKE_ACTIVE_FAILED }),
      ).toBeOnTheScreen();
      expect(await screen.findByRole("heading", { name: "Push Pull Legs" })).toBeOnTheScreen();
      expect(screen.getByRole("button", makeActiveButton("Upper Lower"))).toBeOnTheScreen();
    });

    it("should say once that it did not go through when Make active is pressed twice and fails", async () => {
      await askToMakeUpperLowerActive();
      routineStatusBackend.failWrites = true;
      const announce = jest.spyOn(AccessibilityInfo, "announceForAccessibility").mockClear();
      const confirm = screen.getByRole("button", { name: ROUTINES_SCREEN.makeActiveAction });

      await pressTwiceInTheSameMoment(confirm);

      expect(
        await screen.findByRole("status", { name: ROUTINE_MAKE_ACTIVE_FAILED }),
      ).toBeOnTheScreen();
      expect(
        announce.mock.calls.filter(([said]) => said === ROUTINE_MAKE_ACTIVE_FAILED),
      ).toHaveLength(1);
      expect(routineStatusBackend.activations).toHaveLength(1);
    });

    it("should not ask the database, and say so, when there is no connection", async () => {
      const user = await askToMakeUpperLowerActive();
      await act(() => {
        onlineManager.setOnline(false);
      });

      await user.press(screen.getByRole("button", { name: ROUTINES_SCREEN.makeActiveAction }));

      expect(
        await screen.findByRole("status", { name: ROUTINE_MAKE_ACTIVE_FAILED }),
      ).toBeOnTheScreen();
      expect(routineStatusBackend.activations).toEqual([]);
      expect(screen.getByRole("heading", { name: "Push Pull Legs" })).toBeOnTheScreen();
    });

    it("should leave Make active out while the profile's time zone is not known", async () => {
      diaryBackend.timeZoneReadFails = true;
      seed([pushPullLegs(), upperLower()]);

      await renderScreen(<RoutinesScreen />);

      await screen.findByRole("heading", { name: "Push Pull Legs" });
      expect(screen.queryByRole("button", makeActiveButton("Upper Lower"))).not.toBeOnTheScreen();
    });

    it("should move the Train home's Today card to the new routine from today", async () => {
      seed([pushPullLegs(), upperLower()]);
      await renderScreen(<TrainScreen />);
      expect(await screen.findByRole("heading", { name: "Legs" })).toBeOnTheScreen();
      expect(screen.getByText("Push Pull Legs · day 3 of 4")).toBeOnTheScreen();
      await cleanup();

      const user = await renderScreen(<RoutinesScreen />);
      await user.press(await screen.findByRole("button", makeActiveButton("Upper Lower")));
      await user.press(
        await screen.findByRole("button", { name: ROUTINES_SCREEN.makeActiveAction }),
      );
      await screen.findByRole("button", makeActiveButton("Push Pull Legs"));
      await cleanup();

      await renderScreen(<TrainScreen />);

      expect(await screen.findByRole("heading", { name: "Upper" })).toBeOnTheScreen();
      expect(screen.getByText("Upper Lower · day 3 of 4")).toBeOnTheScreen();
      expect(screen.queryByRole("heading", { name: "Legs" })).not.toBeOnTheScreen();
    });
  });

  describe("restoring an archived routine", () => {
    it("should restore the routine, which leaves the archived list and returns to Other routines", async () => {
      seed([pushPullLegs(), startingStrength()]);
      const user = await renderScreen(<ArchivedRoutinesScreen />);

      await user.press(await screen.findByRole("button", restoreButton("Starting strength")));

      await waitFor(() => {
        expect(screen.queryByText("Starting strength")).not.toBeOnTheScreen();
      });
      expect(routineStatusBackend.archiveUpdates).toEqual([
        { id: routineStatusBackend.routines[1]?.id, archived: false },
      ]);
      await cleanup();
      await renderScreen(<RoutinesScreen />);
      expect(
        await screen.findByRole("button", makeActiveButton("Starting strength")),
      ).toBeOnTheScreen();
      expect(screen.queryByRole("button", { name: /^Archived/ })).not.toBeOnTheScreen();
    });

    it("should restore once when Restore is pressed twice in the same moment", async () => {
      seed([pushPullLegs(), startingStrength()]);
      await renderScreen(<ArchivedRoutinesScreen />);
      let release = () => {};
      routineStatusBackend.holdWrites = new Promise((resolve) => {
        release = resolve;
      });
      const restore = await screen.findByRole("button", restoreButton("Starting strength"));

      await pressTwiceInTheSameMoment(restore);
      release();

      await waitFor(() => {
        expect(screen.queryByText("Starting strength")).not.toBeOnTheScreen();
      });
      expect(routineStatusBackend.archiveUpdates).toHaveLength(1);
    });

    it("should keep the routine archived, and say so, when the write fails", async () => {
      seed([pushPullLegs(), startingStrength()]);
      const user = await renderScreen(<ArchivedRoutinesScreen />);
      routineStatusBackend.failWrites = true;

      await user.press(await screen.findByRole("button", restoreButton("Starting strength")));

      expect(await screen.findByRole("status", { name: ROUTINE_RESTORE_FAILED })).toBeOnTheScreen();
      expect(screen.getByRole("button", restoreButton("Starting strength"))).toBeOnTheScreen();
    });

    it("should say once that it did not go through when Restore is pressed twice and fails", async () => {
      seed([pushPullLegs(), startingStrength()]);
      await renderScreen(<ArchivedRoutinesScreen />);
      routineStatusBackend.failWrites = true;
      const announce = jest.spyOn(AccessibilityInfo, "announceForAccessibility").mockClear();
      const restore = await screen.findByRole("button", restoreButton("Starting strength"));

      await pressTwiceInTheSameMoment(restore);

      expect(await screen.findByRole("status", { name: ROUTINE_RESTORE_FAILED })).toBeOnTheScreen();
      expect(announce.mock.calls.filter(([said]) => said === ROUTINE_RESTORE_FAILED)).toHaveLength(
        1,
      );
      expect(routineStatusBackend.archiveUpdates).toHaveLength(1);
    });

    it("should not ask the database, and say so, when there is no connection", async () => {
      seed([pushPullLegs(), startingStrength()]);
      const user = await renderScreen(<ArchivedRoutinesScreen />);
      await screen.findByRole("button", restoreButton("Starting strength"));
      await act(() => {
        onlineManager.setOnline(false);
      });

      await user.press(screen.getByRole("button", restoreButton("Starting strength")));

      expect(await screen.findByRole("status", { name: ROUTINE_RESTORE_FAILED })).toBeOnTheScreen();
      expect(routineStatusBackend.archiveUpdates).toEqual([]);
    });
  });
});
