import {
  KeyLowProvider,
  keys,
  useBodyMap,
  useMuscleDetail,
  useMuscleList,
} from "@keylow/api-client";
import {
  BODY_MAP,
  MUSCLE_GROUP_NAMES,
  MUSCLE_NAMES,
  describeMuscleListRow,
} from "@keylow/core/copy";
import { MUSCLE_IDS, muscleListGroups } from "@keylow/core/training";
import {
  act,
  cleanup,
  render,
  screen,
  userEvent,
  waitFor,
  within,
} from "@testing-library/react-native";
import { setUpTests } from "react-native-reanimated";

import { RESTING_HEAT } from "../../components/DashboardScreen/DashboardBodyMapCard";
import { MuscleListScreen } from "../../components/MuscleListScreen";
import { ThemeProvider } from "../../lib/theme";
import {
  createDiaryQueryClient,
  diaryBackend,
  diaryClient,
  resetDiaryBackend,
} from "../support/diaryBackend";
import { resetRouterMock, routerMock } from "../support/expoRouterMock";
import { compileKitStyles } from "../support/kitStyles";
import { registerAppStyles } from "../support/nativeWindStyles";

import type { BodyMap, BodyMapDay, TrainingReadResult } from "@keylow/api-client";
import type { MuscleDetail, MuscleListGroup, MuscleListRow } from "@keylow/core/training";
import type { QueryClient } from "@tanstack/react-query";

const mockStorageItems = new Map<string, string>();
// When set, the read of the remembered view waits for it, as a slow phone store would.
let mockViewRead: Promise<string | null> | null = null;
jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: {
    getItem: (key: string) =>
      key === "bodyMap.view" && mockViewRead !== null
        ? mockViewRead
        : Promise.resolve(mockStorageItems.get(key) ?? null),
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
// Thursday 15 October 2026, 19:00 in London, the moment the golden week is pinned at.
jest.mock("../../lib/useNow", () => ({
  useNow: () => new Date("2026-10-15T18:00:00Z"),
}));
// The hooks are the things replaced: their numbers are core's, pinned by their own tests. This file is
// about what the screen does with them.
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
    plannedDayName: status === "planned" ? "Push" : null,
    sessionDayName: null,
    selectable: true,
  };
}

const weekDays: BodyMapDay[] = [
  dayOf("2026-10-12", "logged"),
  dayOf("2026-10-13", "logged"),
  dayOf("2026-10-14", "rest"),
  dayOf("2026-10-15", "logged"),
  dayOf("2026-10-16", "rest"),
  dayOf("2026-10-17", "planned"),
  dayOf("2026-10-18", "rest"),
];

const bodyMap: BodyMap = {
  values: { ...RESTING_HEAT },
  computedAt: NOW,
  days: weekDays,
  todayProjectedIsActual: true,
  projectedAvailable: true,
  nothingLogged: false,
};

// Every muscle at rest, but the hamstrings: the golden Thursday 19:00 reading is 55 percent, hot, ready in 31 hours.
const readyAt = (hours: number) => new Date(Date.parse(NOW) + hours * 3_600_000).toISOString();
function groupsWith(heatOfHamstrings: number, hoursUntilReady: number): MuscleListGroup[] {
  const states = Object.fromEntries(
    MUSCLE_IDS.map((muscle) => [
      muscle,
      muscle === "hamstrings"
        ? { heat: heatOfHamstrings, readyAt: readyAt(hoursUntilReady) }
        : { heat: 0, readyAt: NOW },
    ]),
  );
  return muscleListGroups(states as Parameters<typeof muscleListGroups>[0], NOW);
}
const goldenGroups = groupsWith(0.55, 31);
const restingGroups = groupsWith(0, 0);

function rowOf(muscle: string, groups = goldenGroups): MuscleListRow {
  const row = groups
    .flatMap((group) => group.rows)
    .find((candidate) => candidate.muscle === muscle);
  if (row === undefined) {
    throw new Error(`The list holds no row for ${muscle}`);
  }
  return row;
}

const sheetDetail: MuscleDetail = {
  muscle: "hamstrings",
  heatPercent: 55,
  heatStep: 3,
  readyInHours: 31,
  weeklySets: {
    actual: 5.5,
    planned: 11,
    target: { mev: 6, mav: { low: 10, high: 16 }, mrv: 22 },
    actualPosition: "below",
    plannedPosition: "inside",
    volumeStatus: "under",
  },
  targeting: { targeted: true, routineTrains: true, goalRanks: false },
  lastTrained: null,
};

let queryClient: QueryClient;

