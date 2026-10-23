import { KeyLowProvider, keys, useBodyMap } from "@keylow/api-client";
import {
  BODY_MAP,
  TRAIN_FIRST_TIME,
  TRAIN_LOADING_NAME,
  TRAIN_NO_ROUTINE,
} from "@keylow/core/copy";
import { onlineManager } from "@tanstack/react-query";
import { act, cleanup, render, screen, userEvent, waitFor } from "@testing-library/react-native";
import { setUpTests } from "react-native-reanimated";

import { RESTING_HEAT } from "../components/DashboardScreen/DashboardBodyMapCard";
import { TrainScreen } from "../components/TrainScreen";
import { resetBodyFigureForTests } from "../lib/bodyFigure/testing";
import { ThemeProvider } from "../lib/theme";
import { createDiaryQueryClient } from "./support/diaryBackend";
import { fillsIn, heatFill } from "./support/figureFills";
import { compileKitStyles } from "./support/kitStyles";
import { registerAppStyles } from "./support/nativeWindStyles";
import {
  loggedSession,
  resetTrainBackend,
  trainBackend,
  trainClient,
} from "./support/trainBackend";
import { goldenRoutine, mondayPush, tuesdayPull } from "./support/trainGoldenWeek";

import type { TrainScreenProps } from "../components/TrainScreen";
import type { BodyMap, TrainingReadResult } from "@keylow/api-client";
import type { MuscleId } from "@keylow/core/training";
import type { QueryClient } from "@tanstack/react-query";

// The stored figure, which a test sets. The view of the body map screen is stored under another key.
let mockStoredFigure: string | null = null;
const mockSetItem = jest.fn<Promise<undefined>, [string, string]>();
jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: {
    getItem: (key: string) => Promise.resolve(key === "bodyMap.figure" ? mockStoredFigure : null),
    setItem: (key: string, value: string) => mockSetItem(key, value),
  },
}));
jest.mock(
  "react-native-safe-area-context",
  () =>
    jest.requireActual<{ default: unknown }>("react-native-safe-area-context/jest/mock").default,
);

// The clock the screen reads, which a test sets before it renders.
let mockNow = new Date("2026-10-15T16:55:00Z");
jest.mock("../lib/useNow", () => ({ useNow: () => mockNow }));

// The hook is the one thing replaced: its numbers are core's, pinned by its own tests. This file is about
// what the card does with them, so it is given the golden values and nothing else is faked.
jest.mock("@keylow/api-client", () => ({
  ...jest.requireActual<typeof import("@keylow/api-client")>("@keylow/api-client"),
  useBodyMap: jest.fn(),
}));

setUpTests();

const THURSDAY_1755 = "2026-10-15T16:55:00Z";
const THURSDAY_1900 = "2026-10-15T18:00:00Z";

// The heat step of every muscle on Thursday at 17:55, as the dashboard card's test pins it.
const steps1755: Partial<Record<MuscleId, number>> = {
  chest_upper: 1,
  chest_lower: 1,
  delt_rear: 1,
  lats: 2,
  traps_mid: 1,
  biceps: 1,
  triceps: 1,
};
// And at 19:00, as the body map screen's test pins it.
const steps1900: Partial<Record<MuscleId, number>> = {
  ...steps1755,
  lower_back: 2,
  glute_max: 3,
  quads: 3,
  hamstrings: 3,
  calves: 2,
};
// What the plan adds to Actual, so the Projected picture can be told from it.
const projectedSteps: Partial<Record<MuscleId, number>> = { ...steps1755, quads: 4 };

const bodyMapOf = (
  steps: Partial<Record<MuscleId, number>>,
  overrides: Partial<BodyMap> = {},
): BodyMap => ({
  values: { ...RESTING_HEAT, ...steps },
  computedAt: THURSDAY_1755.replace("Z", ".000Z"),
  days: [],
  todayProjectedIsActual: true,
  projectedAvailable: true,
  nothingLogged: false,
  ...overrides,
});

const read = (data: BodyMap): TrainingReadResult<BodyMap> => ({
  data,
  isPending: false,
  isError: false,
  error: null,
  refetch: () => Promise.resolve(),
});

function readBodyMapAs(actual: BodyMap, projected: BodyMap) {
  jest
    .mocked(useBodyMap)
    .mockImplementation(({ view }) => read(view === "projected" ? projected : actual));
}

let queryClient: QueryClient;

