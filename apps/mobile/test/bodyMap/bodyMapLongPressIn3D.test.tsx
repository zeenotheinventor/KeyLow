import { KeyLowProvider, keys, useBodyMap, useMuscleDetail } from "@keylow/api-client";
import { act, cleanup, render, screen } from "@testing-library/react-native";
import { AccessibilityInfo, BackHandler } from "react-native";
import { setUpTests } from "react-native-reanimated";

import { BodyMapScreen } from "../../components/BodyMapScreen";
import { resetBody3DSupportForTests } from "../../components/BodyView/testing";
import { RESTING_HEAT } from "../../components/DashboardScreen/DashboardBodyMapCard";
import { resetBodyFigureForTests } from "../../lib/bodyFigure/testing";
import { resetBodyMapRendererForTests } from "../../lib/bodyMapRenderer/testing";
import { ThemeProvider } from "../../lib/theme";
import { createDiaryQueryClient, diaryClient, resetDiaryBackend } from "../support/diaryBackend";
import { resetRouterMock } from "../support/expoRouterMock";
import { compileKitStyles } from "../support/kitStyles";
import { registerAppStyles } from "../support/nativeWindStyles";

import type { Body3DProps } from "../../components/ui";
import type { ActiveRoutine, BodyMap, BodyMapDay, TrainingReadResult } from "@keylow/api-client";
import type { MuscleDetail, MuscleId } from "@keylow/core/training";
import type { QueryClient } from "@tanstack/react-query";

setUpTests();

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
jest.mock(
  "react-native-safe-area-context",
  () =>
    jest.requireActual<{ default: unknown }>("react-native-safe-area-context/jest/mock").default,
);
jest.mock("../../lib/useNow", () => ({
  useNow: () => new Date("2026-10-15T18:00:00Z"),
}));
jest.mock("@keylow/api-client", () => ({
  ...jest.requireActual<typeof import("@keylow/api-client")>("@keylow/api-client"),
  useBodyMap: jest.fn(),
  useMuscleDetail: jest.fn(),
}));

// GL does not run in Jest, so a build with the GL module is told so, and the 3D body is a stand-in that the test
// reads the props of and calls the ones the screen listens to, as the body's own gestures would.
jest.mock("expo", () => {
  const actual = jest.requireActual<typeof import("expo")>("expo");
  return { ...actual, requireOptionalNativeModule: () => ({}) };
});
const mockBody3D = jest.fn<undefined, [Body3DProps]>();
jest.mock("../../components/ui/Body3D", () => {
  const { createElement } = jest.requireActual<typeof import("react")>("react");
  const { View } = jest.requireActual<typeof import("react-native")>("react-native");
  return {
    Body3D: (props: Body3DProps) => {
      mockBody3D(props);
      return createElement(View, { accessible: true, "aria-label": props.label, role: "img" });
    },
  };
});

const lastBody3DProps = (): Body3DProps => {
  const props = mockBody3D.mock.calls.at(-1)?.[0];
  if (props === undefined) {
    throw new Error("The 3D body has not been drawn.");
  }
  return props;
};

async function callBody3D(call: (props: Body3DProps) => void) {
  const props = lastBody3DProps();
  await act(() => {
    call(props);
  });
}

function readResult<Data>(data: Data): TrainingReadResult<Data> {
  return { data, isPending: false, isError: false, error: null, refetch: () => Promise.resolve() };
}

const day = (date: string, status: BodyMapDay["status"]): BodyMapDay => ({
  date,
  at: `${date}T19:00:00.000Z`,
  isToday: date === "2026-10-15",
  status,
  plannedDayName: null,
  sessionDayName: null,
  selectable: true,
});

const bodyMap: BodyMap = {
  values: { ...RESTING_HEAT },
  computedAt: "2026-10-15T18:00:00.000Z",
  days: [day("2026-10-14", "rest"), day("2026-10-15", "logged"), day("2026-10-16", "rest")],
  todayProjectedIsActual: true,
  projectedAvailable: true,
  nothingLogged: false,
};

