import {
  KeyLowProvider,
  keys,
  useBodyMap,
  useMuscleDetail,
  useMuscleList,
} from "@keylow/api-client";
import { MUSCLE_NAMES, MUSCLE_SHEET, describeMuscleListRow } from "@keylow/core/copy";
import { MUSCLE_IDS, muscleListGroups } from "@keylow/core/training";
import { cleanup, render, screen, userEvent, waitFor } from "@testing-library/react-native";
import { setUpTests } from "react-native-reanimated";

import { BodyMapScreen } from "../../components/BodyMapScreen";
import { RESTING_HEAT } from "../../components/DashboardScreen/DashboardBodyMapCard";
import { MuscleListScreen } from "../../components/MuscleListScreen";
import { resetBodyFigureForTests } from "../../lib/bodyFigure/testing";
import { editRoutinePath, newRoutinePath } from "../../lib/routineRoutes";
import { ThemeProvider } from "../../lib/theme";
import { createDiaryQueryClient, diaryClient, resetDiaryBackend } from "../support/diaryBackend";
import { resetRouterMock, routerMock } from "../support/expoRouterMock";
import { compileKitStyles } from "../support/kitStyles";
import { registerAppStyles } from "../support/nativeWindStyles";
import { installVirtualClock } from "../support/virtualClock";

import type { ActiveRoutine, BodyMap, BodyMapDay, TrainingReadResult } from "@keylow/api-client";
import type { MuscleDetail, MuscleId } from "@keylow/core/training";
import type { QueryClient } from "@tanstack/react-query";
import type { ReactElement } from "react";

jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: {
    getItem: (key: string) => Promise.resolve(key === "bodyMap.figure" ? "male" : null),
    setItem: () => Promise.resolve(),
  },
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
// Thursday 15 October 2026, 19:00 in London.
jest.mock("../../lib/useNow", () => ({
  useNow: () => new Date("2026-10-15T18:00:00Z"),
}));
// The hooks are the things replaced: their numbers are core's, pinned by their own tests. This file is
// about what the sheet's Edit routine button does.
jest.mock("@keylow/api-client", () => ({
  ...jest.requireActual<typeof import("@keylow/api-client")>("@keylow/api-client"),
  useBodyMap: jest.fn(),
  useMuscleList: jest.fn(),
  useMuscleDetail: jest.fn(),
}));

setUpTests();

const NOW = "2026-10-15T18:00:00.000Z";

function readResult<Data>(data: Data): TrainingReadResult<Data> {
  return { data, isPending: false, isError: false, error: null, refetch: () => Promise.resolve() };
}

function dayOf(date: string, status: BodyMapDay["status"]): BodyMapDay {
  return {
    date,
    at: `${date}T19:00:00.000Z`,
    isToday: date === "2026-10-15",
    status,
    plannedDayName: null,
    sessionDayName: null,
    selectable: true,
  };
}

const bodyMap: BodyMap = {
  values: { ...RESTING_HEAT },
  computedAt: NOW,
  days: [
    dayOf("2026-10-12", "logged"),
    dayOf("2026-10-13", "rest"),
    dayOf("2026-10-14", "rest"),
    dayOf("2026-10-15", "logged"),
    dayOf("2026-10-16", "rest"),
    dayOf("2026-10-17", "rest"),
    dayOf("2026-10-18", "rest"),
  ],
  todayProjectedIsActual: true,
  projectedAvailable: true,
  nothingLogged: false,
};

const trainedDetail: MuscleDetail = {
  muscle: "delt_side",
  heatPercent: 3,
  heatStep: 0,
  readyInHours: 0,
  weeklySets: {
    actual: 5.5,
    planned: 11,
    bands: { growingFromSets: 4, productiveFromSets: 10, highAboveSets: 20 },
    actualStatus: "growing",
    plannedStatus: "productive",
    volumeStatus: "growing",
  },
  targeting: { targeted: true, routineTrains: true, goalRanks: false },
  lastTrained: null,
};
const notTrainedDetail: MuscleDetail = {
  ...trainedDetail,
  muscle: "abs",
  heatPercent: 0,
  weeklySets: {
    ...trainedDetail.weeklySets,
    actual: 0,
    planned: 0,
    actualStatus: "not_trained",
    plannedStatus: "not_trained",
    volumeStatus: "not_trained",
  },
  targeting: { targeted: false, routineTrains: false, goalRanks: false },
};
const detailOf = (muscle: MuscleId): MuscleDetail =>
  muscle === "abs" ? notTrainedDetail : { ...trainedDetail, muscle };

const routine: ActiveRoutine = {
  id: "routine-1",
  name: "Push Pull Legs",
  activatedAt: null,
  days: [],
};

const listGroups = muscleListGroups(
  Object.fromEntries(MUSCLE_IDS.map((muscle) => [muscle, { heat: 0, readyAt: NOW }])) as Parameters<
    typeof muscleListGroups
  >[0],
  NOW,
);
const listRowOf = (muscle: MuscleId) => {
  const row = listGroups.flatMap((group) => group.rows).find((entry) => entry.muscle === muscle);
  if (row === undefined) {
    throw new Error(`The list holds no row for ${muscle}`);
  }
  return row;
};

let queryClient: QueryClient;