async function renderTrain(props: TrainScreenProps = {}) {
  queryClient = createDiaryQueryClient();
  await render(
    <ThemeProvider fixedPreference="dark">
      <KeyLowProvider client={trainClient} queryClient={queryClient}>
        <TrainScreen {...props} />
      </KeyLowProvider>
    </ThemeProvider>,
  );
}

const frontName = (view: "Actual" | "Projected") =>
  `Body map, ${view}, heat, front. Open the body map for each muscle.`;

describe("the body map card on the Train home", () => {
  let kitStyles: string;

  beforeAll(async () => {
    kitStyles = await compileKitStyles("", [
      "components/TrainScreen",
      "components/TodayCard",
      "components/PlanWeekStrip",
      "components/DashboardScreen",
      "components/ViewLabel",
      "app",
    ]);
  });

  beforeEach(() => {
    registerAppStyles(kitStyles);
    resetTrainBackend();
    resetBodyFigureForTests();
    mockStoredFigure = "male";
    mockSetItem.mockReset();
    mockSetItem.mockResolvedValue(undefined);
    mockNow = new Date(THURSDAY_1755);
    trainBackend.routine = goldenRoutine;
    trainBackend.weekSessions = [mondayPush, tuesdayPull];
    readBodyMapAs(bodyMapOf(steps1755), bodyMapOf(projectedSteps));
  });

  afterEach(async () => {
    jest.mocked(useBodyMap).mockReset();
    await cleanup();
    await act(() => {
      onlineManager.setOnline(true);
    });
    queryClient.clear();
  });

  describe("where it shows", () => {
    it("should sit under the Today card and above the week strip", async () => {
      await renderTrain({ onStart: jest.fn(), onViewSession: jest.fn(), onOpenBodyMap: jest.fn() });

      await screen.findByRole("button", { name: "Show projected" });
      const buttons = screen.getAllByRole("button");
      const positionOf = (name: string | RegExp) =>
        buttons.indexOf(screen.getByRole("button", { name }));
      const startLegs = positionOf(/^Start Legs/);
      const showProjected = positionOf("Show projected");
      const openBodyMap = positionOf("Open body map");
      const mondayOfTheWeek = positionOf(/Monday/);

      expect(startLegs).toBeGreaterThanOrEqual(0);
      expect(showProjected).toBeGreaterThan(startLegs);
      expect(openBodyMap).toBeGreaterThan(showProjected);
      expect(mondayOfTheWeek).toBeGreaterThan(openBodyMap);
    });

    it("should show with the no routine card", async () => {
      trainBackend.routine = null;
      trainBackend.weekSessions = [];
      trainBackend.sessions = [loggedSession];
      await renderTrain();

      expect(
        await screen.findByRole("heading", { name: TRAIN_NO_ROUTINE.title }),
      ).toBeOnTheScreen();
      expect(await screen.findByRole("button", { name: "Show projected" })).toBeOnTheScreen();
    });

    it("should not show on the first visit", async () => {
      trainBackend.routine = null;
      trainBackend.weekSessions = [];
      await renderTrain();

      await screen.findByRole("heading", { name: TRAIN_FIRST_TIME.title });
      await act(async () => {
        await Promise.resolve();
      });

      expect(screen.queryByRole("button", { name: "Show projected" })).not.toBeOnTheScreen();
      expect(useBodyMap).not.toHaveBeenCalled();
    });

    it("should not show while the Train home is loading", async () => {
      trainBackend.hungTables.add("routines");
      await renderTrain();

      await screen.findByRole("status", { name: TRAIN_LOADING_NAME });

      expect(screen.queryByRole("button", { name: "Show projected" })).not.toBeOnTheScreen();
    });
  });

  describe("reading", () => {
    it("should read Actual and Projected heat for the week that holds now", async () => {
      await renderTrain();
      await screen.findByRole("button", { name: "Show projected" });

      for (const view of ["actual", "projected"] as const) {
        expect(useBodyMap).toHaveBeenCalledWith({
          scale: "heat",
          view,
          weekStart: "2026-10-12",
          now: "2026-10-15T16:55:00.000Z",
          enabled: true,
        });
      }
    });
  });

  describe("the golden week", () => {
    it("should show the heat of Thursday 17:55 and name the moment", async () => {
      await renderTrain();

      const front = await screen.findByRole("img", { name: frontName("Actual") });
      const fills = fillsIn(front, "front");

      expect(fills.size).toBeGreaterThan(0);
      for (const [muscle, fill] of fills) {
        expect(fill).toEqual(heatFill("dark", steps1755[muscle] ?? 0));
      }
      expect(screen.getByText("Actual")).toBeOnTheScreen();
      expect(screen.getByText("Now · Thu 15 Oct, 17:55")).toBeOnTheScreen();
    });

    it("should show the heat of Thursday 19:00 when the clock says so", async () => {
      mockNow = new Date(THURSDAY_1900);
      const computedAt = "2026-10-15T18:00:00.000Z";
      readBodyMapAs(bodyMapOf(steps1900, { computedAt }), bodyMapOf(steps1900, { computedAt }));
      await renderTrain();

      const back = fillsIn(
        await screen.findByRole("img", { name: "Body map, Actual, heat, back" }),
        "back",
      );

      for (const [muscle, fill] of back) {
        expect(fill).toEqual(heatFill("dark", steps1900[muscle] ?? 0));
      }
      expect(screen.getByText("Now · Thu 15 Oct, 19:00")).toBeOnTheScreen();
    });
  });

  describe("Show projected", () => {
    it("should switch to the Projected picture and name the button for the way back", async () => {
      const user = userEvent.setup();
      await renderTrain();

      await user.press(await screen.findByRole("button", { name: "Show projected" }));

      expect(screen.getByText("Projected")).toBeOnTheScreen();
      expect(screen.getByRole("button", { name: "Show actual" })).toBeOnTheScreen();
      const front = fillsIn(screen.getByRole("img", { name: frontName("Projected") }), "front");
      expect(front.get("quads")).toEqual(heatFill("dark", 4));
    });

    it("should switch back to Actual", async () => {
      const user = userEvent.setup();
      await renderTrain();

      await user.press(await screen.findByRole("button", { name: "Show projected" }));
      await user.press(screen.getByRole("button", { name: "Show actual" }));

      expect(screen.getByRole("button", { name: "Show projected" })).toBeOnTheScreen();
      const front = fillsIn(screen.getByRole("img", { name: frontName("Actual") }), "front");
      expect(front.get("quads")).toEqual(heatFill("dark", 0));
    });

    it("should show today's Projected as the same picture as Actual", async () => {
      readBodyMapAs(bodyMapOf(steps1755), bodyMapOf(steps1755));
      const user = userEvent.setup();
      await renderTrain();

      await user.press(await screen.findByRole("button", { name: "Show projected" }));

      const front = fillsIn(screen.getByRole("img", { name: frontName("Projected") }), "front");
      for (const [muscle, fill] of front) {
        expect(fill).toEqual(heatFill("dark", steps1755[muscle] ?? 0));
      }
    });

    it("should keep the view to itself: the body map screen's remembered view is not written", async () => {
      const user = userEvent.setup();
      await renderTrain();

      await user.press(await screen.findByRole("button", { name: "Show projected" }));

      expect(mockSetItem).not.toHaveBeenCalled();
    });

    it("should be disabled with the line Projected needs a routine when there is no routine", async () => {
      trainBackend.routine = null;
      trainBackend.weekSessions = [];
      trainBackend.sessions = [loggedSession];
      readBodyMapAs(
        bodyMapOf(steps1755, { projectedAvailable: false }),
        bodyMapOf(steps1755, { projectedAvailable: false }),
      );
      await renderTrain();

      expect(await screen.findByRole("button", { name: "Show projected" })).toBeDisabled();
      expect(screen.getByText(BODY_MAP.toggle.projectedNeedsRoutine)).toBeOnTheScreen();
    });

    it("should leave the line out when there is a routine", async () => {
      await renderTrain();
      await screen.findByRole("button", { name: "Show projected" });

      expect(screen.queryByText(BODY_MAP.toggle.projectedNeedsRoutine)).not.toBeOnTheScreen();
    });
  });

  describe("with nothing logged in the heat window", () => {
    it("should draw the figures at rest and say why in the sub-line", async () => {
      readBodyMapAs(bodyMapOf({}, { nothingLogged: true }), bodyMapOf({}, { nothingLogged: true }));
      await renderTrain();

      const front = fillsIn(await screen.findByRole("img", { name: frontName("Actual") }), "front");

      for (const fill of front.values()) {
        expect(fill).toEqual(heatFill("dark", 0));
      }
      expect(screen.getByText("Nothing logged in the last 14 days")).toBeOnTheScreen();
    });
  });

  describe("the Open body map button", () => {
    it("should call its handler when it is pressed", async () => {
      const onOpenBodyMap = jest.fn();
      const user = userEvent.setup();
      await renderTrain({ onOpenBodyMap });

      await user.press(await screen.findByRole("button", { name: "Open body map" }));

      expect(onOpenBodyMap).toHaveBeenCalledTimes(1);
    });

    it("should not be drawn without a handler", async () => {
      await renderTrain();
      await screen.findByRole("button", { name: "Show projected" });

      expect(screen.queryByRole("button", { name: "Open body map" })).not.toBeOnTheScreen();
    });
  });

  describe("the figure setting", () => {
    it("should draw the female figure when the setting says so", async () => {
      mockStoredFigure = "female";
      await renderTrain();

      const back = fillsIn(
        await screen.findByRole("img", { name: "Body map, Actual, heat, back" }),
        "back",
        "female",
      );

      expect(back.get("lats")).toEqual(heatFill("dark", 2));
    });
  });

  describe("when the body map cannot be shown", () => {
    it("should say quietly that it could not be loaded when a read failed", async () => {
      jest.mocked(useBodyMap).mockReturnValue({
        data: undefined,
        isPending: false,
        isError: true,
        error: new Error("failed"),
        refetch: () => Promise.resolve(),
      });
      await renderTrain();

      expect(await screen.findByText(BODY_MAP.dashboardCard.loadFailed)).toBeOnTheScreen();
      expect(screen.queryByRole("button", { name: "Show projected" })).not.toBeOnTheScreen();
    });

    it("should show a loading state while the numbers are worked out", async () => {
      jest.mocked(useBodyMap).mockReturnValue({
        data: undefined,
        isPending: true,
        isError: false,
        error: null,
        refetch: () => Promise.resolve(),
      });
      await renderTrain();

      expect(
        await screen.findByRole("status", { name: BODY_MAP.dashboardCard.loadingLabel }),
      ).toBeOnTheScreen();
    });
  });

  describe("offline", () => {
    // 17:52 in London on Thursday 15 October 2026, which is BST.
    const SAVED_AT = new Date("2026-10-15T16:52:00Z").getTime();

    function seedCache() {
      queryClient = createDiaryQueryClient();
      queryClient.setQueryData(keys.profiles.timeZone, "Europe/London", { updatedAt: SAVED_AT });
      queryClient.setQueryData(keys.training.activeRoutine, null, { updatedAt: SAVED_AT });
      queryClient.setQueryData(keys.training.hasLoggedSession, true, { updatedAt: SAVED_AT });
      queryClient.setQueryData(keys.training.weekSessions("2026-10-12"), [], {
        updatedAt: SAVED_AT,
      });
      queryClient.setQueryData(keys.training.activeSession, null, { updatedAt: SAVED_AT });
    }

    async function renderOffline() {
      seedCache();
      onlineManager.setOnline(false);
      await render(
        <ThemeProvider fixedPreference="dark">
          <KeyLowProvider client={trainClient} queryClient={queryClient}>
            <TrainScreen />
          </KeyLowProvider>
        </ThemeProvider>,
      );
    }

    it("should say when the phone saved what it shows, in place of the current moment", async () => {
      await renderOffline();

      expect(await screen.findByText("Saved · Thu 15 Oct, 17:52")).toBeOnTheScreen();
      expect(screen.queryByText(/^Now ·/)).not.toBeOnTheScreen();
    });

    it("should work the heat out at that saved moment, so the words and the figures agree", async () => {
      mockNow = new Date("2026-10-15T19:30:00Z");
      await renderOffline();
      await screen.findByText("Saved · Thu 15 Oct, 17:52");

      await waitFor(() => {
        expect(useBodyMap).toHaveBeenCalledWith(
          expect.objectContaining({ view: "actual", now: "2026-10-15T16:52:00.000Z" }),
        );
      });
      expect(useBodyMap).not.toHaveBeenCalledWith(
        expect.objectContaining({ now: "2026-10-15T19:30:00.000Z" }),
      );
    });

    it("should read the current moment again once the phone is back online", async () => {
      await renderOffline();
      await screen.findByText("Saved · Thu 15 Oct, 17:52");

      await act(() => {
        onlineManager.setOnline(true);
      });

      expect(await screen.findByText("Now · Thu 15 Oct, 17:55")).toBeOnTheScreen();
    });
  });
});
