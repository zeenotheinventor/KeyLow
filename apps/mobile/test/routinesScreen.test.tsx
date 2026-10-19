import { KeyLowProvider, keys } from "@keylow/api-client";
import {
  GENERIC_ERROR,
  ROUTINES_EMPTY,
  ROUTINES_SCREEN,
  TRAIN_LOADING_NAME,
} from "@keylow/core/copy";
import { onlineManager } from "@tanstack/react-query";
import { act, cleanup, render, screen, userEvent } from "@testing-library/react-native";
import { setUpTests } from "react-native-reanimated";

import { ArchivedRoutinesScreen } from "../components/ArchivedRoutinesScreen";
import { RoutinesScreen } from "../components/RoutinesScreen";
import { archivedRoutinesPath, routinesPath, trainPath } from "../lib/routineRoutes";
import { ThemeProvider } from "../lib/theme";
import { createDiaryQueryClient, diaryBackend, resetDiaryBackend } from "./support/diaryBackend";
import { resetRouterMock, routerMock } from "./support/expoRouterMock";
import { compileKitStyles } from "./support/kitStyles";
import { registerAppStyles } from "./support/nativeWindStyles";
import {
  pushPullLegsDays,
  resetRoutinesBackend,
  routineRow,
  routinesBackend,
  routinesClient,
} from "./support/routinesBackend";

import type { QueryClient } from "@tanstack/react-query";

// The routines screens, with the real hooks over a fake database.

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

setUpTests();

let queryClient: QueryClient;

async function renderScreen(
  screenElement: React.JSX.Element,
  client: QueryClient = createDiaryQueryClient(),
) {
  queryClient = client;
  await render(
    <ThemeProvider fixedPreference="dark">
      <KeyLowProvider client={routinesClient} queryClient={queryClient}>
        {screenElement}
      </KeyLowProvider>
    </ThemeProvider>,
  );
}

// 09:00 in London on Monday 21 September 2026, which is BST: the day Push Pull Legs began.
const ACTIVATED_AT = "2026-09-21T08:00:00+00:00";

function seedGoldenRoutines() {
  routinesBackend.rows = [
    routineRow({
      name: "Full body",
      days: [
        { name: "A", weekday: 0, sets: 15 },
        { name: "B", weekday: 2, sets: 15 },
        { name: "C", weekday: 4, sets: 15 },
      ],
    }),
    routineRow({
      name: "Push Pull Legs",
      days: pushPullLegsDays,
      isActive: true,
      activatedAt: ACTIVATED_AT,
    }),
    routineRow({
      name: "Starting strength",
      days: [
        { name: "A", weekday: 0, sets: 10 },
        { name: "B", weekday: 2, sets: 10 },
        { name: "C", weekday: 4, sets: 10 },
      ],
      isArchived: true,
    }),
    routineRow({
      name: "Upper Lower",
      days: [
        { name: "Upper", weekday: 0, sets: 15 },
        { name: "Lower", weekday: 1, sets: 15 },
        { name: "Upper", weekday: 3, sets: 15 },
        { name: "Lower", weekday: 4, sets: 15 },
      ],
    }),
  ];
}