async function renderScreen() {
  queryClient = createDiaryQueryClient();
  queryClient.setQueryData(keys.profiles.timeZone, "Europe/London");
  await render(
    <ThemeProvider fixedPreference="dark">
      <KeyLowProvider client={diaryClient} queryClient={queryClient}>
        <MuscleListScreen />
      </KeyLowProvider>
    </ThemeProvider>,
  );
}

async function openScreen() {
  await renderScreen();
  await screen.findByRole("button", { name: /^show (projected|actual)$/i });
}

// A list has no accessibility element of its own, so a group is found by the name it carries. A group named
// Back shares its name with the header's Back control, so the one that is a list is picked.
function listOf(group: MuscleListGroup) {
  const list = screen
    .getAllByLabelText(MUSCLE_GROUP_NAMES[group.group])
    .find((candidate) => candidate.props.role === "list");
  if (list === undefined) {
    throw new Error(`The screen holds no list named ${MUSCLE_GROUP_NAMES[group.group]}`);
  }
  return list;
}

const rowButton = (muscle: string, groups = goldenGroups) =>
  screen.getByRole("button", { name: describeMuscleListRow(rowOf(muscle, groups)).accessibleName });

// What the list was last read with.
const lastListRead = () => jest.mocked(useMuscleList).mock.lastCall?.[0];