/** Opens a screen with the active routine read from the cache, `null` for none and "unread" for a read that never answers. */
async function openScreen(
  screenToOpen: ReactElement,
  activeRoutine: ActiveRoutine | null | "unread",
) {
  queryClient = createDiaryQueryClient();
  queryClient.setQueryData(keys.profiles.timeZone, "Europe/London");
  if (activeRoutine === "unread") {
    queryClient.setQueryDefaults(keys.training.activeRoutine, {
      queryFn: () => new Promise(() => undefined),
    });
  } else {
    queryClient.setQueryDefaults(keys.training.activeRoutine, { staleTime: Infinity });
    queryClient.setQueryData(keys.training.activeRoutine, activeRoutine);
  }
  await render(
    <ThemeProvider fixedPreference="dark">
      <KeyLowProvider client={diaryClient} queryClient={queryClient}>
        {screenToOpen}
      </KeyLowProvider>
    </ThemeProvider>,
  );
  await screen.findByRole("button", { name: /^show (projected|actual)$/i });
}

const screens = [
  {
    name: "the body map",
    screenToOpen: <BodyMapScreen />,
    // A muscle on the figure has no role of its own beyond its button, which a long press opens.
    openSheetOf: async (muscle: MuscleId, status: string) => {
      await userEvent
        .setup()
        .longPress(screen.getByRole("button", { name: `${MUSCLE_NAMES[muscle]}, ${status}` }));
    },
  },
  {
    name: "the muscle list",
    screenToOpen: <MuscleListScreen />,
    openSheetOf: async (muscle: MuscleId) => {
      await userEvent.setup().press(
        screen.getByRole("button", {
          name: describeMuscleListRow(listRowOf(muscle)).accessibleName,
        }),
      );
    },
  },
] as const;

describe.each(screens)("the Edit routine button on the sheet of $name", (shown) => {
  let kitStyles: string;

  beforeAll(async () => {
    kitStyles = await compileKitStyles("", [
      "components/BodyMapScreen",
      "components/BodyMapCard",
      "components/BodyMapLegend",
      "components/MuscleListScreen",
      "components/MuscleRow",
      "components/HeatSwatch",
      "components/ViewLabel",
      "components/MuscleSheet",
      "components/WeeklySetsBar",
    ]);
  });

  beforeEach(() => {
    installVirtualClock({ now: new Date(NOW) });
    registerAppStyles(kitStyles);
    resetRouterMock();
    resetDiaryBackend();
    resetBodyFigureForTests();
    jest.mocked(useBodyMap).mockReturnValue(readResult(bodyMap));
    jest.mocked(useMuscleList).mockReturnValue(readResult(listGroups));
    jest.mocked(useMuscleDetail).mockImplementation((muscle) => readResult(detailOf(muscle)));
  });

  afterEach(async () => {
    await cleanup();
    queryClient.clear();
    jest.clearAllMocks();
    jest.useRealTimers();
  });

  const editRoutineButton = () => screen.getByRole("button", { name: MUSCLE_SHEET.editRoutine });

  it("should open the editor of the active routine from the Not trained sheet", async () => {
    await openScreen(shown.screenToOpen, routine);
    await shown.openSheetOf("abs", "Rested");

    await userEvent.setup().press(editRoutineButton());

    expect(routerMock.push).toHaveBeenCalledTimes(1);
    expect(routerMock.push).toHaveBeenCalledWith(editRoutinePath(routine.id));
  });

  it("should open the create flow when there is no active routine", async () => {
    await openScreen(shown.screenToOpen, null);
    await shown.openSheetOf("abs", "Rested");

    await userEvent.setup().press(editRoutineButton());

    expect(routerMock.push).toHaveBeenCalledTimes(1);
    expect(routerMock.push).toHaveBeenCalledWith(newRoutinePath());
  });

  it("should close the sheet as it opens the editor", async () => {
    await openScreen(shown.screenToOpen, routine);
    await shown.openSheetOf("abs", "Rested");

    await userEvent.setup().press(editRoutineButton());

    await waitFor(() => {
      expect(screen.queryByLabelText(MUSCLE_NAMES.abs)).not.toBeOnTheScreen();
    });
  });

  it("should open the editor once when it is pressed twice", async () => {
    await openScreen(shown.screenToOpen, routine);
    await shown.openSheetOf("abs", "Rested");
    const user = userEvent.setup();

    await user.press(editRoutineButton());
    await user.press(editRoutineButton());

    expect(routerMock.push).toHaveBeenCalledTimes(1);
  });

  it("should not draw the button until the active routine is known", async () => {
    await openScreen(shown.screenToOpen, "unread");
    await shown.openSheetOf("abs", "Rested");

    expect(screen.getByLabelText(MUSCLE_NAMES.abs)).toBeOnTheScreen();
    expect(screen.queryByRole("button", { name: MUSCLE_SHEET.editRoutine })).not.toBeOnTheScreen();
  });

  it("should leave a trained muscle's sheet without the button", async () => {
    await openScreen(shown.screenToOpen, routine);
    await shown.openSheetOf("delt_side", "Rested");

    expect(screen.getByLabelText(MUSCLE_NAMES.delt_side)).toBeOnTheScreen();
    expect(screen.queryByRole("button", { name: MUSCLE_SHEET.editRoutine })).not.toBeOnTheScreen();
  });
});