describe("the routines screens", () => {
  let kitStyles: string;

  beforeAll(async () => {
    kitStyles = await compileKitStyles("", [
      "components/RoutinesScreen",
      "components/ArchivedRoutinesScreen",
      "components/RoutinesView",
      "components/ArchivedRoutinesView",
      "components/RoutineCard",
      "components/RoutineRow",
    ]);
  });

  beforeEach(() => {
    registerAppStyles(kitStyles);
    resetDiaryBackend();
    resetRoutinesBackend();
    resetRouterMock();
  });

  afterEach(async () => {
    await cleanup();
    await act(() => {
      onlineManager.setOnline(true);
    });
    queryClient.clear();
  });

  describe("the list", () => {
    it("should show the golden Push Pull Legs as the active routine and the other routines under it", async () => {
      seedGoldenRoutines();
      await renderScreen(<RoutinesScreen />);

      expect(await screen.findByRole("heading", { name: "Push Pull Legs" })).toBeOnTheScreen();
      expect(screen.getByText("4 days · 63 sets a week · since Mon 21 Sep")).toBeOnTheScreen();
      expect(screen.getByText("Upper Lower")).toBeOnTheScreen();
      expect(screen.getByText("4 days · Mon, Tue, Thu, Fri · 60 sets a week")).toBeOnTheScreen();
      expect(screen.getByText("Full body")).toBeOnTheScreen();
      expect(screen.getByText("3 days · Mon, Wed, Fri · 45 sets a week")).toBeOnTheScreen();
    });

    it("should keep the archived routines off the list and count them in the link", async () => {
      seedGoldenRoutines();
      await renderScreen(<RoutinesScreen />);

      expect(await screen.findByRole("button", { name: "Archived · 1" })).toBeOnTheScreen();
      expect(screen.queryByText("Starting strength")).not.toBeOnTheScreen();
    });

    it("should write the date it began in the profile's time zone", async () => {
      // 23:30 UTC on Monday 21 September is 00:30 on Tuesday 22 September in London, which is BST.
      routinesBackend.rows = [
        routineRow({
          name: "Push Pull Legs",
          days: pushPullLegsDays,
          isActive: true,
          activatedAt: "2026-09-21T23:30:00+00:00",
        }),
      ];
      await renderScreen(<RoutinesScreen />);

      expect(
        await screen.findByText("4 days · 63 sets a week · since Tue 22 Sep"),
      ).toBeOnTheScreen();
    });

    it("should show the list without the date when the time zone failed to load", async () => {
      diaryBackend.timeZoneReadFails = true;
      seedGoldenRoutines();
      await renderScreen(<RoutinesScreen />);

      expect(await screen.findByRole("heading", { name: "Push Pull Legs" })).toBeOnTheScreen();
      expect(screen.getByText("4 days · 63 sets a week")).toBeOnTheScreen();
      expect(screen.queryByText(GENERIC_ERROR)).not.toBeOnTheScreen();
    });

    it("should show the list without the date while the time zone is still loading", async () => {
      routinesBackend.zoneHangs = true;
      seedGoldenRoutines();
      await renderScreen(<RoutinesScreen />);

      expect(await screen.findByRole("heading", { name: "Push Pull Legs" })).toBeOnTheScreen();
      expect(screen.getByText("4 days · 63 sets a week")).toBeOnTheScreen();
    });

    it("should announce that it is loading until the routines are there", async () => {
      routinesBackend.hangs = true;
      await renderScreen(<RoutinesScreen />);

      expect(await screen.findByRole("status", { name: TRAIN_LOADING_NAME })).toBeOnTheScreen();
    });

    it("should open the archived routines from the link", async () => {
      seedGoldenRoutines();
      const user = userEvent.setup();
      await renderScreen(<RoutinesScreen />);

      await user.press(await screen.findByRole("button", { name: "Archived · 1" }));

      expect(routerMock.push).toHaveBeenCalledWith(archivedRoutinesPath());
    });

    it("should draw no Make active, Edit or New routine, because nothing supplies them yet", async () => {
      seedGoldenRoutines();
      await renderScreen(<RoutinesScreen />);
      await screen.findByRole("heading", { name: "Push Pull Legs" });

      expect(screen.queryByRole("button", { name: /Make active/ })).not.toBeOnTheScreen();
      expect(screen.queryByRole("button", { name: /Edit/ })).not.toBeOnTheScreen();
      expect(
        screen.queryByRole("button", { name: ROUTINES_SCREEN.newRoutineLabel }),
      ).not.toBeOnTheScreen();
    });

    it("should go back to the screen before it, or to the Train tab when there is none", async () => {
      seedGoldenRoutines();
      const user = userEvent.setup();
      await renderScreen(<RoutinesScreen />);
      await user.press(await screen.findByRole("button", { name: ROUTINES_SCREEN.backLabel }));
      expect(routerMock.back).toHaveBeenCalledTimes(1);

      routerMock.canGoBack.mockReturnValue(false);
      await user.press(screen.getByRole("button", { name: ROUTINES_SCREEN.backLabel }));

      expect(routerMock.replace).toHaveBeenCalledWith(trainPath());
    });

    it("should show the empty state, and no button, when there are no routines", async () => {
      await renderScreen(<RoutinesScreen />);

      expect(await screen.findByRole("heading", { name: ROUTINES_EMPTY.title })).toBeOnTheScreen();
      expect(screen.queryByRole("button", { name: ROUTINES_EMPTY.action })).not.toBeOnTheScreen();
    });

    it("should say the load failed when there is nothing saved to show, and read again on try again", async () => {
      routinesBackend.fails = true;
      const user = userEvent.setup();
      await renderScreen(<RoutinesScreen />);

      expect(await screen.findByText(GENERIC_ERROR)).toBeOnTheScreen();
      routinesBackend.fails = false;
      seedGoldenRoutines();
      await user.press(screen.getByRole("button", { name: "Try again" }));

      expect(await screen.findByRole("heading", { name: "Push Pull Legs" })).toBeOnTheScreen();
    });

    it("should open from the saved routines without a connection, and read nothing", async () => {
      const savedClient = createDiaryQueryClient();
      const savedAt = new Date("2026-10-15T16:52:00Z").getTime();
      savedClient.setQueryData(keys.profiles.timeZone, "Europe/London", { updatedAt: savedAt });
      savedClient.setQueryData(
        keys.training.routines(true),
        [
          {
            id: "00000000-0000-4000-8000-0000000000a1",
            name: "Push Pull Legs",
            is_active: true,
            is_archived: false,
            activated_at: ACTIVATED_AT,
            days: pushPullLegsDays.map((day, position) => ({
              id: `00000000-0000-4000-8000-0000000000b${position}`,
              position,
              weekday: day.weekday,
              name: day.name,
              exercises: [{ target_sets: day.sets }],
            })),
          },
        ],
        { updatedAt: savedAt },
      );
      await act(() => {
        onlineManager.setOnline(false);
      });
      await renderScreen(<RoutinesScreen />, savedClient);

      expect(await screen.findByRole("heading", { name: "Push Pull Legs" })).toBeOnTheScreen();
      expect(screen.getByText("4 days · 63 sets a week · since Mon 21 Sep")).toBeOnTheScreen();
      expect(routinesBackend.reads).toBe(0);
    });
  });

  describe("the archived list", () => {
    it("should list the archived routines with their days and no date, and nothing live", async () => {
      seedGoldenRoutines();
      await renderScreen(<ArchivedRoutinesScreen />);

      expect(await screen.findByText("Starting strength")).toBeOnTheScreen();
      expect(screen.getByText("3 days")).toBeOnTheScreen();
      expect(screen.queryByText("Push Pull Legs")).not.toBeOnTheScreen();
      expect(screen.queryByRole("button", { name: /Restore/ })).not.toBeOnTheScreen();
    });

    it("should go back to the screen before it, or to the routines when there is none", async () => {
      seedGoldenRoutines();
      const user = userEvent.setup();
      await renderScreen(<ArchivedRoutinesScreen />);
      await user.press(await screen.findByRole("button", { name: "Back to Routines" }));
      expect(routerMock.back).toHaveBeenCalledTimes(1);

      routerMock.canGoBack.mockReturnValue(false);
      await user.press(screen.getByRole("button", { name: "Back to Routines" }));

      expect(routerMock.replace).toHaveBeenCalledWith(routinesPath());
    });
  });
});