describe("the muscle list screen", () => {
  let kitStyles: string;

  beforeAll(async () => {
    kitStyles = await compileKitStyles("", [
      "components/MuscleListScreen",
      "components/MuscleRow",
      "components/HeatSwatch",
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
    mockViewRead = null;
    jest.mocked(useBodyMap).mockReturnValue(readResult(bodyMap));
    jest.mocked(useMuscleList).mockReturnValue(readResult(goldenGroups));
    jest.mocked(useMuscleDetail).mockReturnValue(readResult(sheetDetail));
  });

  afterEach(async () => {
    await cleanup();
    queryClient.clear();
    jest.clearAllMocks();
  });

  describe("the rows", () => {
    it("should be titled Muscles, with a Back control", async () => {
      await openScreen();

      expect(screen.getByText(BODY_MAP.listTitle)).toBeOnTheScreen();
      expect(screen.getByRole("button", { name: BODY_MAP.back })).toBeOnTheScreen();
    });

    it("should hold the 22 muscles once, in the 7 groups", async () => {
      await openScreen();

      expect(goldenGroups).toHaveLength(7);
      for (const group of goldenGroups) {
        const buttons = within(listOf(group)).getAllByRole("button");
        expect(buttons).toHaveLength(group.rows.length);
        group.rows.forEach((row, position) => {
          expect(buttons[position]).toHaveAccessibleName(describeMuscleListRow(row).accessibleName);
        });
      }
      expect(goldenGroups.flatMap(({ rows }) => rows)).toHaveLength(MUSCLE_IDS.length);
    });

    it("should head each group with its name", async () => {
      await openScreen();

      for (const { group } of goldenGroups) {
        expect(screen.getByRole("heading", { name: MUSCLE_GROUP_NAMES[group] })).toBeOnTheScreen();
      }
    });

    it("should write the hamstrings row with the golden Thursday reading", async () => {
      await openScreen();
      const { name, status, heatText } = describeMuscleListRow(rowOf("hamstrings"));

      const row = rowButton("hamstrings");
      expect(within(row).getByText(name)).toBeOnTheScreen();
      expect(within(row).getByText(status)).toBeOnTheScreen();
      expect(within(row).getByText(heatText)).toBeOnTheScreen();
    });

    it("should still list every muscle, at rest, when nothing is logged", async () => {
      jest.mocked(useMuscleList).mockReturnValue(readResult(restingGroups));
      await openScreen();

      const rows = restingGroups.flatMap((group) => within(listOf(group)).getAllByRole("button"));
      expect(rows).toHaveLength(MUSCLE_IDS.length);
      expect(rowButton("hamstrings", restingGroups)).toBeOnTheScreen();
    });
  });

  describe("pressing a row", () => {
    it("should open the sheet of that muscle, as a dialog named for it", async () => {
      await openScreen();

      await userEvent.setup().press(rowButton("hamstrings"));

      expect(screen.getByLabelText(MUSCLE_NAMES.hamstrings)).toHaveProp("role", "dialog");
      expect(jest.mocked(useMuscleDetail).mock.lastCall?.[0]).toBe("hamstrings");
    });

    it("should return to the list when the sheet is closed", async () => {
      await openScreen();
      const user = userEvent.setup();
      await user.press(rowButton("hamstrings"));

      await user.press(
        within(screen.getByLabelText(MUSCLE_NAMES.hamstrings)).getByRole("button", {
          name: BODY_MAP.closeSheet,
        }),
      );

      await waitFor(() => {
        expect(screen.queryByLabelText(MUSCLE_NAMES.hamstrings)).not.toBeOnTheScreen();
      });
      expect(rowButton("hamstrings")).toBeOnTheScreen();
    });
  });

  describe("the view", () => {
    it("should read the list for Actual, now, when no view was chosen", async () => {
      await openScreen();

      expect(lastListRead()).toMatchObject({
        view: "actual",
        at: undefined,
        weekStart: "2026-10-12",
      });
      expect(screen.getByRole("button", { name: BODY_MAP.toggle.showProjected })).toBeEnabled();
    });

    it("should follow the view the map remembers", async () => {
      mockStorageItems.set("bodyMap.view", "projected");
      await openScreen();

      expect(lastListRead()).toMatchObject({ view: "projected" });
      expect(screen.getByRole("button", { name: BODY_MAP.toggle.showActual })).toBeOnTheScreen();
    });

    it("should switch to Projected on the button, and remember it for the map", async () => {
      await openScreen();

      await userEvent
        .setup()
        .press(screen.getByRole("button", { name: BODY_MAP.toggle.showProjected }));

      expect(lastListRead()).toMatchObject({ view: "projected" });
      expect(screen.getByRole("button", { name: BODY_MAP.toggle.showActual })).toBeOnTheScreen();
      expect(mockStorageItems.get("bodyMap.view")).toBe("projected");
    });

    it("should switch back to Actual on the button, and remember it for the map", async () => {
      mockStorageItems.set("bodyMap.view", "projected");
      await openScreen();

      await userEvent
        .setup()
        .press(screen.getByRole("button", { name: BODY_MAP.toggle.showActual }));

      expect(lastListRead()).toMatchObject({ view: "actual" });
      expect(screen.getByRole("button", { name: BODY_MAP.toggle.showProjected })).toBeOnTheScreen();
      expect(mockStorageItems.get("bodyMap.view")).toBe("actual");
    });

    it("should show Actual, with the button off and the reason, when there is no routine", async () => {
      mockStorageItems.set("bodyMap.view", "projected");
      jest
        .mocked(useBodyMap)
        .mockReturnValue(readResult({ ...bodyMap, projectedAvailable: false }));
      await openScreen();

      expect(lastListRead()).toMatchObject({ view: "actual" });
      expect(screen.getByRole("button", { name: BODY_MAP.toggle.showProjected })).toBeDisabled();
      expect(screen.getByText(BODY_MAP.toggle.projectedNeedsRoutine)).toBeOnTheScreen();
    });

    it("should not give a reason while there is a routine", async () => {
      await openScreen();

      expect(screen.queryByText(BODY_MAP.toggle.projectedNeedsRoutine)).not.toBeOnTheScreen();
    });
  });

  describe("the day chosen on the map", () => {
    it("should read the list at that day, for Actual, when it is before today", async () => {
      routerMock.searchParams = { at: "2026-10-13" };
      await openScreen();

      expect(lastListRead()).toMatchObject({ view: "actual", at: "2026-10-13" });
    });

    it("should read the list at a later day in Projected", async () => {
      mockStorageItems.set("bodyMap.view", "projected");
      routerMock.searchParams = { at: "2026-10-17" };
      await openScreen();

      expect(lastListRead()).toMatchObject({ view: "projected", at: "2026-10-17" });
    });

    it("should fall back to today when Actual cannot choose the day", async () => {
      jest.mocked(useBodyMap).mockImplementation(({ view }) =>
        readResult({
          ...bodyMap,
          days: weekDays.map((day) => ({
            ...day,
            selectable: view === "projected" || day.date <= "2026-10-15",
          })),
        }),
      );
      routerMock.searchParams = { at: "2026-10-17" };
      await openScreen();

      expect(lastListRead()).toMatchObject({ view: "actual", at: undefined });
    });

    it.each(["2026-10-11", "2026-10-19", "yesterday", "2026-10-15x"])(
      "should ignore %s, which is no day of this week",
      async (at) => {
        routerMock.searchParams = { at };
        await openScreen();

        expect(lastListRead()).toMatchObject({ at: undefined });
        expect(jest.mocked(useBodyMap).mock.calls.map(([input]) => input.at)).toEqual([
          undefined,
          undefined,
        ]);
      },
    );

    it("should read the sheet at the same day", async () => {
      routerMock.searchParams = { at: "2026-10-13" };
      await openScreen();

      await userEvent.setup().press(rowButton("hamstrings"));

      expect(jest.mocked(useMuscleDetail).mock.lastCall?.[1]).toMatchObject({
        at: "2026-10-13",
        view: "actual",
      });
    });
  });

  describe("reading", () => {
    it("should read the week, the list and the sheet once the terms are accepted", async () => {
      await openScreen();
      await userEvent.setup().press(rowButton("hamstrings"));

      await waitFor(() => {
        expect(jest.mocked(useBodyMap).mock.lastCall?.[0].enabled).toBe(true);
      });
      expect(lastListRead()).toMatchObject({ enabled: true });
      expect(jest.mocked(useMuscleDetail).mock.lastCall?.[1]).toMatchObject({ enabled: true });
    });

    it("should make no read at all while the terms gate is up", async () => {
      diaryBackend.terms = { terms_accepted_at: null, terms_version: null };
      await openScreen();
      await userEvent.setup().press(rowButton("hamstrings"));
      // The gate's own answer has come back by now, so a read left on by it would show in the last calls.
      await waitFor(() => {
        expect(queryClient.getQueryData(keys.profiles.termsAcceptance)).toBeDefined();
      });

      const reads = [
        ...jest.mocked(useBodyMap).mock.calls.map(([input]) => input),
        ...jest.mocked(useMuscleList).mock.calls.map(([input]) => input),
        ...jest.mocked(useMuscleDetail).mock.calls.map(([, input]) => input),
      ];
      expect(reads.length).toBeGreaterThan(0);
      expect(reads.map(({ enabled }) => enabled)).not.toContain(true);
    });
  });

  describe("while the remembered view is still being read", () => {
    it("should draw no rows, so a remembered Projected list never flashes Actual", async () => {
      mockStorageItems.set("bodyMap.view", "projected");
      let finishRead: (value: string | null) => void = () => undefined;
      mockViewRead = new Promise((resolve) => {
        finishRead = resolve;
      });
      await renderScreen();

      expect(
        screen.getByRole("status", { name: BODY_MAP.dashboardCard.loadingLabel }),
      ).toBeOnTheScreen();
      expect(
        screen.queryByRole("button", {
          name: describeMuscleListRow(rowOf("hamstrings")).accessibleName,
        }),
      ).not.toBeOnTheScreen();
      expect(
        screen.queryByRole("button", { name: /^show (projected|actual)$/i }),
      ).not.toBeOnTheScreen();

      await act(() => {
        finishRead("projected");
      });

      expect(
        await screen.findByRole("button", { name: BODY_MAP.toggle.showActual }),
      ).toBeOnTheScreen();
      expect(rowButton("hamstrings")).toBeOnTheScreen();
    });
  });

  describe("going back", () => {
    it("should go back when there is a screen to go back to", async () => {
      await openScreen();

      await userEvent.setup().press(screen.getByRole("button", { name: BODY_MAP.back }));

      expect(routerMock.back).toHaveBeenCalledTimes(1);
    });

    it("should go to the body map from a cold link", async () => {
      routerMock.canGoBack.mockReturnValue(false);
      await openScreen();

      await userEvent.setup().press(screen.getByRole("button", { name: BODY_MAP.back }));

      expect(routerMock.replace).toHaveBeenCalledWith("/body-map");
    });
  });

  describe("while the rows are not there", () => {
    it("should say it is loading", async () => {
      jest.mocked(useMuscleList).mockReturnValue({
        data: undefined,
        isPending: true,
        isError: false,
        error: null,
        refetch: () => Promise.resolve(),
      });
      queryClient = createDiaryQueryClient();
      await render(
        <ThemeProvider fixedPreference="dark">
          <KeyLowProvider client={diaryClient} queryClient={queryClient}>
            <MuscleListScreen />
          </KeyLowProvider>
        </ThemeProvider>,
      );

      expect(
        await screen.findByRole("status", { name: BODY_MAP.dashboardCard.loadingLabel }),
      ).toBeOnTheScreen();
    });

    it("should offer to try again when the list cannot be read", async () => {
      const refetch = jest.fn(() => Promise.resolve());
      jest.mocked(useMuscleList).mockReturnValue({
        data: undefined,
        isPending: false,
        isError: true,
        error: new Error("down"),
        refetch,
      });
      queryClient = createDiaryQueryClient();
      await render(
        <ThemeProvider fixedPreference="dark">
          <KeyLowProvider client={diaryClient} queryClient={queryClient}>
            <MuscleListScreen />
          </KeyLowProvider>
        </ThemeProvider>,
      );

      await userEvent.setup().press(await screen.findByRole("button", { name: /try again/i }));

      expect(refetch).toHaveBeenCalledTimes(1);
    });
  });
});