function detailOf(muscle: MuscleId): MuscleDetail {
  return {
    muscle,
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
}

const routine: ActiveRoutine = {
  id: "routine-1",
  name: "Push Pull Legs",
  activatedAt: null,
  days: [],
};

let queryClient: QueryClient;

async function openScreen() {
  queryClient = createDiaryQueryClient();
  queryClient.setQueryData(keys.profiles.timeZone, "Europe/London");
  queryClient.setQueryDefaults(keys.training.activeRoutine, { staleTime: Infinity });
  queryClient.setQueryData(keys.training.activeRoutine, routine);
  await render(
    <ThemeProvider fixedPreference="dark">
      <KeyLowProvider client={diaryClient} queryClient={queryClient}>
        <BodyMapScreen />
      </KeyLowProvider>
    </ThemeProvider>,
  );
  await screen.findByRole("button", { name: /^show (projected|actual)$/i });
  // The 3D body draws, so it takes the touch.
  await callBody3D((props) => {
    props.onFirstFrame?.();
  });
}

describe("a long press on a muscle of the 3D body, on the body map", () => {
  let kitStyles: string;

  beforeAll(async () => {
    kitStyles = await compileKitStyles("", [
      "components/BodyMapScreen",
      "components/BodyMapCard",
      "components/BodyMapFigures",
      "components/BodyView",
      "components/BodyMapLegend",
      "components/ViewLabel",
      "components/MuscleSheet",
      "components/WeeklySetsBar",
    ]);
  });

  beforeEach(() => {
    registerAppStyles(kitStyles);
    resetRouterMock();
    resetDiaryBackend();
    mockStorageItems.clear();
    mockStorageItems.set("bodyMap.figure", "male");
    mockStorageItems.set("bodyMap.renderer", "3d");
    resetBodyFigureForTests();
    resetBodyMapRendererForTests();
    resetBody3DSupportForTests();
    mockBody3D.mockClear();
    jest.spyOn(AccessibilityInfo, "isReduceMotionEnabled").mockResolvedValue(false);
    jest.spyOn(BackHandler, "addEventListener");
    jest.mocked(useBodyMap).mockReturnValue(readResult(bodyMap));
    jest.mocked(useMuscleDetail).mockImplementation((muscle) => readResult(detailOf(muscle)));
  });

  afterEach(async () => {
    await cleanup();
    queryClient.clear();
    jest.clearAllMocks();
    jest.restoreAllMocks();
  });

  it("should open the sheet of the muscle that was picked, as a dialog named for it", async () => {
    await openScreen();

    await callBody3D((props) => {
      props.onLongPressMuscle?.("delt_side");
    });

    expect(screen.getByLabelText("Side delts")).toHaveProp("role", "dialog");
    expect(screen.getByRole("heading", { name: "Side delts" })).toBeOnTheScreen();
  });

  it("should read the detail of that muscle for the view on screen", async () => {
    await openScreen();

    await callBody3D((props) => {
      props.onLongPressMuscle?.("quads");
    });

    expect(useMuscleDetail).toHaveBeenCalledWith(
      "quads",
      expect.objectContaining({ view: "actual" }),
    );
  });

  it("should read the detail for Projected when Projected is on screen", async () => {
    mockStorageItems.set("bodyMap.view", "projected");
    await openScreen();

    await callBody3D((props) => {
      props.onLongPressMuscle?.("calves");
    });

    expect(useMuscleDetail).toHaveBeenCalledWith(
      "calves",
      expect.objectContaining({ view: "projected" }),
    );
  });

  it("should select the muscle on the body and dim the others while the sheet is open", async () => {
    await openScreen();
    expect(lastBody3DProps().selected).toBeUndefined();

    await callBody3D((props) => {
      props.onLongPressMuscle?.("chest_upper");
    });

    expect(lastBody3DProps()).toMatchObject({ selected: "chest_upper", unselectedOpacity: 0.4 });
  });

  it("should change the muscle when a second long press picks another with the sheet open", async () => {
    await openScreen();
    await callBody3D((props) => {
      props.onLongPressMuscle?.("delt_side");
    });

    await callBody3D((props) => {
      props.onLongPressMuscle?.("hamstrings");
    });

    expect(screen.getByRole("heading", { name: "Hamstrings" })).toBeOnTheScreen();
    expect(lastBody3DProps().selected).toBe("hamstrings");
  });

  it("should not open a sheet for a tap, which toggles the view", async () => {
    await openScreen();

    await callBody3D((props) => {
      props.onTap?.();
    });

    expect(screen.getByRole("button", { name: "Show actual" })).toBeOnTheScreen();
    expect(screen.queryByRole("heading", { name: "Side delts" })).not.toBeOnTheScreen();
    expect(lastBody3DProps().selected).toBeUndefined();
    expect(useMuscleDetail).not.toHaveBeenCalledWith(expect.anything(), expect.anything());
  });

  it("should leave the 2D figure in the stage with no muscle buttons while the 3D body loads", async () => {
    await render(
      <ThemeProvider fixedPreference="dark">
        <KeyLowProvider client={diaryClient} queryClient={createDiaryQueryClient()}>
          <BodyMapScreen />
        </KeyLowProvider>
      </ThemeProvider>,
    );
    await screen.findByRole("button", { name: /^show (projected|actual)$/i });

    expect(screen.queryByRole("button", { name: /^Side delts, / })).not.toBeOnTheScreen();
  });
});
